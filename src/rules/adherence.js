/**
 * NutriCare AI — Health Adherence Calculator (deterministic, weighted)
 *
 * Computes a 0–100 adherence score from REAL logged data — never random.
 * Weights: Food 30% · Exercise 30% · Medication 30% · Lifestyle 10%.
 * Every sub-score handles missing data with an explicit fallback (no errors),
 * and returns a reason so the UI can explain the number.
 */

const { FOODS } = require('../data/foods');
const FOOD_BY_NAME = Object.fromEntries(FOODS.map(f => [f.name, f]));

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

// ── Food adherence: calories vs target + sodium deviation ───────────
function foodScore({ foodLogsToday = [], targetKcal, sodiumLimitMg }) {
  if (!foodLogsToday.length) return { score: 60, reason: 'No food logged today — neutral fallback', hasData: false };
  const kcal = foodLogsToday.reduce((s, l) => s + (l.kcal || 0), 0);
  let sodium = 0;
  for (const l of foodLogsToday) {
    const f = FOOD_BY_NAME[l.food_name];
    if (f) sodium += (f.sodium || 0) * ((l.grams || 100) / 100);
  }
  let score = 70;
  if (targetKcal > 0) {
    const ratio = kcal / targetKcal;                 // 1.0 = on target
    score = 100 - Math.min(100, Math.abs(ratio - 1) * 130); // ±0% best, ±77% → 0
  }
  let sodiumPenalty = 0;
  if (sodiumLimitMg && sodium > sodiumLimitMg) sodiumPenalty = Math.min(25, (sodium / sodiumLimitMg - 1) * 60);
  return {
    score: clamp(score - sodiumPenalty), hasData: true,
    detail: { kcal: Math.round(kcal), targetKcal, sodiumMg: Math.round(sodium), sodiumLimitMg },
    reason: sodiumPenalty > 5 ? `High sodium (${Math.round(sodium)} mg) reduced the score` : `Calories ${Math.round(kcal)} vs ${targetKcal} target`,
  };
}

// ── Exercise adherence: minutes vs daily goal ───────────────────────
function exerciseScore({ minutesToday = 0, goalMin = 30, isNew = false }) {
  if (isNew && minutesToday === 0) return { score: 50, reason: 'No exercise history yet — neutral fallback', hasData: false };
  const score = goalMin > 0 ? (minutesToday / goalMin) * 100 : 0;
  return { score: clamp(score), hasData: true, detail: { minutesToday, goalMin }, reason: minutesToday >= goalMin ? 'Daily exercise goal met' : `${minutesToday}/${goalMin} min of activity goal` };
}

// ── Medication adherence: taken vs scheduled doses ──────────────────
function medicationScore({ scheduled = 0, taken = 0, hasMeds = false }) {
  if (!hasMeds) return { score: 100, reason: 'No medications prescribed', hasData: false };
  if (scheduled === 0) return { score: 50, reason: 'No medication doses logged — neutral fallback', hasData: false };
  const score = (taken / scheduled) * 100;
  const missed = scheduled - taken;
  return { score: clamp(score), hasData: true, detail: { scheduled, taken, missed }, reason: missed > 0 ? `${missed} missed dose(s) of ${scheduled}` : 'All doses taken on time' };
}

// ── Lifestyle adherence: water + sleep + stress ─────────────────────
function lifestyleScore({ waterMl = 0, waterGoalMl = 2000, sleepHours = null, stressLevel = null }) {
  const parts = [];
  const water = waterGoalMl > 0 ? clamp((waterMl / waterGoalMl) * 100) : 60;
  parts.push(water);
  let sleep = null;
  if (sleepHours != null) { sleep = (sleepHours >= 7 && sleepHours <= 9) ? 100 : clamp(100 - Math.abs(8 - sleepHours) * 18); parts.push(sleep); }
  let stress = null;
  if (stressLevel != null) { stress = clamp((10 - stressLevel) / 10 * 100); parts.push(stress); }
  const score = clamp(parts.reduce((a, b) => a + b, 0) / parts.length);
  return { score, hasData: waterMl > 0 || sleepHours != null, detail: { water, sleep, stress, waterMl, waterGoalMl, sleepHours, stressLevel }, reason: water < 60 ? 'Hydration below goal' : 'Hydration/sleep/stress combined' };
}

function insightsFrom(sub, patient) {
  const out = [];
  if (sub.medication.hasData && sub.medication.score < 70) out.push('Low medication adherence increases cardiovascular and disease-progression risk.');
  if (sub.exercise.score >= 75) out.push('Exercise consistency is improving metabolic health.');
  else if (sub.exercise.hasData) out.push('Increasing physical activity would raise overall adherence.');
  if (sub.food.detail && sub.food.detail.sodiumLimitMg && sub.food.detail.sodiumMg > sub.food.detail.sodiumLimitMg) out.push('High sodium intake negatively impacts blood-pressure control.');
  if (sub.lifestyle.detail && sub.lifestyle.detail.water < 60) out.push('Hydration is below target — sip water steadily through the day.');
  if (!out.length) out.push('Adherence is on track — maintain current habits and re-check weekly.');
  return out;
}

/**
 * Master calculator.
 * inputs = { patient, targetKcal, sodiumLimitMg, foodLogsToday, minutesToday,
 *            waterMl, medScheduled, medTaken, hasMeds, isNew }
 */
function computeAdherence(inp) {
  const food = foodScore({ foodLogsToday: inp.foodLogsToday, targetKcal: inp.targetKcal, sodiumLimitMg: inp.sodiumLimitMg });
  const exercise = exerciseScore({ minutesToday: inp.minutesToday, goalMin: inp.exerciseGoalMin || 30, isNew: inp.isNew });
  const medication = medicationScore({ scheduled: inp.medScheduled, taken: inp.medTaken, hasMeds: inp.hasMeds });
  const lifestyle = lifestyleScore({ waterMl: inp.waterMl, waterGoalMl: inp.waterGoalMl || 2000, sleepHours: inp.sleepHours, stressLevel: inp.stressLevel });

  const overall = clamp(food.score * 0.30 + exercise.score * 0.30 + medication.score * 0.30 + lifestyle.score * 0.10);
  const category = overall > 75 ? 'High' : overall >= 50 ? 'Medium' : 'Low';
  const sub = { food, exercise, medication, lifestyle };
  return {
    overall, category,
    food: food.score, exercise: exercise.score, medication: medication.score, lifestyle: lifestyle.score,
    breakdown: sub,
    insights: insightsFrom(sub, inp.patient),
    weights: { food: 30, exercise: 30, medication: 30, lifestyle: 10 },
    riskFlag: overall < 50,
  };
}

module.exports = { computeAdherence };
