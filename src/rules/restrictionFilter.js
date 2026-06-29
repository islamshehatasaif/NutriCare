/**
 * NutriCare AI — Deterministic Restriction Filter ("the hard gate")
 *
 * "100% of generated foods must pass the restriction-profile filter. A single
 *  violation is a failed output. The filter is a hard deterministic gate —
 *  not a prompt instruction." (deck p.38, p.45)
 *
 * Screens any food against a patient's restriction profile and returns an
 * allow / caution / avoid verdict WITH the rule that fired (explainability).
 */

const { DISEASE_MODULES, ckdStageFromEgfr, ckdBandForStage } = require('../data/diseaseModules');

/**
 * Build a restriction profile from a patient record. This is what the gate
 * enforces; it is derived deterministically from diagnosis + labs.
 */
function buildProfile(patient) {
  const profile = { module: patient.diseaseModule, limits: [] };
  if (patient.diseaseModule === 'CKD') {
    const stage = patient.ckdStage || ckdStageFromEgfr(patient.egfr);
    const band = ckdBandForStage(stage);
    profile.ckdStage = stage;
    if (band) {
      if (band.potassiumMg) profile.limits.push({ key: 'highPotassium', nutrient: 'potassium', maxPerPortionMg: 250 });
      if (band.phosphorusMg) profile.limits.push({ key: 'highPhosphorus', nutrient: 'phosphorus', maxPerPortionMg: 150 });
      profile.limits.push({ key: 'highSodium', nutrient: 'sodium', maxPerPortionMg: 400 });
    }
    // Hyperkalaemia overrides everything
    if (patient.potassium != null && patient.potassium > 5.0) {
      profile.limits.push({ key: 'hyperkalaemia', nutrient: 'potassium', maxPerPortionMg: 200, hard: true });
    }
  } else if (patient.diseaseModule === 'Hepatic') {
    profile.limits.push({ key: 'highSodium', nutrient: 'sodium', maxPerPortionMg: 400 });
  } else if (patient.diseaseModule === 'Hyperlipidemia') {
    profile.limits.push({ key: 'highSatFat', nutrient: 'satFat', maxPerPortionG: 5 });
  } else if (patient.diseaseModule === 'IEM') {
    if (patient.iemType === 'PKU') profile.limits.push({ key: 'highPhe', nutrient: 'phe', maxPerPortionMg: 75, hard: true });
    else profile.limits.push({ key: 'highProtein', nutrient: 'protein', maxPerPortionG: 6, hard: true });
  }
  return profile;
}

/** Portion grams default 100g (DB values are per 100g). */
function screenFood(food, profile, portionGrams = 100) {
  const factor = portionGrams / 100;
  const violations = [];
  let verdict = 'allow';
  for (const limit of profile.limits) {
    const raw = food[limit.nutrient];
    if (raw == null) continue;
    const amount = raw * factor;
    const max = limit.maxPerPortionMg ?? limit.maxPerPortionG;
    if (max == null) continue;
    if (amount > max) {
      const unit = limit.maxPerPortionMg != null ? 'mg' : 'g';
      violations.push({
        rule: `${labelFor(limit.key)} — ${limit.nutrient} ${amount.toFixed(0)}${unit} > limit ${max}${unit}/portion`,
        nutrient: limit.nutrient, amount: +amount.toFixed(1), limit: max, hard: !!limit.hard,
      });
      verdict = limit.hard ? 'avoid' : (verdict === 'avoid' ? 'avoid' : 'caution');
    }
  }
  // Any hard violation forces AVOID
  if (violations.some(v => v.hard)) verdict = 'avoid';
  else if (violations.length >= 2) verdict = 'avoid';
  return { food: food.name, verdict, violations, passed: verdict !== 'avoid' };
}

function labelFor(key) {
  const map = {
    highPotassium: 'High potassium', highPhosphorus: 'High phosphorus',
    highSodium: 'High sodium', highSatFat: 'High saturated fat',
    highPhe: 'Contains phenylalanine', highProtein: 'High natural protein',
    hyperkalaemia: 'Hyperkalaemia restriction',
  };
  return map[key] || key;
}

/**
 * Screen an entire meal/food list — returns whether the whole set passes
 * (the deck's "100% of foods must pass" rule).
 */
function screenMeal(foods, patient, portionGrams = 100) {
  const profile = buildProfile(patient);
  const results = foods.map(f => screenFood(f, profile, portionGrams));
  const failed = results.filter(r => r.verdict === 'avoid');
  return {
    profile, results,
    safe: failed.length === 0,
    failedCount: failed.length,
    summary: failed.length === 0
      ? 'All foods pass the restriction filter.'
      : `${failed.length} food(s) violate the restriction profile and were blocked.`,
  };
}

module.exports = { buildProfile, screenFood, screenMeal };
