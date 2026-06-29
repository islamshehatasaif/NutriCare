/**
 * NutriCare AI — Deterministic Clinical Calculation Engine
 *
 * "All clinical maths run in validated, unit-tested deterministic code —
 *  never inside the LLM. Inputs and outputs are range-checked." (deck p.45)
 *
 * Contains: age, BMI, ideal body weight, energy/protein targets, and the
 * anchor MALNUTRITION RISK model (NRS-2002 + GLIM + weighted AI score) with
 * an explainability trace for every output.
 */

const { DISEASE_MODULES, ckdStageFromEgfr, ckdBandForStage } = require('../data/diseaseModules');

// ── Basics ──────────────────────────────────────────────────────────
function calculateAge(birthday, now = new Date()) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (isNaN(b)) return null;
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  let days = now.getDate() - b.getDate();
  if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (months < 0) { years--; months += 12; }
  const totalDays = Math.floor((now - b) / 86400000);
  let display;
  if (years >= 2) display = `${years}y ${months}m`;
  else if (years >= 1) display = `${years}y ${months}m`;
  else if (totalDays >= 28) display = `${months}m ${days}d`;
  else display = `${totalDays}d`;
  const band =
    totalDays < 28 ? 'neonate' :
    years < 1 ? 'infant' :
    years < 3 ? 'toddler' :
    years < 6 ? 'preschool' :
    years < 12 ? 'school-age' :
    years < 18 ? 'adolescent' :
    years < 65 ? 'adult' : 'older-adult';
  return { years, months, days, totalDays, display, band, birthDate: birthday };
}

function bmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return +(weightKg / (m * m)).toFixed(1);
}

function bmiCategory(b) {
  if (b == null) return null;
  if (b < 18.5) return 'underweight';
  if (b < 25) return 'normal';
  if (b < 30) return 'overweight';
  return 'obese';
}

// Devine ideal body weight (kg)
function idealBodyWeight(heightCm, gender) {
  if (!heightCm) return null;
  const inchesOver5ft = Math.max(0, heightCm / 2.54 - 60);
  const base = gender === 'female' ? 45.5 : 50;
  return +(base + 2.3 * inchesOver5ft).toFixed(1);
}

// ── Disease-specific nutrient targets ───────────────────────────────
/**
 * Returns { energyKcal, proteinG, sodiumMg, potassiumMg, phosphorusMg, fluid,
 *           explain[] } using deterministic guideline logic.
 */
function nutrientTargets(patient) {
  const explain = [];
  const ibw = idealBodyWeight(patient.heightCm, patient.gender);
  const band = patient.ageBand;
  // Adults dose on ideal body weight; children/neonates on actual weight (IBW
  // formulas are invalid under ~5 ft).
  const useIbw = band === 'adult' || band === 'older-adult';
  const dosingWeight = (useIbw && ibw) ? ibw : (patient.weightKg || ibw || 0);
  const module = patient.diseaseModule;
  // Age-appropriate baseline energy/protein (overridden by disease modules below)
  let energyKcalPerKg = 30, proteinGperKg = 0.8;
  if (band === 'neonate') { energyKcalPerKg = 100; proteinGperKg = 2.5; }
  else if (band === 'infant') { energyKcalPerKg = 85; proteinGperKg = 1.8; }
  else if (band === 'toddler' || band === 'preschool') { energyKcalPerKg = 80; proteinGperKg = 1.3; }
  else if (band === 'school-age' || band === 'adolescent') { energyKcalPerKg = 55; proteinGperKg = 1.0; }
  let sodiumMg = 2300, potassiumMg = null, phosphorusMg = null, fluid = 'ad lib';

  if (module === 'CKD') {
    const stage = patient.ckdStage || ckdStageFromEgfr(patient.egfr);
    const band = ckdBandForStage(stage);
    if (band) {
      energyKcalPerKg = band.energyKcalPerKg;
      proteinGperKg = band.proteinGperKg;
      sodiumMg = band.sodiumMg; potassiumMg = band.potassiumMg;
      phosphorusMg = band.phosphorusMg; fluid = band.fluid;
      explain.push({
        rule: `CKD stage ${stage} → protein ${band.proteinGperKg} g/kg, Na <${band.sodiumMg} mg`,
        source: DISEASE_MODULES.CKD.guideline, version: DISEASE_MODULES.CKD.guidelineVersion,
        value: `eGFR ${patient.egfr ?? 'n/a'} → stage ${stage}`,
      });
    }
  } else if (module === 'Hepatic') {
    const sub = (DISEASE_MODULES.Hepatic.subtypes.find(s => s.key === patient.hepaticSubtype)
      || DISEASE_MODULES.Hepatic.subtypes[0]);
    energyKcalPerKg = sub.energyKcalPerKg; proteinGperKg = sub.proteinGperKg; sodiumMg = sub.sodiumMg;
    explain.push({
      rule: `Hepatic (${sub.label}) → protein ${sub.proteinGperKg} g/kg (NOT restricted), Na <${sub.sodiumMg} mg. ${sub.note}`,
      source: DISEASE_MODULES.Hepatic.guideline, version: DISEASE_MODULES.Hepatic.guidelineVersion,
      value: patient.hepaticSubtype || 'compensated',
    });
  } else if (module === 'Hyperlipidemia') {
    const cat = (DISEASE_MODULES.Hyperlipidemia.riskCategories.find(c => c.key === patient.lipidRisk)
      || DISEASE_MODULES.Hyperlipidemia.riskCategories[1]);
    energyKcalPerKg = 25; proteinGperKg = 1.0;
    explain.push({
      rule: `Hyperlipidemia (${cat.label}) → saturated fat <${cat.satFatPercentEnergy}% energy, cholesterol <${cat.cholesterolMg} mg/day`,
      source: DISEASE_MODULES.Hyperlipidemia.guideline, version: DISEASE_MODULES.Hyperlipidemia.guidelineVersion,
      value: cat.label,
    });
  } else if (module === 'IEM') {
    const type = (DISEASE_MODULES.IEM.types.find(t => t.key === patient.iemType)
      || DISEASE_MODULES.IEM.types[0]);
    proteinGperKg = patient.ageBand === 'neonate' || patient.ageBand === 'infant' ? 2.5 : 1.0;
    energyKcalPerKg = patient.ageBand === 'neonate' ? 100 : 80;
    explain.push({
      rule: `IEM (${type.label}) → ${type.note}`,
      source: DISEASE_MODULES.IEM.guideline, version: DISEASE_MODULES.IEM.guidelineVersion,
      value: type.label,
    });
  }

  const energyKcal = Math.round(energyKcalPerKg * dosingWeight);
  const proteinG = +(proteinGperKg * dosingWeight).toFixed(1);

  // Macro distribution. Fat % of energy is lower for hyperlipidemia.
  const fatPctEnergy = module === 'Hyperlipidemia' ? 0.25 : 0.30;
  const fatG = +((energyKcal * fatPctEnergy) / 9).toFixed(0);
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const carbsG = Math.max(0, +(((energyKcal - proteinKcal - fatKcal) / 4)).toFixed(0));
  const fiberG = +(14 * energyKcal / 1000).toFixed(0); // 14 g per 1000 kcal
  // Saturated fat cap (g) for hyperlipidemia, else general <10% energy
  const satFatPct = module === 'Hyperlipidemia'
    ? (lipidSatPct(patient) / 100) : 0.10;
  const satFatG = +((energyKcal * satFatPct) / 9).toFixed(0);

  return {
    dosingWeightKg: dosingWeight, energyKcal, energyKcalPerKg,
    proteinG, proteinGperKg, carbsG, fatG, fiberG, satFatG,
    sodiumMg, potassiumMg, phosphorusMg, fluid, explain,
  };
}

function lipidSatPct(patient) {
  const cat = (DISEASE_MODULES.Hyperlipidemia.riskCategories.find(c => c.key === patient.lipidRisk)
    || DISEASE_MODULES.Hyperlipidemia.riskCategories[1]);
  return cat.satFatPercentEnergy;
}

// ── Anchor model: MALNUTRITION RISK (NRS-2002 + GLIM + weighted score) ──
/**
 * Implements the deck's anchor model.
 * Inputs (patient): weightKg, heightCm, weightLossPct (last 3-6mo),
 *   intakePctOfNeeds, albumin, crp, age, diagnosisSeverity (0-3), icu(bool),
 *   sarcopenia(bool).
 * Returns weighted 0-100 risk score, tier, NRS-2002 + GLIM sub-results,
 * fired high-risk flags, and a full explainability trace.
 */
function malnutritionRisk(p) {
  const factors = [];     // explainability: each fired factor with weight
  const flags = [];       // automatic high-risk flags (deck p.20)
  const b = bmi(p.weightKg, p.heightCm);
  const cat = bmiCategory(b);
  const age = p.age ?? (p.birthday ? calculateAge(p.birthday).years : null);

  // —— NRS-2002 component (0-7) ——
  // Impaired nutritional status (0-3)
  let nrsNutrition = 0;
  if (b != null && b < 18.5) nrsNutrition = 3;
  else if (p.weightLossPct >= 15 || p.intakePctOfNeeds <= 25) nrsNutrition = 3;
  else if (p.weightLossPct >= 10 || (p.intakePctOfNeeds != null && p.intakePctOfNeeds <= 50)) nrsNutrition = 2;
  else if (p.weightLossPct >= 5 || (p.intakePctOfNeeds != null && p.intakePctOfNeeds <= 75)) nrsNutrition = 1;
  // Disease severity (0-3) from clinician-coded severity
  const nrsDisease = Math.min(3, Math.max(0, p.diagnosisSeverity || 0));
  let nrsScore = nrsNutrition + nrsDisease;
  if (age != null && age >= 70) nrsScore += 1; // age adjustment
  const nrsAtRisk = nrsScore >= 3;

  // —— GLIM (1 phenotypic AND 1 etiologic) ——
  const phenotypic = [];
  if (p.weightLossPct >= 5) phenotypic.push(`weight loss ${p.weightLossPct}%`);
  if (b != null && ((age != null && age < 70 && b < 20) || (age != null && age >= 70 && b < 22))) phenotypic.push(`low BMI ${b}`);
  if (p.sarcopenia) phenotypic.push('reduced muscle mass');
  const etiologic = [];
  if (p.intakePctOfNeeds != null && p.intakePctOfNeeds < 50) etiologic.push('reduced intake <50% needs');
  if (p.crp != null && p.crp > 5) etiologic.push(`inflammation (CRP ${p.crp})`);
  if (p.diagnosisSeverity >= 2) etiologic.push('acute disease/injury burden');
  const glimDiagnosed = phenotypic.length >= 1 && etiologic.length >= 1;

  // —— Weighted AI risk score (0-100) ——
  let score = 0;
  const add = (points, label, value) => { score += points; factors.push({ label, points, value }); };

  if (p.weightLossPct >= 10) { add(25, 'Weight loss > 10%', `${p.weightLossPct}%`); flags.push('Weight loss > 10% body weight'); }
  else if (p.weightLossPct >= 5) add(12, 'Weight loss 5–10%', `${p.weightLossPct}%`);

  if (p.intakePctOfNeeds != null && p.intakePctOfNeeds < 50) { add(20, 'Food intake < 50% of needs', `${p.intakePctOfNeeds}%`); flags.push('Food intake < 50% of estimated needs'); }
  else if (p.intakePctOfNeeds != null && p.intakePctOfNeeds < 75) add(10, 'Food intake 50–75% of needs', `${p.intakePctOfNeeds}%`);

  if (b != null && b < 18.5) { add(18, 'Low BMI (< 18.5)', `${b}`); flags.push('Low BMI for age and condition'); }
  else if (b != null && b < 20 && age != null && age >= 70) add(10, 'Low BMI for older adult', `${b}`);

  if (p.albumin != null && p.albumin < 3.0) add(12, 'Hypoalbuminaemia (< 3.0 g/dL)', `${p.albumin} g/dL`);
  else if (p.albumin != null && p.albumin < 3.5) add(6, 'Low albumin (3.0–3.5 g/dL)', `${p.albumin} g/dL`);

  if (p.crp != null && p.crp > 10) add(10, 'High inflammation (CRP > 10)', `${p.crp} mg/L`);
  else if (p.crp != null && p.crp > 5) add(5, 'Inflammation (CRP 5–10)', `${p.crp} mg/L`);

  if (p.icu) { add(10, 'ICU admission', 'yes'); flags.push('ICU admission'); }
  if (p.sarcopenia) { add(8, 'Sarcopenia (low muscle mass)', 'yes'); flags.push('Sarcopenia (low muscle mass)'); }
  if (age != null && age > 70) { add(7, 'Age > 70 years', `${age}y`); flags.push('Age > 70 years'); }
  if ((p.diagnosisSeverity || 0) >= 2) add(8, 'Severe disease burden', `severity ${p.diagnosisSeverity}`);

  score = Math.min(100, Math.round(score));

  const tier =
    score >= 80 ? { key: 'critical', label: 'Critical', action: 'Urgent escalation + nutrition support protocol' } :
    score >= 60 ? { key: 'high', label: 'High', action: 'Immediate nutrition intervention triggered' } :
    score >= 30 ? { key: 'moderate', label: 'Moderate', action: 'Dietitian review within 48 hours' } :
                  { key: 'low', label: 'Low', action: 'Routine monitoring — standard care pathway' };

  return {
    score, tier, flags,
    nrs2002: { score: nrsScore, nutritionPts: nrsNutrition, diseasePts: nrsDisease, atRisk: nrsAtRisk, highRisk: nrsScore >= 5 },
    glim: { diagnosed: glimDiagnosed, phenotypic, etiologic },
    bmi: b, bmiCategory: cat,
    factors,
    confidence: factors.length >= 2 ? 0.9 : 0.7,
    explanation: buildRiskNarrative(score, tier, factors, flags),
  };
}

function buildRiskNarrative(score, tier, factors, flags) {
  const top = factors.slice().sort((a, b) => b.points - a.points).slice(0, 3)
    .map(f => `${f.label} (${f.value})`).join(', ');
  return `Malnutrition risk score ${score}/100 — ${tier.label}. ` +
    (top ? `Main drivers: ${top}. ` : 'No major risk factors identified. ') +
    `Recommended action: ${tier.action}.`;
}

/**
 * Personalized, data-driven recommendations (deterministic — derived from the
 * patient's own values, never random). Returns an ordered list of strings.
 */
function personalizedRecommendations(p) {
  const recs = [];
  const risk = malnutritionRisk(p);
  const t = nutrientTargets(p);
  const b = bmi(p.weightKg, p.heightCm);

  // Risk-tier driven
  if (risk.tier.key === 'critical' || risk.tier.key === 'high') {
    recs.push(`High malnutrition risk (${risk.score}/100): start nutrition support and ${risk.tier.action.toLowerCase()}.`);
    recs.push(`Aim for ${t.energyKcal} kcal and ${t.proteinG} g protein/day; consider oral nutritional supplements between meals.`);
  } else if (risk.tier.key === 'moderate') {
    recs.push(`Moderate risk (${risk.score}/100): dietitian review within 48 h and re-screen in 1 week.`);
  } else {
    recs.push(`Low malnutrition risk (${risk.score}/100): maintain current intake and routine monitoring.`);
  }

  // Intake / weight loss
  if (p.intakePctOfNeeds != null && p.intakePctOfNeeds < 75) recs.push(`Intake is only ${p.intakePctOfNeeds}% of needs — fortify meals and add energy-dense snacks.`);
  if (p.weightLossPct >= 5) recs.push(`Unintentional weight loss ${p.weightLossPct}% — track weight twice weekly.`);

  // Module specific
  if (p.diseaseModule === 'CKD') {
    if (t.potassiumMg) recs.push(`Keep potassium < ${t.potassiumMg} mg/day — limit bananas, oranges, potatoes, dates.`);
    if (t.phosphorusMg) recs.push(`Keep phosphorus < ${t.phosphorusMg} mg/day and take phosphate binders with meals.`);
    if (p.potassium != null && p.potassium > 5.0) recs.push(`Serum K⁺ ${p.potassium} mmol/L is high — strict potassium restriction and review medications.`);
  } else if (p.diseaseModule === 'Hepatic') {
    recs.push(`Do NOT restrict protein (target ${t.proteinG} g/day); favour vegetable/BCAA protein and a late-evening snack.`);
    recs.push(`Limit sodium to < ${t.sodiumMg} mg/day to manage ascites.`);
  } else if (p.diseaseModule === 'Hyperlipidemia') {
    recs.push(`Keep saturated fat < ${t.satFatG} g/day; replace with olive oil, nuts and oily fish.`);
    if (p.ldl != null && p.ldl > 100) recs.push(`LDL ${p.ldl} mg/dL is above optimal — increase soluble fibre to ${t.fiberG} g/day.`);
  } else if (p.diseaseModule === 'IEM') {
    recs.push(`Maintain the prescribed ${p.iemType || 'metabolic'} diet and special formula; never miss feeds.`);
  }

  // Anthropometric
  if (b != null && b < 18.5) recs.push(`BMI ${b} is underweight — prioritise weight gain with energy-dense foods.`);
  else if (b != null && b >= 30) recs.push(`BMI ${b} is in the obese range — gradual weight loss via portion control and activity.`);

  if (p.ageBand === 'neonate' || p.ageBand === 'infant') recs.push(`Monitor growth on WHO charts (weight/length-for-age) at every visit.`);

  return recs;
}

module.exports = {
  calculateAge, bmi, bmiCategory, idealBodyWeight,
  nutrientTargets, malnutritionRisk, personalizedRecommendations,
};
