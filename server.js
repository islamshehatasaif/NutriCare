/**
 * NutriCare AI (Ghidhā'ī) — Consolidated Backend
 * AUC AI in Healthcare Capstone · Group 3
 *
 * Single entry point. Replaces backend-server{,-v2,-v3}.js.
 * Architecture mirrors the deck's safety pipeline:
 *   Patient inputs → deterministic rules (risk + targets) → restriction filter
 *   → GenAI/template draft → dietitian approval → audit log.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { db, audit } = require('./src/db');
const { FOODS } = require('./src/data/foods');
const { DISEASE_MODULES, ckdStageFromEgfr } = require('./src/data/diseaseModules');
const clinical = require('./src/rules/clinical');
const { buildProfile, screenFood, screenMeal } = require('./src/rules/restrictionFilter');
const { buildNote } = require('./src/rules/adime');
const { computeAdherence } = require('./src/rules/adherence');
const { analyze: analyzeInteractions } = require('./src/data/interactions');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const JWT_SECRET = process.env.JWT_SECRET || 'nutricare-secret-key-2025';
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── helpers ─────────────────────────────────────────────────────────
const uid = (p) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
const num = (v) => (v === '' || v == null || isNaN(+v)) ? null : +v;

/** Map a DB row into the rich patient object the rules engine expects. */
function enrich(row) {
  if (!row) return null;
  const age = clinical.calculateAge(row.birthday);
  const p = {
    id: row.id, userId: row.user_id, name: row.name, patientCode: row.patient_code,
    birthday: row.birthday, gender: row.gender, nationality: row.nationality, phone: row.phone,
    heightCm: row.height_cm, weightKg: row.weight_kg,
    diseaseModule: row.disease_module, ckdStage: row.ckd_stage, iemType: row.iem_type,
    hepaticSubtype: row.hepatic_subtype, lipidRisk: row.lipid_risk,
    diagnosis: row.diagnosis, chronicDiseases: row.chronic_diseases, allergies: row.allergies,
    medications: row.medications, familyHistory: row.family_history,
    egfr: row.egfr, potassium: row.potassium, phosphorus: row.phosphorus, albumin: row.albumin,
    crp: row.crp, hba1c: row.hba1c, ldl: row.ldl,
    weightLossPct: row.weight_loss_pct, intakePctOfNeeds: row.intake_pct,
    diagnosisSeverity: row.diagnosis_severity, icu: !!row.icu, sarcopenia: !!row.sarcopenia,
    adherence: row.adherence, neonatal: !!row.neonatal, updatedAt: row.updated_at,
    // lifestyle / clinical pillars
    activityLevel: row.activity_level, dietType: row.diet_type, sleepHours: row.sleep_hours,
    waterGoalMl: row.water_goal_ml, exerciseGoalMin: row.exercise_goal_min,
    systolic: row.systolic, diastolic: row.diastolic, bloodSugar: row.blood_sugar,
    smoking: row.smoking, alcohol: row.alcohol, stressLevel: row.stress_level,
    age: age ? age.years : null, ageDisplay: age ? age.display : null, ageBand: age ? age.band : null,
  };
  p.bmi = clinical.bmi(p.weightKg, p.heightCm);
  if (p.diseaseModule === 'CKD' && !p.ckdStage && p.egfr != null) p.ckdStage = ckdStageFromEgfr(p.egfr);
  return p;
}

/** Full clinical assessment: risk + targets + restriction profile. */
function assess(p) {
  const risk = clinical.malnutritionRisk(p);
  const targets = clinical.nutrientTargets(p);
  const profile = buildProfile(p);
  const recommendations = clinical.personalizedRecommendations(p);
  return { risk, targets, restrictionProfile: profile, recommendations };
}

function getPatientRow(id) { return db.prepare('SELECT * FROM patients WHERE id = ?').get(id); }
function broadcast(event, payload) { io.emit(event, payload); }

// ── auth middleware ─────────────────────────────────────────────────
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
}
function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next()
    : res.status(403).json({ error: 'Forbidden' });
}

// ════════════════ AUTH ════════════════
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password || '', user.password)) {
    audit(email, 'login-failed', 'auth');
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id);
  const token = jwt.sign({ userId: user.id, role: user.role, patientId: patient?.id }, JWT_SECRET, { expiresIn: '7d' });
  audit(user.email, 'login', 'auth');
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, patientId: patient?.id } });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name, role = 'patient', birthday, gender, nationality, phone } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name required' });
  const lc = email.toLowerCase().trim();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(lc)) return res.status(409).json({ error: 'Email already registered' });
  const userId = uid('user');
  db.prepare('INSERT INTO users (id, role, email, password, name, phone, verified, created_at) VALUES (?,?,?,?,?,?,1,?)')
    .run(userId, role, lc, bcrypt.hashSync(password, 10), name, phone, new Date().toISOString());
  let patientId = null;
  if (role === 'patient') {
    patientId = uid('patient');
    const age = clinical.calculateAge(birthday);
    db.prepare(`INSERT INTO patients (id, user_id, name, patient_code, birthday, gender, nationality, phone, neonatal, adherence, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(patientId, userId, name, 'NC-' + Date.now().toString().slice(-5), birthday, gender, nationality, phone,
        age && age.totalDays < 28 ? 1 : 0, 80, new Date().toISOString());
  }
  audit(lc, 'register', 'user', { role });
  const token = jwt.sign({ userId, role, patientId }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: userId, email: lc, name, role, patientId } });
});

// Password reset (demo: returns a token; production would email it)
app.post('/api/auth/forgot-password', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get((req.body.email || '').toLowerCase().trim());
  audit(req.body.email, 'password-reset-requested', 'auth');
  // Always 200 to avoid user enumeration
  res.json({ ok: true, message: 'If the account exists, a reset link has been sent.', demoToken: user ? jwt.sign({ uid: user.id, reset: true }, JWT_SECRET, { expiresIn: '1h' }) : null });
});

// ════════════════ PATIENTS ════════════════
app.get('/api/patients', auth, requireRole('physician', 'administrator'), (req, res) => {
  const rows = db.prepare('SELECT * FROM patients ORDER BY name').all();
  res.json(rows.map(r => { const p = enrich(r); return { ...p, assessment: assess(p) }; }));
});

app.get('/api/patients/:id', auth, (req, res) => {
  const p = enrich(getPatientRow(req.params.id));
  if (!p) return res.status(404).json({ error: 'Patient not found' });
  res.json({ ...p, assessment: assess(p) });
});

const PATIENT_FIELDS = {
  weightKg: 'weight_kg', heightCm: 'height_cm', gender: 'gender', nationality: 'nationality',
  diseaseModule: 'disease_module', ckdStage: 'ckd_stage', iemType: 'iem_type', hepaticSubtype: 'hepatic_subtype',
  lipidRisk: 'lipid_risk', diagnosis: 'diagnosis', chronicDiseases: 'chronic_diseases', allergies: 'allergies',
  medications: 'medications', familyHistory: 'family_history', egfr: 'egfr', potassium: 'potassium',
  phosphorus: 'phosphorus', albumin: 'albumin', crp: 'crp', hba1c: 'hba1c', ldl: 'ldl',
  weightLossPct: 'weight_loss_pct', intakePctOfNeeds: 'intake_pct', diagnosisSeverity: 'diagnosis_severity',
  icu: 'icu', sarcopenia: 'sarcopenia', adherence: 'adherence', phone: 'phone',
  // lifestyle / clinical pillars
  activityLevel: 'activity_level', dietType: 'diet_type', sleepHours: 'sleep_hours',
  waterGoalMl: 'water_goal_ml', exerciseGoalMin: 'exercise_goal_min', systolic: 'systolic',
  diastolic: 'diastolic', bloodSugar: 'blood_sugar', smoking: 'smoking', alcohol: 'alcohol', stressLevel: 'stress_level',
};
app.put('/api/patients/:id', auth, (req, res) => {
  const row = getPatientRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Patient not found' });
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(PATIENT_FIELDS)) {
    if (req.body[k] !== undefined) {
      let v = req.body[k];
      if (k === 'icu' || k === 'sarcopenia') v = v ? 1 : 0;
      sets.push(`${col} = ?`); vals.push(v);
    }
  }
  sets.push('updated_at = ?'); vals.push(new Date().toISOString());
  db.prepare(`UPDATE patients SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.id);
  const p = enrich(getPatientRow(req.params.id));
  audit(req.user.userId, 'update-patient', 'patient', req.params.id);
  broadcast('patient-updated', { patientId: p.id, patient: p, assessment: assess(p) });
  res.json({ ok: true, patient: p, assessment: assess(p) });
});

// Create a patient (physician "Add Patient")
app.post('/api/patients', auth, requireRole('physician', 'administrator'), (req, res) => {
  const b = req.body;
  if (!b.name || !b.birthday) return res.status(400).json({ error: 'name and birthday are required' });
  const id = uid('patient');
  const age = clinical.calculateAge(b.birthday);
  db.prepare(`INSERT INTO patients
    (id, name, patient_code, birthday, gender, nationality, phone, height_cm, weight_kg,
     disease_module, ckd_stage, iem_type, hepatic_subtype, lipid_risk, diagnosis, chronic_diseases,
     medications, allergies, family_history, egfr, potassium, phosphorus, albumin, crp, hba1c, ldl,
     weight_loss_pct, intake_pct, diagnosis_severity, adherence, neonatal,
     activity_level, diet_type, sleep_hours, water_goal_ml, exercise_goal_min,
     systolic, diastolic, blood_sugar, smoking, alcohol, stress_level, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, b.name, 'NC-' + Date.now().toString().slice(-5), b.birthday, b.gender, b.nationality, b.phone,
      num(b.heightCm), num(b.weightKg), b.diseaseModule || null, b.ckdStage || null, b.iemType || null,
      b.hepaticSubtype || null, b.lipidRisk || null, b.diagnosis || null, b.chronicDiseases || null,
      b.medications || null, b.allergies || null, b.familyHistory || null,
      num(b.egfr), num(b.potassium), num(b.phosphorus), num(b.albumin), num(b.crp), num(b.hba1c), num(b.ldl),
      num(b.weightLossPct) || 0, b.intakePctOfNeeds != null ? num(b.intakePctOfNeeds) : 100,
      num(b.diagnosisSeverity) || 0, num(b.adherence) || 80, (age && age.totalDays < 28) ? 1 : 0,
      b.activityLevel || null, b.dietType || null, num(b.sleepHours), num(b.waterGoalMl) || 2000,
      num(b.exerciseGoalMin) || 30, num(b.systolic), num(b.diastolic), num(b.bloodSugar),
      b.smoking || null, b.alcohol || null, num(b.stressLevel), new Date().toISOString());
  const p = enrich(getPatientRow(id));
  audit(req.user.userId, 'create-patient', 'patient', { id, name: b.name });
  broadcast('patient-created', { patient: p });
  res.json({ ok: true, patient: p, assessment: assess(p) });
});

// Delete a patient (and their dependent records)
app.delete('/api/patients/:id', auth, requireRole('physician', 'administrator'), (req, res) => {
  const row = getPatientRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Patient not found' });
  const tx = db.transaction((pid) => {
    for (const tbl of ['assessments', 'doctor_notes', 'exercise_logs', 'water_logs', 'food_logs', 'appointments', 'messages', 'ai_notes']) {
      db.prepare(`DELETE FROM ${tbl} WHERE patient_id = ?`).run(pid);
    }
    db.prepare('DELETE FROM patients WHERE id = ?').run(pid);
    if (row.user_id) db.prepare('DELETE FROM users WHERE id = ?').run(row.user_id);
  });
  tx(req.params.id);
  audit(req.user.userId, 'delete-patient', 'patient', { id: req.params.id, name: row.name });
  broadcast('patient-deleted', { patientId: req.params.id });
  res.json({ ok: true });
});

// ════════════════ RISK PREDICTION (manual input, no DB write) ════════════════
app.post('/api/risk/predict', auth, (req, res) => {
  const p = {
    name: req.body.name, gender: req.body.gender, birthday: req.body.birthday,
    age: req.body.age, heightCm: +req.body.heightCm || null, weightKg: +req.body.weightKg || null,
    weightLossPct: +req.body.weightLossPct || 0, intakePctOfNeeds: req.body.intakePctOfNeeds != null ? +req.body.intakePctOfNeeds : null,
    albumin: req.body.albumin != null ? +req.body.albumin : null, crp: req.body.crp != null ? +req.body.crp : null,
    diagnosisSeverity: +req.body.diagnosisSeverity || 0, icu: !!req.body.icu, sarcopenia: !!req.body.sarcopenia,
    diseaseModule: req.body.diseaseModule, egfr: req.body.egfr != null ? +req.body.egfr : null,
    potassium: req.body.potassium != null ? +req.body.potassium : null,
  };
  const risk = clinical.malnutritionRisk(p);
  const targets = clinical.nutrientTargets(p);
  const recommendations = clinical.personalizedRecommendations(p);
  audit(req.user.userId, 'risk-predict', 'risk', { name: p.name, score: risk.score });
  res.json({ risk, targets, recommendations, input: p });
});

// ════════════════ ASSESSMENT HISTORY (save / list / delete / export) ════════════════
app.post('/api/patients/:id/assessment', auth, (req, res) => {
  const p = enrich(getPatientRow(req.params.id));
  if (!p) return res.status(404).json({ error: 'Patient not found' });
  const a = assess(p);
  const id = uid('asmt');
  const ts = new Date().toISOString();
  db.prepare('INSERT INTO assessments (id, patient_id, score, tier, bmi, payload, created_by, ts) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, p.id, a.risk.score, a.risk.tier.key, p.bmi, JSON.stringify({ risk: a.risk, targets: a.targets, recommendations: a.recommendations, snapshot: { weightKg: p.weightKg, heightCm: p.heightCm, albumin: p.albumin, crp: p.crp } }), req.user.userId, ts);
  audit(req.user.userId, 'save-assessment', 'assessment', { patient: p.id, score: a.risk.score });
  broadcast('assessment-saved', { patientId: p.id, id });
  res.json({ ok: true, id, ts, assessment: a });
});
app.get('/api/patients/:id/assessments', auth, (req, res) => {
  const rows = db.prepare('SELECT id, score, tier, bmi, payload, ts FROM assessments WHERE patient_id = ? ORDER BY ts DESC').all(req.params.id);
  res.json(rows.map(r => ({ id: r.id, score: r.score, tier: r.tier, bmi: r.bmi, ts: r.ts, ...JSON.parse(r.payload || '{}') })));
});
app.delete('/api/assessments/:aid', auth, requireRole('physician', 'administrator'), (req, res) => {
  const r = db.prepare('DELETE FROM assessments WHERE id = ?').run(req.params.aid);
  audit(req.user.userId, 'delete-assessment', 'assessment', req.params.aid);
  res.json({ ok: true, deleted: r.changes });
});

// ════════════════ DOCTOR NOTES ════════════════
app.get('/api/patients/:id/doctor-notes', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM doctor_notes WHERE patient_id = ? ORDER BY ts DESC').all(req.params.id));
});
app.post('/api/patients/:id/doctor-notes', auth, requireRole('physician', 'administrator'), (req, res) => {
  if (!getPatientRow(req.params.id)) return res.status(404).json({ error: 'Patient not found' });
  if (!req.body.body || !req.body.body.trim()) return res.status(400).json({ error: 'Note text required' });
  const id = uid('dn');
  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.userId);
  db.prepare('INSERT INTO doctor_notes (id, patient_id, author, body, ts) VALUES (?,?,?,?,?)')
    .run(id, req.params.id, user ? user.name : req.user.userId, req.body.body.trim(), new Date().toISOString());
  audit(req.user.userId, 'add-note', 'doctor_note', req.params.id);
  res.json({ ok: true, note: db.prepare('SELECT * FROM doctor_notes WHERE id = ?').get(id) });
});
app.delete('/api/doctor-notes/:nid', auth, requireRole('physician', 'administrator'), (req, res) => {
  const r = db.prepare('DELETE FROM doctor_notes WHERE id = ?').run(req.params.nid);
  res.json({ ok: true, deleted: r.changes });
});

// ════════════════ FOLLOW-UP STATUS ════════════════
app.patch('/api/appointments/:id', auth, requireRole('physician', 'administrator'), (req, res) => {
  const status = req.body.status;
  if (!['scheduled', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, req.params.id);
  audit(req.user.userId, 'update-appointment', 'appointment', { id: req.params.id, status });
  broadcast('appointment-updated', { id: req.params.id, status });
  res.json({ ok: true });
});

// ════════════════ HEALTH ADHERENCE CALCULATOR ════════════════
function startOfTodayIso() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); }

function gatherAdherenceInputs(p) {
  const start = startOfTodayIso();
  const foodLogsToday = db.prepare('SELECT * FROM food_logs WHERE patient_id=? AND ts>=?').all(p.id, start);
  const minutesToday = db.prepare('SELECT COALESCE(SUM(duration),0) m FROM exercise_logs WHERE patient_id=? AND ts>=?').get(p.id, start).m;
  const waterMl = db.prepare('SELECT COALESCE(SUM(volume_ml),0) v FROM water_logs WHERE patient_id=? AND ts>=?').get(p.id, start).v;
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const medRows = db.prepare('SELECT * FROM medication_logs WHERE patient_id=? AND ts>=?').all(p.id, dayAgo);
  const meds = (p.medications || '').split(',').map(s => s.trim()).filter(Boolean);
  const targets = clinical.nutrientTargets(p);
  return {
    patient: p, targetKcal: targets.energyKcal, sodiumLimitMg: targets.sodiumMg,
    foodLogsToday, minutesToday, exerciseGoalMin: p.exerciseGoalMin || 30,
    waterMl, waterGoalMl: p.waterGoalMl || 2000, sleepHours: p.sleepHours, stressLevel: p.stressLevel,
    medScheduled: medRows.length, medTaken: medRows.filter(m => m.taken).length, hasMeds: meds.length > 0,
    isNew: foodLogsToday.length === 0 && minutesToday === 0 && waterMl === 0 && medRows.length === 0,
  };
}

// Patient logs that a medication dose was taken (real medication-adherence data)
app.post('/api/patients/:id/medication-log', auth, (req, res) => {
  if (!getPatientRow(req.params.id)) return res.status(404).json({ error: 'Patient not found' });
  const ts = new Date().toISOString();
  const id = uid('med');
  db.prepare('INSERT INTO medication_logs (id, patient_id, drug, scheduled_ts, taken, taken_ts, ts) VALUES (?,?,?,?,1,?,?)')
    .run(id, req.params.id, req.body.drug || 'medication', ts, ts, ts);
  broadcast('patient-activity', { patientId: req.params.id, table: 'medication_logs' });
  res.json({ ok: true, id });
});

// Calculate adherence: compute, persist to history, update patient, notify physicians
app.post('/api/patients/:id/adherence', auth, (req, res) => {
  const p = enrich(getPatientRow(req.params.id));
  if (!p) return res.status(404).json({ error: 'Patient not found' });
  const result = computeAdherence(gatherAdherenceInputs(p));
  const id = uid('adh'); const ts = new Date().toISOString();
  db.prepare('INSERT INTO adherence_scores (id, patient_id, overall, food, exercise, medication, lifestyle, category, breakdown, ts) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, p.id, result.overall, result.food, result.exercise, result.medication, result.lifestyle, result.category, JSON.stringify(result.breakdown), ts);
  db.prepare('UPDATE patients SET adherence = ? WHERE id = ?').run(result.overall, p.id);
  // Physician notification + risk flag on low adherence
  db.prepare('INSERT INTO notifications (id, audience, patient_id, type, body, read, ts) VALUES (?,?,?,?,?,0,?)')
    .run(uid('ntf'), 'physician', p.id, 'adherence', `New adherence report — ${p.name}: ${result.overall}% (${result.category})${result.riskFlag ? ' ⚠ LOW' : ''}`, ts);
  audit(req.user.userId, 'calculate-adherence', 'adherence', { patient: p.id, score: result.overall });
  broadcast('adherence-updated', { patientId: p.id, overall: result.overall, category: result.category, riskFlag: result.riskFlag, ts });
  broadcast('notification', { audience: 'physician', patientId: p.id });
  res.json({ ok: true, id, ts, result });
});

app.get('/api/patients/:id/adherence/history', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM adherence_scores WHERE patient_id=? ORDER BY ts ASC').all(req.params.id);
  res.json(rows.map(r => ({ ...r, breakdown: JSON.parse(r.breakdown || '{}') })));
});

// Doctor view: adherence ranking + non-compliant patients
app.get('/api/dashboard/adherence', auth, requireRole('physician', 'administrator'), (_req, res) => {
  const patients = db.prepare('SELECT * FROM patients').all().map(enrich);
  const list = patients.map(p => {
    const latest = db.prepare('SELECT overall, category, ts FROM adherence_scores WHERE patient_id=? ORDER BY ts DESC LIMIT 1').get(p.id);
    const prev = db.prepare('SELECT overall FROM adherence_scores WHERE patient_id=? ORDER BY ts DESC LIMIT 1 OFFSET 1').get(p.id);
    const score = latest ? latest.overall : (p.adherence || 0);
    return { id: p.id, name: p.name, module: p.diseaseModule, score, category: latest ? latest.category : (score > 75 ? 'High' : score >= 50 ? 'Medium' : 'Low'), trend: prev ? score - prev.overall : 0, lastTs: latest ? latest.ts : null };
  }).sort((a, b) => a.score - b.score);
  res.json({ ranking: list, nonCompliant: list.filter(x => x.score < 50), avg: list.length ? Math.round(list.reduce((s, x) => s + x.score, 0) / list.length) : 0 });
});

// Notifications (physician)
app.get('/api/notifications', auth, (req, res) => {
  const aud = req.user.role === 'patient' ? 'patient' : 'physician';
  res.json(db.prepare('SELECT * FROM notifications WHERE audience=? ORDER BY ts DESC LIMIT 30').all(aud));
});
app.post('/api/notifications/:id/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ════════════════ FOOD DB + RESTRICTION FILTER ════════════════
app.get('/api/foods', (req, res) => {
  const q = (req.query.search || '').toLowerCase().trim();
  const cat = req.query.category;
  let list = FOODS;
  if (q) list = list.filter(f => f.name.toLowerCase().includes(q) || (f.nameAr || '').includes(req.query.search));
  if (cat) list = list.filter(f => f.category === cat);
  // If patientId given, screen each food against that patient's restriction profile
  if (req.query.patientId) {
    const p = enrich(getPatientRow(req.query.patientId));
    if (p) {
      const profile = buildProfile(p);
      list = list.map(f => ({ ...f, screen: screenFood(f, profile, +req.query.grams || 100) }));
    }
  }
  res.json({ count: list.length, foods: list.slice(0, +req.query.limit || 200) });
});

app.get('/api/foods/categories', (_req, res) => {
  res.json([...new Set(FOODS.map(f => f.category))]);
});

// Screen an arbitrary meal (list of food ids/names) for a patient — the hard gate
app.post('/api/foods/screen', auth, (req, res) => {
  const p = enrich(getPatientRow(req.body.patientId));
  if (!p) return res.status(404).json({ error: 'Patient not found' });
  const foods = (req.body.foodIds || []).map(id => FOODS.find(f => f.id === id)).filter(Boolean);
  res.json(screenMeal(foods, p, +req.body.grams || 100));
});

// ════════════════ DISEASE MODULES ════════════════
app.get('/api/disease-modules', (_req, res) => res.json(DISEASE_MODULES));
app.get('/api/disease-modules/:key', (req, res) => {
  const m = DISEASE_MODULES[req.params.key];
  if (!m) return res.status(404).json({ error: 'Module not found' });
  res.json(m);
});

// ════════════════ ADIME NOTE (GenAI/template draft + approval) ════════════════
app.post('/api/patients/:id/adime', auth, async (req, res) => {
  const p = enrich(getPatientRow(req.params.id));
  if (!p) return res.status(404).json({ error: 'Patient not found' });
  const note = await buildNote(p, { useLLM: req.body.useLLM !== false });
  const id = uid('note');
  db.prepare('INSERT INTO ai_notes (id, patient_id, kind, content, approved, ts) VALUES (?,?,?,?,0,?)')
    .run(id, p.id, 'ADIME', note.text, new Date().toISOString());
  audit(req.user.userId, 'generate-adime', 'ai_note', { patient: p.id, generatedBy: note.generatedBy });
  res.json({ id, note });
});

app.post('/api/notes/:id/approve', auth, requireRole('physician', 'administrator'), (req, res) => {
  db.prepare('UPDATE ai_notes SET approved = 1, approved_by = ? WHERE id = ?').run(req.user.userId, req.params.id);
  audit(req.user.userId, 'approve-note', 'ai_note', req.params.id);
  broadcast('note-approved', { noteId: req.params.id });
  res.json({ ok: true });
});

app.get('/api/patients/:id/notes', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM ai_notes WHERE patient_id = ? ORDER BY ts DESC').all(req.params.id));
});

// ════════════════ LOGS: exercise / water / food ════════════════
function logRoute(table, cols, buildRow) {
  return (req, res) => {
    if (!getPatientRow(req.params.id)) return res.status(404).json({ error: 'Patient not found' });
    const row = buildRow(req);
    const placeholders = cols.map(() => '?').join(',');
    db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`).run(...cols.map(c => row[c]));
    broadcast('patient-activity', { patientId: req.params.id, table, row });
    res.json({ ok: true, row });
  };
}
app.post('/api/patients/:id/exercise', auth, logRoute('exercise_logs',
  ['id', 'patient_id', 'type', 'duration', 'intensity', 'calories', 'notes', 'ts'],
  (req) => ({ id: uid('ex'), patient_id: req.params.id, type: req.body.type, duration: req.body.duration, intensity: req.body.intensity, calories: req.body.calories, notes: req.body.notes || '', ts: new Date().toISOString() })));
app.post('/api/patients/:id/water', auth, logRoute('water_logs',
  ['id', 'patient_id', 'volume_ml', 'kind', 'ts'],
  (req) => ({ id: uid('w'), patient_id: req.params.id, volume_ml: req.body.volumeMl, kind: req.body.kind || 'water', ts: new Date().toISOString() })));
app.post('/api/patients/:id/food', auth, logRoute('food_logs',
  ['id', 'patient_id', 'food_name', 'grams', 'kcal', 'meal', 'ts'],
  (req) => ({ id: uid('fl'), patient_id: req.params.id, food_name: req.body.foodName, grams: req.body.grams, kcal: req.body.kcal, meal: req.body.meal || 'snack', ts: new Date().toISOString() })));

app.get('/api/patients/:id/logs', auth, (req, res) => {
  const id = req.params.id;
  res.json({
    exercise: db.prepare('SELECT * FROM exercise_logs WHERE patient_id = ? ORDER BY ts DESC LIMIT 50').all(id),
    water: db.prepare('SELECT * FROM water_logs WHERE patient_id = ? ORDER BY ts DESC LIMIT 50').all(id),
    food: db.prepare('SELECT * FROM food_logs WHERE patient_id = ? ORDER BY ts DESC LIMIT 50').all(id),
  });
});

// ════════════════ APPOINTMENTS ════════════════
app.get('/api/appointments', auth, (req, res) => {
  const id = req.query.patientId;
  const rows = id
    ? db.prepare('SELECT * FROM appointments WHERE patient_id = ? ORDER BY when_ts').all(id)
    : db.prepare('SELECT * FROM appointments ORDER BY when_ts').all();
  res.json(rows);
});
app.post('/api/appointments', auth, (req, res) => {
  const id = uid('appt');
  db.prepare('INSERT INTO appointments (id, patient_id, physician_id, when_ts, reason, status, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.body.patientId, req.body.physicianId || req.user.userId, req.body.whenTs, req.body.reason, 'scheduled', new Date().toISOString());
  broadcast('appointment-created', { id, patientId: req.body.patientId });
  audit(req.user.userId, 'create-appointment', 'appointment', id);
  res.json({ ok: true, id });
});

// ════════════════ MESSAGING (bidirectional sync) ════════════════
app.get('/api/messages/:patientId', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM messages WHERE patient_id = ? ORDER BY ts').all(req.params.patientId));
});
app.post('/api/messages/:patientId', auth, (req, res) => {
  const id = uid('msg');
  const sender = req.user.role === 'patient' ? 'patient' : 'physician';
  db.prepare('INSERT INTO messages (id, patient_id, sender, body, ts, read) VALUES (?,?,?,?,?,0)')
    .run(id, req.params.patientId, sender, req.body.body, new Date().toISOString());
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  broadcast('message', { patientId: req.params.patientId, message: msg });
  res.json({ ok: true, message: msg });
});

// ════════════════ PATIENT AI ASSISTANT (rules-grounded, bilingual) ════════════════
app.post('/api/assistant', auth, (req, res) => {
  const text = (req.body.message || '').toLowerCase();
  const lang = req.body.lang === 'ar' ? 'ar' : 'en';
  const p = req.body.patientId ? enrich(getPatientRow(req.body.patientId)) : null;
  res.json(answerAssistant(text, lang, p));
});

// ════════════════ FOOD–DRUG INTERACTIONS & MEDICATION REMINDERS ════════════════
app.get('/api/patients/:id/interactions', auth, (req, res) => {
  const p = enrich(getPatientRow(req.params.id));
  if (!p) return res.status(404).json({ error: 'Patient not found' });
  const analysis = analyzeInteractions(p.medications);
  // Cross-check: if the patient is on a potassium-raising drug AND a CKD/high-K
  // restriction profile, surface a combined dietary alert.
  const combined = [];
  if (p.diseaseModule === 'CKD' && analysis.warnings.some(w => w.nutrient === 'potassium')) {
    combined.push({ en: 'You take a potassium-raising medicine AND have kidney restrictions — be strict with high-potassium foods (bananas, oranges, potatoes, dates).',
      ar: 'تتناول دواءً يرفع البوتاسيوم ولديك قيود كلوية — التزم بتجنّب الأطعمة الغنية بالبوتاسيوم (الموز، البرتقال، البطاطس، التمر).', severity: 'high' });
  }
  res.json({ medications: p.medications || '', ...analysis, combinedAlerts: combined });
});

// ════════════════ PHYSICIAN AI ASSISTANT (clinical decision support, rules-grounded) ════════════════
app.post('/api/physician-assistant', auth, requireRole('physician', 'administrator'), async (req, res) => {
  const text = (req.body.message || '').toLowerCase();
  const p = req.body.patientId ? enrich(getPatientRow(req.body.patientId)) : null;
  const out = { reply: '', sources: [], data: null };

  if (p) {
    const a = assess(p);
    const mod = DISEASE_MODULES[p.diseaseModule];
    if (/risk|malnutrition|nrs|glim/.test(text)) {
      out.reply = `${p.name}: ${a.risk.explanation} NRS-2002 ${a.risk.nrs2002.score} (${a.risk.nrs2002.atRisk ? 'at risk' : 'not at risk'}); GLIM ${a.risk.glim.diagnosed ? 'criteria met' : 'not met'}.`;
      out.data = a.risk; if (mod) out.sources.push('NRS-2002 · GLIM 2019');
    } else if (/lab|interpret|albumin|potassium|egfr|crp/.test(text)) {
      out.reply = labInterpretation(p); if (mod) out.sources.push(mod.guideline);
    } else if (/target|protein|energy|diet|plan|sodium|fluid/.test(text)) {
      const t = a.targets;
      out.reply = `${p.name} targets — energy ${t.energyKcal} kcal, protein ${t.proteinG} g (${t.proteinGperKg} g/kg), Na <${t.sodiumMg} mg` + (t.potassiumMg ? `, K <${t.potassiumMg} mg` : '') + (t.phosphorusMg ? `, PO₄ <${t.phosphorusMg} mg` : '') + `, fluid ${t.fluid}.`;
      out.data = t; if (mod) out.sources.push(mod.guideline);
    } else if (/adime|note|document/.test(text)) {
      const note = await buildNote(p, { useLLM: req.body.useLLM !== false });
      out.reply = note.text; out.sources.push('ADIME / PES format');
    } else if (/food|eat|avoid|safe/.test(text)) {
      out.reply = foodGuidanceSummary(p); if (mod) out.sources.push(mod.guideline);
    } else {
      out.reply = `For ${p.name} (${p.diagnosis}) I can summarise: malnutrition risk, lab interpretation, nutrient targets, foods to favour/avoid, or draft an ADIME note. What would you like?`;
    }
  } else {
    out.reply = 'Select a patient, then ask me about their malnutrition risk, lab interpretation, nutrient targets, diet restrictions, or to draft an ADIME note. All outputs are guideline-grounded and require your sign-off.';
  }
  res.json(out);
});

function labInterpretation(p) {
  const out = [];
  if (p.albumin != null) out.push(`Albumin ${p.albumin} g/dL — ${p.albumin < 3.0 ? 'low (visceral protein depletion / inflammation)' : p.albumin < 3.5 ? 'mildly low' : 'normal'}`);
  if (p.crp != null) out.push(`CRP ${p.crp} mg/L — ${p.crp > 10 ? 'high inflammation' : p.crp > 5 ? 'mild inflammation' : 'normal'}`);
  if (p.potassium != null) out.push(`K⁺ ${p.potassium} mmol/L — ${p.potassium > 5.5 ? 'hyperkalaemia (restrict K, review meds)' : p.potassium > 5.0 ? 'high-normal' : 'normal'}`);
  if (p.egfr != null) out.push(`eGFR ${p.egfr} — CKD stage ${p.ckdStage || '?'}`);
  if (p.hba1c != null) out.push(`HbA1c ${p.hba1c}% — ${p.hba1c > 7 ? 'above target' : 'at target'}`);
  if (p.ldl != null) out.push(`LDL ${p.ldl} mg/dL — ${p.ldl > 100 ? 'above optimal' : 'optimal'}`);
  return `${p.name} labs: ` + (out.join('. ') || 'no labs recorded') + '.';
}
function foodGuidanceSummary(p) {
  const profile = buildProfile(p);
  if (!profile.limits.length) return `${p.name}: no specific food restrictions configured; follow a balanced, age-appropriate diet.`;
  return `${p.name} restriction profile (${p.diseaseModule}): ` + profile.limits.map(l => `limit ${l.nutrient}`).join(', ') + '. Use the food screen to check individual items.';
}

// ════════════════ REPORTS ════════════════
app.get('/api/patients/:id/report', auth, async (req, res) => {
  const p = enrich(getPatientRow(req.params.id));
  if (!p) return res.status(404).json({ error: 'Patient not found' });
  const a = assess(p);
  const note = await buildNote(p, { useLLM: false });
  const logs = {
    exercise: db.prepare('SELECT * FROM exercise_logs WHERE patient_id = ? ORDER BY ts DESC LIMIT 20').all(p.id),
    water: db.prepare('SELECT * FROM water_logs WHERE patient_id = ? ORDER BY ts DESC LIMIT 20').all(p.id),
  };
  audit(req.user.userId, 'generate-report', 'report', p.id);
  res.json({ patient: p, assessment: a, adime: note, logs, module: DISEASE_MODULES[p.diseaseModule] || null, generatedAt: new Date().toISOString() });
});

// ════════════════ DASHBOARD ════════════════
app.get('/api/dashboard/stats', auth, (_req, res) => {
  const rows = db.prepare('SELECT * FROM patients').all().map(enrich);
  const scored = rows.map(p => ({ p, r: clinical.malnutritionRisk(p) }));
  const byTier = { low: 0, moderate: 0, high: 0, critical: 0 };
  scored.forEach(s => byTier[s.r.tier.key]++);
  res.json({
    totalPatients: rows.length,
    neonatal: rows.filter(p => p.neonatal).length,
    highRisk: scored.filter(s => s.r.tier.key === 'high' || s.r.tier.key === 'critical').length,
    avgAdherence: rows.length ? Math.round(rows.reduce((s, p) => s + (p.adherence || 0), 0) / rows.length) : 0,
    riskTiers: byTier,
    diseaseBreakdown: rows.reduce((acc, p) => { acc[p.diseaseModule || 'None'] = (acc[p.diseaseModule || 'None'] || 0) + 1; return acc; }, {}),
    upcomingAppointments: db.prepare("SELECT COUNT(*) n FROM appointments WHERE status = 'scheduled'").get().n,
  });
});

app.get('/api/audit', auth, requireRole('administrator', 'physician'), (_req, res) => {
  res.json(db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100').all());
});

app.get('/api/health', (_req, res) => res.json({ ok: true, foods: FOODS.length, llm: !!process.env.ANTHROPIC_API_KEY }));

// ── WebSocket ───────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('join', (room) => socket.join(room));
});

// ── rules-grounded assistant (bilingual) ────────────────────────────
function answerAssistant(text, lang, p) {
  const t = (en, ar) => (lang === 'ar' ? ar : en);
  const sources = [];
  // Food question — screen against restriction profile
  const foodMatch = FOODS.find(f => text.includes(f.name.toLowerCase().split(' ')[0]));
  if (foodMatch && p) {
    const r = screenFood(foodMatch, buildProfile(p), 100);
    const verdict = r.verdict === 'avoid' ? t('AVOID', 'تجنّب') : r.verdict === 'caution' ? t('LIMIT', 'بحذر') : t('OK to eat', 'مسموح');
    const why = r.violations[0] ? r.violations[0].rule : t('within your limits', 'ضمن حدودك');
    sources.push(DISEASE_MODULES[p.diseaseModule]?.guideline);
    return { reply: t(`${foodMatch.name}: ${verdict}. ${why}.`, `${foodMatch.nameAr || foodMatch.name}: ${verdict}. ${why}.`), verdict: r.verdict, sources };
  }
  if (/water|ماء|hydrat/.test(text)) {
    return { reply: t('Aim to sip water steadily through the day. If you have kidney or liver fluid limits, follow the daily fluid target your dietitian set.',
      'احرص على شرب الماء بانتظام خلال اليوم. إذا كان لديك تقييد للسوائل بسبب الكلى أو الكبد، اتبع الهدف اليومي الذي حدده اختصاصي التغذية.'), sources };
  }
  if (/protein|بروتين/.test(text) && p) {
    const tg = clinical.nutrientTargets(p);
    return { reply: t(`Your protein target is about ${tg.proteinG} g/day (${tg.proteinGperKg} g/kg).`,
      `هدف البروتين لديك حوالي ${tg.proteinG} جم/يوم (${tg.proteinGperKg} جم/كجم).`), sources };
  }
  return { reply: t('I can help with foods to eat or avoid, water, protein targets, and your appointments. Your dietitian reviews all clinical advice.',
    'يمكنني المساعدة في الأطعمة المسموحة والممنوعة، والماء، وأهداف البروتين، ومواعيدك. يراجع اختصاصي التغذية كل النصائح السريرية.'), sources };
}

server.listen(PORT, () => {
  console.log(`\n  NutriCare AI (Ghidhā'ī) — Group 3`);
  console.log(`  HTTP + WebSocket: http://localhost:${PORT}`);
  console.log(`  DB: persistent SQLite  |  Foods: ${FOODS.length}  |  LLM: ${process.env.ANTHROPIC_API_KEY ? 'enabled' : 'template-only'}`);
  console.log(`  Login (physician): doctor@nutricare.sa / docpass123`);
  console.log(`  Login (patient):   faisal@nutricare.sa / password123\n`);
});

module.exports = { app, server };
