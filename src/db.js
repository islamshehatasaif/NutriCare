/**
 * NutriCare AI — Persistent data store (SQLite via better-sqlite3)
 *
 * Replaces the previous in-memory object. Data survives server restarts
 * (deck requirement: "Data must persist after server restarts").
 * Includes an audit_logs table per the governance/PDPL framing.
 */

const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { calculateAge } = require('./rules/clinical');

const DB_PATH = process.env.NUTRICARE_DB || path.join(__dirname, '..', 'nutricare.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, role TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, name TEXT, phone TEXT, specialization TEXT,
      verified INTEGER DEFAULT 1, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY, user_id TEXT, name TEXT, patient_code TEXT,
      birthday TEXT, gender TEXT, nationality TEXT, phone TEXT,
      height_cm REAL, weight_kg REAL,
      disease_module TEXT, ckd_stage TEXT, iem_type TEXT, hepatic_subtype TEXT, lipid_risk TEXT,
      diagnosis TEXT, chronic_diseases TEXT, allergies TEXT, medications TEXT, family_history TEXT,
      egfr REAL, potassium REAL, phosphorus REAL, albumin REAL, crp REAL, hba1c REAL, ldl REAL,
      weight_loss_pct REAL DEFAULT 0, intake_pct REAL DEFAULT 100, diagnosis_severity INTEGER DEFAULT 0,
      icu INTEGER DEFAULT 0, sarcopenia INTEGER DEFAULT 0,
      adherence REAL DEFAULT 80, neonatal INTEGER DEFAULT 0,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS exercise_logs (
      id TEXT PRIMARY KEY, patient_id TEXT, type TEXT, duration INTEGER,
      intensity TEXT, calories INTEGER, notes TEXT, ts TEXT
    );
    CREATE TABLE IF NOT EXISTS water_logs (
      id TEXT PRIMARY KEY, patient_id TEXT, volume_ml INTEGER, kind TEXT, ts TEXT
    );
    CREATE TABLE IF NOT EXISTS food_logs (
      id TEXT PRIMARY KEY, patient_id TEXT, food_name TEXT, grams REAL,
      kcal REAL, meal TEXT, ts TEXT
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY, patient_id TEXT, physician_id TEXT, when_ts TEXT,
      reason TEXT, status TEXT DEFAULT 'scheduled', created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, patient_id TEXT, sender TEXT, body TEXT, ts TEXT, read INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS ai_notes (
      id TEXT PRIMARY KEY, patient_id TEXT, kind TEXT, content TEXT,
      approved INTEGER DEFAULT 0, approved_by TEXT, ts TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT, action TEXT,
      entity TEXT, detail TEXT, ts TEXT
    );
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY, patient_id TEXT, score INTEGER, tier TEXT,
      bmi REAL, payload TEXT, created_by TEXT, ts TEXT
    );
    CREATE TABLE IF NOT EXISTS doctor_notes (
      id TEXT PRIMARY KEY, patient_id TEXT, author TEXT, body TEXT, ts TEXT
    );
    CREATE TABLE IF NOT EXISTS medication_logs (
      id TEXT PRIMARY KEY, patient_id TEXT, drug TEXT, scheduled_ts TEXT,
      taken INTEGER DEFAULT 0, taken_ts TEXT, ts TEXT
    );
    CREATE TABLE IF NOT EXISTS adherence_scores (
      id TEXT PRIMARY KEY, patient_id TEXT, overall INTEGER, food INTEGER,
      exercise INTEGER, medication INTEGER, lifestyle INTEGER, category TEXT,
      breakdown TEXT, ts TEXT
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, audience TEXT, patient_id TEXT, type TEXT, body TEXT,
      read INTEGER DEFAULT 0, ts TEXT
    );
  `);
  migratePatientPillars();
}

// Add the lifestyle/clinical "pillar" columns to an existing patients table
// without wiping data (SQLite has no ADD COLUMN IF NOT EXISTS).
function migratePatientPillars() {
  const cols = new Set(db.prepare('PRAGMA table_info(patients)').all().map(c => c.name));
  const add = [
    ['activity_level', 'TEXT'], ['diet_type', 'TEXT'], ['sleep_hours', 'REAL'],
    ['water_goal_ml', 'INTEGER DEFAULT 2000'], ['exercise_goal_min', 'INTEGER DEFAULT 30'],
    ['systolic', 'INTEGER'], ['diastolic', 'INTEGER'], ['blood_sugar', 'REAL'],
    ['smoking', 'TEXT'], ['alcohol', 'TEXT'], ['stress_level', 'INTEGER'],
  ];
  for (const [name, type] of add) {
    if (!cols.has(name)) db.exec(`ALTER TABLE patients ADD COLUMN ${name} ${type}`);
  }
}

function audit(actor, action, entity, detail = '') {
  db.prepare(`INSERT INTO audit_logs (actor, action, entity, detail, ts) VALUES (?,?,?,?,?)`)
    .run(actor || 'system', action, entity, typeof detail === 'string' ? detail : JSON.stringify(detail), new Date().toISOString());
}

// ── Seed (idempotent) ───────────────────────────────────────────────
function seed() {
  const count = db.prepare('SELECT COUNT(*) n FROM users').get().n;
  if (count > 0) return;
  const now = new Date().toISOString();

  const users = [
    // Patients (random names; logins kept simple)
    ['user-1', 'patient', 'faisal@nutricare.sa', 'password123', 'Faisal Al-Harbi', '+966501234567', null],
    ['user-2', 'patient', 'layla@nutricare.sa', 'password123', 'Layla Mahmoud', '+966509876543', null],
    ['user-3', 'patient', 'hessa@nutricare.sa', 'password123', 'Hessa Al-Otaibi', '+966502222222', null],
    ['user-4', 'patient', 'reem@nutricare.sa', 'password123', 'Reem Al-Anezi', '+966503333333', null],
    ['user-5', 'patient', 'maha@nutricare.sa', 'password123', 'Maha Al-Dosari', '+966504444444', null],
    ['user-6', 'patient', 'saud@nutricare.sa', 'password123', 'Saud Al-Mutairi', '+966505555555', null],
    ['user-7', 'patient', 'omar.baby@nutricare.sa', 'password123', 'Baby Omar Al-Ghamdi', '+966506666666', null],
    ['user-8', 'patient', 'maryam.baby@nutricare.sa', 'password123', 'Baby Maryam Al-Qahtani', '+966507777777', null],
    ['user-9', 'patient', 'tariq@nutricare.sa', 'password123', 'Tariq Mansour', '+966508888888', null],
    // Clinical team (NutriCare AI — Group 3). Primary login: doctor@nutricare.sa
    ['doctor-1', 'physician', 'doctor@nutricare.sa', 'docpass123', 'Dr. Islam Shehata', null, 'Clinical Dietitian'],
    ['doctor-2', 'physician', 'shady@nutricare.sa', 'docpass123', 'Dr. Shady Saleh', null, 'Physician'],
    ['doctor-3', 'physician', 'alaa@nutricare.sa', 'docpass123', 'Dr. Alaa Elddin Abdelfattah', null, 'Nephrologist'],
    ['doctor-4', 'physician', 'eman@nutricare.sa', 'docpass123', 'Dr. Eman Salah', null, 'Nutritionist'],
    ['doctor-5', 'physician', 'nadine@nutricare.sa', 'docpass123', 'Dr. Nadine Mohsen', null, 'Clinical Dietitian'],
    ['doctor-6', 'physician', 'ahmed@nutricare.sa', 'docpass123', 'Dr. Ahmed Eltayeb', null, 'Physician'],
    ['admin-1', 'administrator', 'admin@nutricare.sa', 'adminpass123', 'System Administrator', null, null],
  ];
  const insU = db.prepare(`INSERT INTO users (id, role, email, password, name, phone, specialization, created_at) VALUES (?,?,?,?,?,?,?,?)`);
  for (const u of users) insU.run(u[0], u[1], u[2], bcrypt.hashSync(u[3], 10), u[4], u[5], u[6], now);

  // Patients with full clinical fields needed by the risk engine
  const patients = [
    { id: 'patient-1', user_id: 'user-1', name: 'Faisal Al-Harbi', code: 'NC-1001', birthday: '1990-06-15', gender: 'male', nationality: 'Saudi', height: 175, weight: 82, module: 'CKD', ckd: '3b', egfr: 38, potassium: 5.2, phosphorus: 4.8, albumin: 3.4, crp: 6, diagnosis: 'Chronic Kidney Disease Stage 3b', chronic: 'Hypertension', meds: 'Lisinopril 10mg, Sevelamer, Furosemide 40mg', allergies: 'Penicillin', family: 'Father — CKD; Mother — Hypertension', wlp: 4, intake: 80, sev: 1, adherence: 78 },
    { id: 'patient-2', user_id: 'user-2', name: 'Layla Mahmoud', code: 'NC-1002', birthday: '1988-03-20', gender: 'female', nationality: 'Egyptian', height: 165, weight: 58, module: 'Hepatic', sub: 'ascites', albumin: 2.8, crp: 12, diagnosis: 'Cirrhosis with ascites (Child–Pugh B)', chronic: 'Hepatitis C', meds: 'Spironolactone 100mg, Lactulose, Furosemide 20mg', allergies: 'None', family: 'Brother — Hepatitis C', wlp: 12, intake: 55, sev: 2, adherence: 82 },
    { id: 'patient-3', user_id: 'user-3', name: 'Hessa Al-Otaibi', code: 'NC-1003', birthday: '1962-06-27', gender: 'female', nationality: 'Saudi', height: 162, weight: 82, module: 'CKD', ckd: '4', egfr: 22, potassium: 5.6, phosphorus: 5.5, albumin: 3.1, crp: 8, hba1c: 8.4, diagnosis: 'CKD Stage 4 + Type 2 Diabetes', chronic: 'Type 2 Diabetes, Hypertension', meds: 'Metformin 1000mg, Lisinopril 20mg, Insulin glargine', allergies: 'Sulfa drugs', family: 'Mother — Diabetes; Father — CKD', wlp: 6, intake: 70, sev: 2, adherence: 62 },
    { id: 'patient-4', user_id: 'user-4', name: 'Reem Al-Anezi', code: 'NC-1004', birthday: '1986-11-10', gender: 'female', nationality: 'Saudi', height: 165, weight: 72, module: 'Hyperlipidemia', lipid: 'moderate', ldl: 178, diagnosis: 'Hyperlipidemia — moderate risk', chronic: 'None', meds: 'Atorvastatin 20mg', allergies: 'None', family: 'Father — early heart disease', wlp: 0, intake: 100, sev: 0, adherence: 92 },
    { id: 'patient-5', user_id: 'user-5', name: 'Maha Al-Dosari', code: 'NC-1005', birthday: '2023-03-15', gender: 'female', nationality: 'Saudi', height: 92, weight: 13, module: 'IEM', iem: 'PKU', diagnosis: 'Phenylketonuria (PKU) — diagnosed on newborn screening', chronic: 'PKU', meds: 'Sapropterin, Phe-free formula', allergies: 'None', family: 'Consanguineous parents; sibling — carrier', wlp: 0, intake: 95, sev: 2, adherence: 98 },
    { id: 'patient-6', user_id: 'user-6', name: 'Saud Al-Mutairi', code: 'NC-1006', birthday: '1971-09-03', gender: 'male', nationality: 'Saudi', height: 172, weight: 88, module: 'CKD', ckd: '2', egfr: 72, potassium: 4.4, phosphorus: 3.6, albumin: 4.0, crp: 2, diagnosis: 'CKD Stage 2 + Hypertension', chronic: 'Hypertension', meds: 'Amlodipine 5mg', allergies: 'None', family: 'Father — Hypertension', wlp: 0, intake: 100, sev: 0, adherence: 85 },
    // ── 3 new patients (incl. 2 neonates) ──
    { id: 'patient-7', user_id: 'user-7', name: 'Baby Omar Al-Ghamdi', code: 'NC-1007', birthday: '2026-06-08', gender: 'male', nationality: 'Saudi', height: 53, weight: 4.1, module: 'IEM', iem: 'MSUD', diagnosis: 'Maple Syrup Urine Disease (MSUD) — newborn-screen positive', chronic: 'MSUD', meds: 'BCAA-free formula', allergies: 'None', family: 'Consanguineous parents', wlp: 0, intake: 90, sev: 3, adherence: 96, neonatal: 1 },
    { id: 'patient-8', user_id: 'user-8', name: 'Baby Maryam Al-Qahtani', code: 'NC-1008', birthday: '2026-06-12', gender: 'female', nationality: 'Saudi', height: 51, weight: 3.4, module: null, diagnosis: 'Healthy term neonate — feeding & growth monitoring', chronic: 'None', meds: 'Vitamin D drops', allergies: 'None', family: 'Unremarkable', wlp: 0, intake: 100, sev: 0, adherence: 100, neonatal: 1 },
    { id: 'patient-9', user_id: 'user-9', name: 'Tariq Mansour', code: 'NC-1009', birthday: '1995-02-10', gender: 'male', nationality: 'Egyptian', height: 178, weight: 104, module: 'Hepatic', sub: 'compensated', albumin: 3.8, crp: 4, diagnosis: 'NAFLD / compensated steatohepatitis + obesity', chronic: 'Obesity, Prediabetes', meds: 'None', allergies: 'None', family: 'Father — fatty liver', wlp: 0, intake: 110, sev: 1, adherence: 70 },
  ];
  const insP = db.prepare(`INSERT INTO patients
    (id, user_id, name, patient_code, birthday, gender, nationality, height_cm, weight_kg,
     disease_module, ckd_stage, iem_type, hepatic_subtype, lipid_risk, diagnosis, chronic_diseases,
     medications, allergies, family_history,
     egfr, potassium, phosphorus, albumin, crp, hba1c, ldl,
     weight_loss_pct, intake_pct, diagnosis_severity, adherence, neonatal, updated_at)
    VALUES (@id,@user_id,@name,@code,@birthday,@gender,@nationality,@height,@weight,
            @module,@ckd,@iem,@sub,@lipid,@diagnosis,@chronic,
            @meds,@allergies,@family,
            @egfr,@potassium,@phosphorus,@albumin,@crp,@hba1c,@ldl,
            @wlp,@intake,@sev,@adherence,@neonatal,@now)`);
  for (const p of patients) {
    insP.run({
      ckd: null, iem: null, sub: null, lipid: null, egfr: null, potassium: null, phosphorus: null,
      albumin: null, crp: null, hba1c: null, ldl: null, neonatal: 0,
      meds: null, allergies: null, family: null, ...p, now,
    });
  }

  // A couple of appointments + messages for demo realism
  const insA = db.prepare(`INSERT INTO appointments (id, patient_id, physician_id, when_ts, reason, status, created_at) VALUES (?,?,?,?,?,?,?)`);
  insA.run('appt-1', 'patient-1', 'doctor-1', new Date(Date.now() + 86400000).toISOString(), 'CKD diet follow-up', 'scheduled', now);
  insA.run('appt-2', 'patient-3', 'doctor-3', new Date(Date.now() + 2 * 86400000).toISOString(), 'Renal + glycaemic review', 'scheduled', now);
  insA.run('appt-3', 'patient-7', 'doctor-4', new Date(Date.now() + 3 * 3600000).toISOString(), 'Neonatal MSUD urgent review', 'scheduled', now);
  const insM = db.prepare(`INSERT INTO messages (id, patient_id, sender, body, ts, read) VALUES (?,?,?,?,?,?)`);
  insM.run('msg-1', 'patient-1', 'physician', 'Hi Faisal — please keep potassium foods low this week and log your meals.', now, 0);
  insM.run('msg-2', 'patient-1', 'patient', 'Thank you Doctor, I will. My weight is stable.', now, 1);

  audit('system', 'seed', 'database', `seeded ${users.length} users, ${patients.length} patients`);
}

// Backfill lifestyle pillars + medication/adherence demo data (idempotent —
// runs for any seeded patient missing it, so it also enriches an existing DB
// without wiping user data).
function seedDemoExtras() {
  const pillars = {
    'patient-1': { activity_level: 'light', diet_type: 'Renal-friendly', sleep_hours: 6.5, water_goal_ml: 1500, exercise_goal_min: 30, systolic: 138, diastolic: 86, blood_sugar: 105, smoking: 'former', alcohol: 'none', stress_level: 6 },
    'patient-2': { activity_level: 'sedentary', diet_type: 'Low-sodium', sleep_hours: 5.5, water_goal_ml: 1500, exercise_goal_min: 20, systolic: 105, diastolic: 70, blood_sugar: 92, smoking: 'never', alcohol: 'none', stress_level: 7 },
    'patient-3': { activity_level: 'sedentary', diet_type: 'Renal + diabetic', sleep_hours: 6, water_goal_ml: 1500, exercise_goal_min: 20, systolic: 145, diastolic: 90, blood_sugar: 168, smoking: 'never', alcohol: 'none', stress_level: 5 },
    'patient-4': { activity_level: 'moderate', diet_type: 'Heart-healthy', sleep_hours: 7.5, water_goal_ml: 2500, exercise_goal_min: 40, systolic: 128, diastolic: 82, blood_sugar: 98, smoking: 'never', alcohol: 'occasional', stress_level: 3 },
    'patient-6': { activity_level: 'active', diet_type: 'Balanced', sleep_hours: 7, water_goal_ml: 2500, exercise_goal_min: 45, systolic: 134, diastolic: 84, blood_sugar: 101, smoking: 'former', alcohol: 'occasional', stress_level: 4 },
    'patient-9': { activity_level: 'sedentary', diet_type: 'Weight-loss', sleep_hours: 6, water_goal_ml: 2500, exercise_goal_min: 30, systolic: 142, diastolic: 92, blood_sugar: 110, smoking: 'current', alcohol: 'regular', stress_level: 6 },
  };
  const setPillars = db.prepare(`UPDATE patients SET activity_level=@activity_level, diet_type=@diet_type,
    sleep_hours=@sleep_hours, water_goal_ml=@water_goal_ml, exercise_goal_min=@exercise_goal_min,
    systolic=@systolic, diastolic=@diastolic, blood_sugar=@blood_sugar, smoking=@smoking,
    alcohol=@alcohol, stress_level=@stress_level WHERE id=@id AND activity_level IS NULL`);
  for (const [id, v] of Object.entries(pillars)) setPillars.run({ id, ...v });

  // Adherence history (last 7 days) for seeded patients that have none — lets
  // the trend chart + doctor ranking render immediately. Deterministic per patient.
  const insAdh = db.prepare(`INSERT INTO adherence_scores (id, patient_id, overall, food, exercise, medication, lifestyle, category, breakdown, ts) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const insMed = db.prepare(`INSERT INTO medication_logs (id, patient_id, drug, scheduled_ts, taken, taken_ts, ts) VALUES (?,?,?,?,?,?,?)`);
  const rows = db.prepare('SELECT id, medications, adherence FROM patients').all();
  for (const p of rows) {
    const has = db.prepare('SELECT COUNT(*) n FROM adherence_scores WHERE patient_id=?').get(p.id).n;
    if (!has) {
      const base = p.adherence || 75;
      for (let d = 7; d >= 1; d--) {
        const drift = Math.round((Math.sin(d) * 6) + (7 - d) * 1.2); // gentle deterministic trend
        const overall = Math.max(20, Math.min(100, base - 8 + drift));
        const ts = new Date(Date.now() - d * 86400000).toISOString();
        const bd = { food: overall + 3, exercise: overall - 6, medication: overall + 5, lifestyle: overall - 2 };
        insAdh.run(`adh-${p.id}-${d}`, p.id, overall, bd.food, Math.max(0, bd.exercise), bd.medication, Math.max(0, bd.lifestyle), overall > 75 ? 'High' : overall >= 50 ? 'Medium' : 'Low', JSON.stringify(bd), ts);
      }
    }
    // today's medication doses (some missed) so med adherence has real data
    const meds = (p.medications || '').split(',').map(s => s.trim()).filter(Boolean);
    const hasMed = db.prepare('SELECT COUNT(*) n FROM medication_logs WHERE patient_id=? AND ts > ?').get(p.id, new Date(Date.now() - 86400000).toISOString()).n;
    if (meds.length && !hasMed) {
      meds.forEach((m, i) => {
        const taken = !(p.id === 'patient-3' && i === 0); // patient-3 missed one (realistic non-adherence)
        const ts = new Date().toISOString();
        insMed.run(`med-${p.id}-${i}`, p.id, m, ts, taken ? 1 : 0, taken ? ts : null, ts);
      });
    }
  }
}

init();
seed();
seedDemoExtras();

module.exports = { db, audit, calculateAge };
