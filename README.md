# NutriCare AI · يئاذغ Ghidhā'ī

**AI-Powered Clinical & Lifestyle Nutrition Platform** — AUC AI in Healthcare Capstone, Group 3.
Pilot framing: Dr. Mohammed Al-Faqih Hospital, Fakeeh Care Group, Riyadh.

A working, honest implementation of the capstone pitch deck's core: the
**layered-AI safety pipeline** — *GenAI drafts → deterministic Rules guard →
Clinician decides* — with a persistent database, bilingual (EN/AR) UI, and a
synchronized physician + patient experience.

> ⚠️ **Educational capstone software, not a medical device.** AI supports — never
> replaces. Every clinical recommendation requires dietitian review and sign-off.

---

## What actually works (verified, not aspirational)

| Capability | Status | Where |
|---|---|---|
| Persistent database (survives restart) | ✅ SQLite | `src/db.js`, `nutricare.db` |
| Malnutrition risk anchor model (NRS-2002 + GLIM + weighted 0–100 score) | ✅ | `src/rules/clinical.js` |
| Explainability ("why this recommendation": rule + source + value + confidence) | ✅ | physician patient view |
| Deterministic restriction filter (hard allow/caution/avoid gate, cited) | ✅ | `src/rules/restrictionFilter.js` |
| Nutrient targets per disease (energy, protein g/kg, Na/K/PO₄, fluid) | ✅ | `src/rules/clinical.js` |
| 4 disease modules (CKD/KDOQI, Hepatic/ESPEN, Hyperlipidemia/ACC-AHA, IEM/ACMG) | ✅ | `src/data/diseaseModules.js` |
| ADIME/PES note generation + dietitian approval gate | ✅ | `src/rules/adime.js` |
| Optional Claude LLM drafting (graceful fallback to template) | ✅ | set `ANTHROPIC_API_KEY` |
| Food database with full renal/metabolic nutrients + Arabic names | ✅ 57 items | `src/data/foods.js` |
| Manual risk prediction (clinician input form) | ✅ | physician → Risk Prediction |
| Bilingual EN/AR with full RTL | ✅ | `public/js/app.js` |
| Real-time sync (WebSocket) physician ↔ patient | ✅ | Socket.IO |
| Messaging, appointments, exercise/water/food logs | ✅ | `server.js` |
| Reports (printable / PDF via browser) | ✅ | physician patient view |
| JWT auth, role-based access, audit log | ✅ | `server.js`, `audit_logs` table |

### Honest scope notes (what is intentionally *not* claimed)
- The food DB has **57 curated items**, not "300+". Each has a complete nutrient
  profile including the renal/metabolic values the modules actually use.
- The "AI" is a **deterministic clinical rules engine** (matching the deck's
  "single source of numeric truth" principle). An LLM only drafts prose around
  fixed numbers, and only if you supply an API key.
- FHIR/EHR integration, wearables, and SFDA submission are **roadmap**, not built.
- This is a capstone demonstrator, not certified clinical software.

---

## Run it

```bash
cd Nutricare
npm install        # express, socket.io, better-sqlite3, jsonwebtoken, bcryptjs
npm start          # node server.js  → http://localhost:3000
```

Open **http://localhost:3000**

| Role | Email | Password |
|---|---|---|
| Physician (Dietitian) | `doctor@nutricare.sa` | `docpass123` |
| Patient (CKD) | `ahmed.eltayeb@auc.edu` | `password123` |
| Patient (Cirrhosis, high-risk) | `eman.salah@auc.edu` | `password123` |
| Patient (PKU neonate→toddler) | `sarah@example.com` | `password123` |
| Administrator | `admin@nutricare.sa` | `adminpass123` |

Optional — enable live LLM ADIME drafting:
```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
```

Smoke-test the API:
```bash
npm test
```

---

## Architecture (mirrors the deck's safety pipeline)

```
Patient inputs (labs, anthropometrics, intake)
   │
   ▼
Deterministic engine  ── malnutrition risk (NRS-2002 + GLIM)   src/rules/clinical.js
   │                  └─ nutrient targets per disease module
   ▼
Restriction filter  ── hard allow/avoid gate, cites the rule   src/rules/restrictionFilter.js
   │
   ▼
GenAI / template draft  ── ADIME note (LLM never invents numbers)  src/rules/adime.js
   │
   ▼
Dietitian gate  ── explainability panel + approval  (UI)
   │
   ▼
Audit log  ── every action recorded  (audit_logs)
```

```
server.js                 Express + Socket.IO, all REST routes
src/
  db.js                   SQLite schema + seed + audit
  data/foods.js           food composition DB (single source of numeric truth)
  data/diseaseModules.js  CKD / Hepatic / Hyperlipidemia / IEM guideline logic
  rules/clinical.js       age, BMI, IBW, targets, malnutrition risk
  rules/restrictionFilter.js   deterministic food gate
  rules/adime.js          ADIME/PES note (+ optional Claude)
public/
  index.html              login / register (EN/AR, light/dark)
  physician.html          dashboard, patients, risk, foods, modules, appointments
  patient.html            mobile app: goals, plan, log, assistant, chat
  js/app.js               i18n + API client + WebSocket + helpers
  css/style.css           design system
test/smoke.js             end-to-end API smoke test
_archive/                 previous v1/v2/v3 sprawl (kept for reference)
```

## API (selected)
`POST /api/auth/login` · `POST /api/auth/register` · `GET /api/patients` ·
`GET/PUT /api/patients/:id` · `POST /api/risk/predict` · `GET /api/foods?patientId=` ·
`POST /api/foods/screen` · `POST /api/patients/:id/adime` · `POST /api/notes/:id/approve` ·
`GET /api/patients/:id/report` · `GET/POST /api/messages/:patientId` ·
`GET /api/disease-modules` · `GET /api/dashboard/stats` · `GET /api/audit`

## Clinical sources encoded
KDOQI 2020 (CKD) · ESPEN (liver) · ACC/AHA (lipids) · ACMG/SSIEM (IEM) ·
NRS-2002 + GLIM (malnutrition screening/diagnosis). Food values: USDA FoodData
Central + Saudi FCDB (illustrative subset).
