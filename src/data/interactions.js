/**
 * NutriCare AI — Food–Drug & Drug–Nutrient Interaction Knowledge Base
 *
 * Deterministic lookup (same philosophy as the rest of the engine: the rule
 * base is authoritative, the LLM never invents an interaction). Used by the
 * patient "Interactions & Reminders" tab to warn about food–drug clashes and
 * to schedule medication reminders.
 *
 * Each drug entry: class, reminder (when/how to take), and foodWarnings[]
 * (food/nutrient, risk, severity high|moderate|low) — bilingual EN/AR.
 */

const DRUGS = {
  lisinopril: {
    label: 'Lisinopril', class: 'ACE inhibitor',
    reminder: { en: 'Once daily, same time each day', ar: 'مرة يومياً في نفس الوقت' },
    foodWarnings: [
      { food: { en: 'High-potassium foods & salt substitutes', ar: 'الأطعمة الغنية بالبوتاسيوم وبدائل الملح' }, risk: { en: 'Can raise blood potassium to dangerous levels (hyperkalaemia)', ar: 'قد يرفع بوتاسيوم الدم لمستويات خطرة' }, severity: 'high', nutrient: 'potassium' },
    ],
  },
  enalapril: { alias: 'lisinopril' },
  ramipril: { alias: 'lisinopril' },
  losartan: { alias: 'lisinopril', label: 'Losartan', class: 'ARB' },
  spironolactone: {
    label: 'Spironolactone', class: 'Potassium-sparing diuretic',
    reminder: { en: 'With food, morning', ar: 'مع الطعام صباحاً' },
    foodWarnings: [
      { food: { en: 'High-potassium foods & salt substitutes', ar: 'الأطعمة الغنية بالبوتاسيوم وبدائل الملح' }, risk: { en: 'Adds to potassium retention — hyperkalaemia risk', ar: 'يزيد احتباس البوتاسيوم — خطر فرط البوتاسيوم' }, severity: 'high', nutrient: 'potassium' },
    ],
  },
  furosemide: {
    label: 'Furosemide', class: 'Loop diuretic',
    reminder: { en: 'Morning with food (avoid late doses — increases urination at night)', ar: 'صباحاً مع الطعام (تجنّب الجرعات المتأخرة)' },
    foodWarnings: [
      { food: { en: 'Low-potassium / low-magnesium intake', ar: 'انخفاض البوتاسيوم والمغنيسيوم' }, risk: { en: 'May deplete potassium & magnesium — watch for cramps/weakness', ar: 'قد يستنزف البوتاسيوم والمغنيسيوم' }, severity: 'moderate', nutrient: 'potassium' },
    ],
  },
  atorvastatin: {
    label: 'Atorvastatin', class: 'Statin',
    reminder: { en: 'Evening, once daily', ar: 'مساءً مرة يومياً' },
    foodWarnings: [
      { food: { en: 'Grapefruit / grapefruit juice', ar: 'الجريب فروت وعصيره' }, risk: { en: 'Raises drug level → muscle injury (myopathy) risk', ar: 'يرفع مستوى الدواء — خطر إصابة العضلات' }, severity: 'high' },
    ],
  },
  simvastatin: { alias: 'atorvastatin', label: 'Simvastatin', class: 'Statin' },
  metformin: {
    label: 'Metformin', class: 'Biguanide (antidiabetic)',
    reminder: { en: 'With meals to reduce stomach upset', ar: 'مع الوجبات لتقليل اضطراب المعدة' },
    foodWarnings: [
      { food: { en: 'Alcohol', ar: 'الكحول' }, risk: { en: 'Increases lactic acidosis risk', ar: 'يزيد خطر الحماض اللبني' }, severity: 'moderate' },
      { food: { en: 'Long-term use lowers Vitamin B12', ar: 'الاستخدام المطوّل يخفض فيتامين B12' }, risk: { en: 'Monitor B12; supplement if low', ar: 'راقب B12 وعوّضه عند النقص' }, severity: 'low', nutrient: 'b12' },
    ],
  },
  insulin: {
    label: 'Insulin glargine', class: 'Long-acting insulin',
    reminder: { en: 'Same time daily; do not skip meals after rapid insulin', ar: 'نفس الوقت يومياً؛ لا تفوّت الوجبات' },
    foodWarnings: [
      { food: { en: 'Skipping carbohydrate / meals', ar: 'تفويت الكربوهيدرات أو الوجبات' }, risk: { en: 'Hypoglycaemia (low blood sugar) risk', ar: 'خطر انخفاض السكر' }, severity: 'high' },
    ],
  },
  sevelamer: {
    label: 'Sevelamer (phosphate binder)', class: 'Phosphate binder',
    reminder: { en: 'Take WITH every meal — binds dietary phosphate', ar: 'يؤخذ مع كل وجبة — يرتبط بالفوسفات' },
    foodWarnings: [
      { food: { en: 'Taken on empty stomach', ar: 'تناوله على معدة فارغة' }, risk: { en: 'Will not work — must be taken with food', ar: 'لن يعمل — يجب تناوله مع الطعام' }, severity: 'moderate' },
    ],
  },
  'calcium carbonate': { alias: 'sevelamer', label: 'Calcium carbonate (binder)' },
  warfarin: {
    label: 'Warfarin', class: 'Anticoagulant',
    reminder: { en: 'Same time daily; keep vitamin-K intake steady', ar: 'نفس الوقت يومياً؛ حافظ على ثبات فيتامين K' },
    foodWarnings: [
      { food: { en: 'Sudden changes in leafy greens (Vitamin K)', ar: 'تغيّر مفاجئ في الخضار الورقية (فيتامين K)' }, risk: { en: 'Alters blood-thinning effect (INR swings)', ar: 'يغيّر تأثير السيولة' }, severity: 'high' },
    ],
  },
  levothyroxine: {
    label: 'Levothyroxine', class: 'Thyroid hormone',
    reminder: { en: 'Empty stomach, 30–60 min before breakfast', ar: 'معدة فارغة قبل الإفطار بـ30-60 دقيقة' },
    foodWarnings: [
      { food: { en: 'Calcium, iron, coffee, soy near dosing', ar: 'الكالسيوم والحديد والقهوة قرب الجرعة' }, risk: { en: 'Reduce absorption — separate by 4 hours', ar: 'تقلل الامتصاص — افصل 4 ساعات' }, severity: 'moderate' },
    ],
  },
  lactulose: {
    label: 'Lactulose', class: 'Ammonia-lowering laxative',
    reminder: { en: 'As prescribed; titrate to 2–3 soft stools/day', ar: 'حسب الوصفة للوصول لـ2-3 برازات لينة يومياً' },
    foodWarnings: [],
  },
  sapropterin: {
    label: 'Sapropterin (Kuvan)', class: 'PKU cofactor',
    reminder: { en: 'With a meal, same time daily', ar: 'مع وجبة في نفس الوقت يومياً' },
    foodWarnings: [
      { food: { en: 'Still requires phenylalanine-restricted diet', ar: 'يتطلب نظاماً مقيّداً للفينيل ألانين' }, risk: { en: 'Does not replace dietary Phe control', ar: 'لا يغني عن ضبط الفينيل ألانين الغذائي' }, severity: 'high', nutrient: 'phe' },
    ],
  },
  amlodipine: {
    label: 'Amlodipine', class: 'Calcium-channel blocker',
    reminder: { en: 'Once daily, same time', ar: 'مرة يومياً نفس الوقت' },
    foodWarnings: [
      { food: { en: 'Grapefruit (mild)', ar: 'الجريب فروت (خفيف)' }, risk: { en: 'May slightly raise drug level', ar: 'قد يرفع مستوى الدواء قليلاً' }, severity: 'low' },
    ],
  },
};

function resolve(name) {
  let key = name.trim().toLowerCase();
  let entry = DRUGS[key];
  if (!entry) { // partial match (e.g., "lisinopril 10mg")
    key = Object.keys(DRUGS).find(k => name.toLowerCase().includes(k));
    entry = key ? DRUGS[key] : null;
  }
  if (entry && entry.alias) {
    const base = DRUGS[entry.alias];
    return { ...base, ...entry, label: entry.label || base.label, class: entry.class || base.class };
  }
  return entry;
}

/** medicationsCsv: comma-separated medication string from the patient record. */
function analyze(medicationsCsv) {
  const meds = (medicationsCsv || '').split(',').map(s => s.trim()).filter(Boolean);
  const reminders = [], warnings = [];
  for (const m of meds) {
    const d = resolve(m);
    if (!d) { reminders.push({ drug: m, class: 'Unknown', reminder: { en: 'Take as prescribed', ar: 'حسب الوصفة' } }); continue; }
    reminders.push({ drug: d.label, class: d.class, reminder: d.reminder });
    for (const w of (d.foodWarnings || [])) warnings.push({ drug: d.label, ...w });
  }
  warnings.sort((a, b) => ({ high: 0, moderate: 1, low: 2 }[a.severity] - { high: 0, moderate: 1, low: 2 }[b.severity]));
  return { meds, reminders, warnings, hasHigh: warnings.some(w => w.severity === 'high') };
}

module.exports = { analyze, DRUGS };
