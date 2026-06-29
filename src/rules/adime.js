/**
 * NutriCare AI — ADIME / PES Note Generator (the "GenAI draft" layer)
 *
 * Per the deck's layered architecture: the deterministic engine computes ALL
 * numbers first; the LLM (if configured) only DRAFTS prose around those fixed
 * values and can never override them. Without an API key, a deterministic
 * template produces the same structured note — so the demo always works.
 *
 * System prompt (deck p.36): "Using ONLY the structured fields provided …
 *  Do not invent values; if a field is missing, write 'not provided'. Flag any
 *  value outside the safe range for the patient's condition."
 */

const { nutrientTargets, malnutritionRisk, bmi } = require('./clinical');

const SYSTEM_PROMPT =
  "You are a clinical-nutrition documentation assistant. Using ONLY the " +
  "structured fields provided (demographics, diagnoses, anthropometrics, labs, " +
  "intake, computed targets, risk score), draft an ADIME note (Assessment, " +
  "Diagnosis, Intervention, Monitoring/Evaluation). State the nutrition " +
  "diagnosis as a PES statement (Problem related to Etiology as evidenced by " +
  "Signs/Symptoms). Do not invent values; if a field is missing, write 'not " +
  "provided'. Flag any value outside the safe range for the patient's condition. " +
  "Do not change any numeric target — they are pre-computed and authoritative.";

function val(x, unit = '') { return (x == null || x === '') ? 'not provided' : `${x}${unit}`; }

/** Deterministic ADIME note — always available, no LLM required. */
function buildDeterministicNote(patient) {
  const targets = nutrientTargets(patient);
  const risk = malnutritionRisk(patient);
  const b = bmi(patient.weightKg, patient.heightCm);

  const assessment = [
    `Patient: ${val(patient.name)} | Age: ${val(patient.age, 'y')} | Sex: ${val(patient.gender)}`,
    `Dx: ${val(patient.diagnosis)} | Module: ${val(patient.diseaseModule)}`,
    `Anthropometrics: Wt ${val(patient.weightKg, ' kg')}, Ht ${val(patient.heightCm, ' cm')}, BMI ${val(b)}`,
    `Labs: albumin ${val(patient.albumin, ' g/dL')}, CRP ${val(patient.crp, ' mg/L')}, K⁺ ${val(patient.potassium, ' mmol/L')}, eGFR ${val(patient.egfr)}`,
    `Intake: ${val(patient.intakePctOfNeeds, '% of estimated needs')} | Weight change: ${val(patient.weightLossPct, '% loss')}`,
    `Malnutrition risk: ${risk.score}/100 (${risk.tier.label}); NRS-2002 ${risk.nrs2002.score}; GLIM ${risk.glim.diagnosed ? 'criteria met' : 'not met'}`,
  ].join('\n');

  // PES statement
  const problem = risk.tier.key === 'low' ? 'Adequate nutritional status' : 'Malnutrition (or risk of malnutrition)';
  const etiology = risk.glim.etiologic[0] || (patient.diseaseModule ? `${patient.diseaseModule}-related metabolic demand` : 'reduced intake');
  const signs = [risk.flags[0], b != null ? `BMI ${b}` : null].filter(Boolean).join(', ') || 'see assessment';
  const pes = `${problem} related to ${etiology} as evidenced by ${signs}.`;

  const intervention = [
    `Energy target: ${val(targets.energyKcal, ' kcal/day')} (${targets.energyKcalPerKg} kcal/kg)`,
    `Protein target: ${val(targets.proteinG, ' g/day')} (${targets.proteinGperKg} g/kg)`,
    `Sodium: <${val(targets.sodiumMg, ' mg/day')}` + (targets.potassiumMg ? ` | Potassium: <${targets.potassiumMg} mg/day` : '') + (targets.phosphorusMg ? ` | Phosphorus: <${targets.phosphorusMg} mg/day` : ''),
    `Fluid: ${val(targets.fluid)}`,
    `Plan: guideline-grounded meal plan via ${val(patient.diseaseModule)} module; restriction filter enforced on all foods.`,
  ].join('\n');

  const monitoring = [
    `Re-screen malnutrition risk: ${risk.tier.key === 'low' ? 'routine (weekly)' : risk.tier.key === 'moderate' ? 'within 48 h' : 'daily'}`,
    `Track: weight, intake %, ${patient.diseaseModule === 'CKD' ? 'K⁺/PO₄/eGFR' : patient.diseaseModule === 'Hepatic' ? 'albumin/ammonia/Na' : patient.diseaseModule === 'Hyperlipidemia' ? 'LDL/triglycerides' : 'plasma amino acids'}`,
    `Escalation: ${risk.tier.action}`,
  ].join('\n');

  return {
    generatedBy: 'deterministic-template',
    systemPrompt: SYSTEM_PROMPT,
    sections: { assessment, diagnosis: pes, intervention, monitoring },
    computed: { targets, risk },
    text: `ADIME NOTE — NutriCare AI (draft, pending dietitian approval)\n\n` +
      `A — ASSESSMENT\n${assessment}\n\n` +
      `D — DIAGNOSIS (PES)\n${pes}\n\n` +
      `I — INTERVENTION\n${intervention}\n\n` +
      `M/E — MONITORING & EVALUATION\n${monitoring}\n\n` +
      `⚠ AI-generated draft. Requires dietitian review and sign-off before entry into the patient record.`,
  };
}

/**
 * Optional LLM enhancement. If ANTHROPIC_API_KEY is set, sends the structured
 * fields + computed targets to Claude to draft richer prose — but the numeric
 * targets and risk score remain the deterministic ones (single source of truth).
 * Falls back silently to the deterministic note if no key / on error.
 */
async function buildNote(patient, { useLLM = true } = {}) {
  const det = buildDeterministicNote(patient);
  if (!useLLM || !process.env.ANTHROPIC_API_KEY) return det;
  try {
    const body = {
      model: process.env.NUTRICARE_LLM_MODEL || 'claude-opus-4-8',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content:
          `Structured fields (authoritative — do not change numbers):\n` +
          JSON.stringify({
            demographics: { name: patient.name, age: patient.age, gender: patient.gender },
            diagnosis: patient.diagnosis, module: patient.diseaseModule,
            anthropometrics: { weightKg: patient.weightKg, heightCm: patient.heightCm, bmi: det.computed.risk.bmi },
            labs: { albumin: patient.albumin, crp: patient.crp, potassium: patient.potassium, egfr: patient.egfr },
            intake: { intakePctOfNeeds: patient.intakePctOfNeeds, weightLossPct: patient.weightLossPct },
            computedTargets: det.computed.targets,
            malnutritionRisk: det.computed.risk,
          }, null, 2) +
          `\n\nDraft the ADIME note with a PES statement. Mark missing fields 'not provided'.`,
      }],
    };
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) return det;
    const data = await resp.json();
    const text = (data.content || []).map(c => c.text).join('\n').trim();
    if (!text) return det;
    return { ...det, generatedBy: 'llm+deterministic', text };
  } catch {
    return det; // graceful fallback — demo never breaks
  }
}

module.exports = { buildNote, buildDeterministicNote, SYSTEM_PROMPT };
