/**
 * NutriCare AI — Disease Module Definitions
 *
 * Each module encodes guideline logic as DETERMINISTIC rules (per the deck:
 * "All modules encode guideline logic as deterministic rules — not generated
 *  by the LLM"). These drive nutrient targets and the restriction filter.
 *
 * Every threshold carries a `source` so the explainability panel can cite the
 * guideline + the rule that fired.
 */

const DISEASE_MODULES = {
  CKD: {
    key: 'CKD',
    name: 'Chronic Kidney Disease',
    nameAr: 'مرض الكلى المزمن',
    guideline: 'KDOQI Clinical Practice Guideline for Nutrition in CKD (2020)',
    guidelineVersion: 'KDOQI-2020 v1.2',
    keyLabs: ['eGFR', 'Potassium', 'Phosphorus', 'Creatinine', 'Albumin'],
    // eGFR-based staging (mL/min/1.73m2)
    stages: [
      { stage: '1', eGFRmin: 90, label: 'Stage 1 — Normal/high', desc: 'Kidney damage, normal GFR' },
      { stage: '2', eGFRmin: 60, label: 'Stage 2 — Mild', desc: 'Mildly decreased GFR' },
      { stage: '3a', eGFRmin: 45, label: 'Stage 3a — Mild–moderate', desc: 'Mild to moderate decrease' },
      { stage: '3b', eGFRmin: 30, label: 'Stage 3b — Moderate–severe', desc: 'Moderate to severe decrease' },
      { stage: '4', eGFRmin: 15, label: 'Stage 4 — Severe', desc: 'Severely decreased GFR' },
      { stage: '5', eGFRmin: 0, label: 'Stage 5 — Kidney failure', desc: 'eGFR < 15 or dialysis' },
    ],
    // Targets keyed by stage band. protein in g/kg ideal body weight/day.
    targetsByStage: {
      early: { stages: ['1', '2'], proteinGperKg: 0.8, energyKcalPerKg: 30, sodiumMg: 2300, potassiumMg: null, phosphorusMg: null, fluid: 'ad lib', note: 'Avoid high protein; control BP.' },
      mid:   { stages: ['3a', '3b'], proteinGperKg: 0.6, energyKcalPerKg: 30, sodiumMg: 2000, potassiumMg: 3000, phosphorusMg: 1000, fluid: 'ad lib unless overloaded', note: 'Low-protein diet may slow progression.' },
      late:  { stages: ['4'], proteinGperKg: 0.6, energyKcalPerKg: 30, sodiumMg: 1500, potassiumMg: 2500, phosphorusMg: 800, fluid: 'individualize', note: 'Restrict K/P; consider phosphate binders.' },
      esrd:  { stages: ['5'], proteinGperKg: 1.2, energyKcalPerKg: 30, sodiumMg: 1500, potassiumMg: 2000, phosphorusMg: 800, fluid: '1000 mL + urine output', note: 'Dialysis raises protein needs to 1.0–1.2 g/kg.' },
    },
    // Restriction filter triggers (food flagged AVOID when patient flag set)
    restrictionTriggers: {
      highPotassium: { nutrient: 'potassium', perPortionMg: 250, appliesWhen: 'potassiumMg restricted', label: 'High potassium' },
      highPhosphorus: { nutrient: 'phosphorus', perPortionMg: 150, appliesWhen: 'phosphorusMg restricted', label: 'High phosphorus' },
      highSodium: { nutrient: 'sodium', perPortionMg: 400, appliesWhen: 'always', label: 'High sodium' },
    },
  },

  Hepatic: {
    key: 'Hepatic',
    name: 'Hepatic Disease & Cirrhosis',
    nameAr: 'أمراض الكبد والتشمع',
    guideline: 'ESPEN Guideline on Clinical Nutrition in Liver Disease',
    guidelineVersion: 'ESPEN-Liver v1.0',
    keyLabs: ['Albumin', 'Bilirubin', 'INR', 'Ammonia', 'Sodium'],
    subtypes: [
      { key: 'compensated', label: 'Compensated cirrhosis', proteinGperKg: 1.2, energyKcalPerKg: 35, sodiumMg: 2000, note: 'Avoid protein restriction; prevent sarcopenia.' },
      { key: 'ascites', label: 'Cirrhosis with ascites', proteinGperKg: 1.2, energyKcalPerKg: 35, sodiumMg: 2000, fluid: 'restrict if hyponatraemic', note: 'Sodium restriction is key for ascites.' },
      { key: 'encephalopathy', label: 'Hepatic encephalopathy', proteinGperKg: 1.2, energyKcalPerKg: 35, sodiumMg: 2000, note: 'Do NOT restrict protein; favour vegetable/BCAA protein, late-evening snack.' },
    ],
    restrictionTriggers: {
      highSodium: { nutrient: 'sodium', perPortionMg: 400, appliesWhen: 'always', label: 'High sodium (ascites risk)' },
    },
  },

  Hyperlipidemia: {
    key: 'Hyperlipidemia',
    name: 'Hyperlipidemia',
    nameAr: 'فرط شحميات الدم',
    guideline: 'ACC/AHA Guideline on the Management of Blood Cholesterol',
    guidelineVersion: 'ACC-AHA v1.0',
    keyLabs: ['Total Cholesterol', 'LDL', 'HDL', 'Triglycerides'],
    riskCategories: [
      { key: 'mild', label: 'Mild', satFatPercentEnergy: 10, cholesterolMg: 300, note: 'Heart-healthy pattern, increase fibre.' },
      { key: 'moderate', label: 'Moderate', satFatPercentEnergy: 7, cholesterolMg: 200, note: 'Limit saturated fat to <7% energy.' },
      { key: 'severe', label: 'Severe', satFatPercentEnergy: 6, cholesterolMg: 150, note: 'Strict sat-fat/cholesterol limit; eliminate trans fat.' },
    ],
    restrictionTriggers: {
      highSatFat: { nutrient: 'satFat', perPortionG: 5, appliesWhen: 'always', label: 'High saturated fat' },
    },
  },

  IEM: {
    key: 'IEM',
    name: 'Inborn Errors of Metabolism',
    nameAr: 'الأخطاء الأيضية الخلقية',
    guideline: 'ACMG / SSIEM Nutrition Management Guidelines',
    guidelineVersion: 'ACMG-SSIEM v1.0',
    keyLabs: ['Plasma Amino Acids', 'Phenylalanine', 'Acylcarnitine', 'Ammonia'],
    critical: true,
    neonatalScreening: true,
    types: [
      { key: 'PKU', label: 'Phenylketonuria (PKU)', restrictedNutrient: 'phe', pheMaxMgPerKg: 20, note: 'Lifelong phenylalanine restriction; Phe-free formula provides protein.' },
      { key: 'MSUD', label: 'Maple Syrup Urine Disease', restrictedNutrient: 'bcaa', note: 'Restrict leucine/isoleucine/valine; BCAA-free formula.' },
      { key: 'OA', label: 'Organic Acidemias', restrictedNutrient: 'protein', note: 'Restrict natural protein; carnitine supplementation.' },
      { key: 'UCD', label: 'Urea Cycle Disorders', restrictedNutrient: 'protein', note: 'Restrict protein; nitrogen scavengers.' },
    ],
    restrictionTriggers: {
      // For PKU: any food with meaningful Phe is flagged; threshold low.
      highPhe: { nutrient: 'phe', perPortionMg: 75, appliesWhen: 'PKU', label: 'Contains phenylalanine' },
      highProtein: { nutrient: 'protein', perPortionG: 6, appliesWhen: 'OA,UCD,MSUD', label: 'High natural protein' },
    },
  },
};

/** Resolve CKD stage from eGFR. */
function ckdStageFromEgfr(egfr) {
  if (egfr == null) return null;
  for (const s of DISEASE_MODULES.CKD.stages) {
    if (egfr >= s.eGFRmin) return s.stage;
  }
  return '5';
}

/** Get the CKD target band for a stage. */
function ckdBandForStage(stage) {
  const bands = DISEASE_MODULES.CKD.targetsByStage;
  for (const key of Object.keys(bands)) {
    if (bands[key].stages.includes(String(stage))) return { band: key, ...bands[key] };
  }
  return null;
}

module.exports = { DISEASE_MODULES, ckdStageFromEgfr, ckdBandForStage };
