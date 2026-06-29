/**
 * NutriCare AI — end-to-end API smoke test (no external test framework).
 * Boots the server on a throwaway port + temp DB, exercises the critical
 * paths, and asserts the clinical engine behaves. Run: `npm test`.
 */
const path = require('path');
const fs = require('fs');

const PORT = 3999;
const TMP_DB = path.join(__dirname, 'smoke.db');
['', '-wal', '-shm'].forEach(s => { try { fs.unlinkSync(TMP_DB + s); } catch {} });
process.env.PORT = PORT;
process.env.NUTRICARE_DB = TMP_DB;

const base = `http://localhost:${PORT}/api`;
let pass = 0, fail = 0;
function ok(name, cond) { cond ? (pass++, console.log('  ✓', name)) : (fail++, console.error('  ✗', name)); }
async function j(p, opts = {}, token) {
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
  const r = await fetch(base + p, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

(async () => {
  const { server } = require('../server');
  await new Promise(r => setTimeout(r, 800));
  try {
    const health = await j('/health');
    ok('health endpoint', health.data.ok === true);

    const login = await j('/auth/login', { method: 'POST', body: { email: 'doctor@nutricare.sa', password: 'docpass123' } });
    ok('physician login returns token', !!login.data.token);
    const tok = login.data.token;

    const badLogin = await j('/auth/login', { method: 'POST', body: { email: 'doctor@nutricare.sa', password: 'wrong' } });
    ok('bad password rejected (401)', badLogin.status === 401);

    const reg = await j('/auth/register', { method: 'POST', body: { name: 'Smoke Test', email: `smoke${Date.now()}@x.com`, password: 'pw12345', role: 'patient', birthday: '2000-01-01' } });
    ok('registration creates patient + token', !!reg.data.token && !!reg.data.user.patientId);

    const forgot = await j('/auth/forgot-password', { method: 'POST', body: { email: 'doctor@nutricare.sa' } });
    ok('password reset responds ok', forgot.data.ok === true);

    const patients = await j('/patients', {}, tok);
    ok('patient list returns 9 seeded', Array.isArray(patients.data) && patients.data.length >= 9);
    ok('seed includes neonates', patients.data.filter(p => p.neonatal).length >= 2);
    const cirr = patients.data.find(p => p.diseaseModule === 'Hepatic' && p.weightLossPct >= 10); // Layla
    ok('cirrhosis patient flagged High/Critical', cirr && ['high', 'critical'].includes(cirr.assessment.risk.tier.key));
    ok('GLIM criteria met for cirrhosis patient', cirr && cirr.assessment.risk.glim.diagnosed === true);
    ok('targets computed (protein > 0)', cirr && cirr.assessment.targets.proteinG > 0);

    // New features
    const created = await j('/patients', { method: 'POST', body: { name: 'Smoke Baby', birthday: '2026-06-15', gender: 'male', heightCm: 50, weightKg: 3.2, diseaseModule: 'IEM', iemType: 'PKU' } }, tok);
    ok('Add Patient creates neonate with pediatric energy', created.data.patient.neonatal && created.data.assessment.targets.energyKcal > 250);
    const interx = await j('/patients/patient-1/interactions', {}, tok);
    ok('food-drug interactions + reminders returned', interx.data.warnings.length > 0 && interx.data.reminders.length > 0);
    ok('CKD+potassium combined alert fires', interx.data.combinedAlerts.length > 0);
    const phys = await j('/physician-assistant', { method: 'POST', body: { patientId: 'patient-2', message: 'interpret labs' } }, tok);
    ok('physician AI assistant responds', typeof phys.data.reply === 'string' && phys.data.reply.includes('Albumin'));

    const auth401 = await j('/patients');
    ok('protected route blocks no-token (401)', auth401.status === 401);

    const risk = await j('/risk/predict', { method: 'POST', body: { name: 'X', weightKg: 45, heightCm: 170, weightLossPct: 15, intakePctOfNeeds: 30, albumin: 2.4, crp: 20, icu: true } }, tok);
    ok('manual risk predict → critical (>=80)', risk.data.risk.score >= 80);
    ok('risk explanation present', typeof risk.data.risk.explanation === 'string' && risk.data.risk.explanation.length > 10);

    const foods = await j('/foods?search=banana&patientId=patient-1', {}, tok);
    const banana = foods.data.foods.find(f => f.name === 'Banana');
    ok('banana AVOID for hyperkalaemic CKD patient', banana && banana.screen.verdict === 'avoid');
    ok('restriction violation cites a rule', banana && banana.screen.violations[0].rule.includes('potassium'));

    const adime = await j('/patients/patient-2/adime', { method: 'POST', body: { useLLM: false } }, tok);
    ok('ADIME note generated with PES', adime.data.note.text.includes('PES') || adime.data.note.sections.diagnosis.includes('related to'));

    const approve = await j(`/notes/${adime.data.id}/approve`, { method: 'POST' }, tok);
    ok('note approval works', approve.data.ok === true);

    const msg = await j('/messages/patient-1', { method: 'POST', body: { body: 'smoke test message' } }, tok);
    ok('message posts + syncs', msg.data.ok === true);

    const report = await j('/patients/patient-1/report', {}, tok);
    ok('report generates with assessment + adime', !!report.data.assessment && !!report.data.adime);

    const stats = await j('/dashboard/stats', {}, tok);
    ok('dashboard stats compute', stats.data.totalPatients >= 6 && stats.data.riskTiers);

    const modules = await j('/disease-modules');
    ok('4 disease modules present', Object.keys(modules.data).length === 4);
  } catch (e) {
    fail++; console.error('  ✗ exception:', e.message);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  server.close();
  ['', '-wal', '-shm'].forEach(s => { try { fs.unlinkSync(TMP_DB + s); } catch {} });
  process.exit(fail ? 1 : 0);
})();
