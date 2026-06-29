/* NutriCare AI — shared client: i18n, API, helpers */
(function () {
  // ── i18n ──────────────────────────────────────────────────────────
  const STR = {
    en: {
      appName: 'NutriCare AI', tagline: 'Clinical & Lifestyle Nutrition — supervised, safe, bilingual',
      login: 'Sign in', register: 'Create account', email: 'Email', password: 'Password', name: 'Full name',
      forgot: 'Forgot password?', role: 'Role', patient: 'Patient', physician: 'Physician', signOut: 'Sign out',
      dashboard: 'Dashboard', patients: 'Patients', risk: 'Risk Prediction', foods: 'Food Database',
      modules: 'Disease Modules', messages: 'Messages', appointments: 'Appointments', reports: 'Reports',
      assistant: 'AI Assistant', settings: 'Settings', myPlan: 'My Plan', logFood: 'Log Food', water: 'Water',
      exercise: 'Exercise', progress: 'Progress', totalPatients: 'Total Patients', highRisk: 'High-Risk',
      adherence: 'Avg Adherence', neonatal: 'Neonatal', riskScore: 'Malnutrition Risk', tier: 'Tier',
      ageBmi: 'Age / BMI', module: 'Module', viewPatient: 'View', generateAdime: 'Generate ADIME Note',
      approve: 'Approve', send: 'Send', typeMessage: 'Type a message…', search: 'Search foods…',
      energyTarget: 'Energy', proteinTarget: 'Protein', sodium: 'Sodium', potassium: 'Potassium',
      phosphorus: 'Phosphorus', fluid: 'Fluid', whyTitle: 'Why this recommendation?',
      sourceGuideline: 'Source guideline', ruleFired: 'Rule that fired', patientValue: 'Patient value',
      confidence: 'Confidence', flagDietitian: 'Flag to dietitian', explainability: 'Explainability',
      addAppt: 'New appointment', reason: 'Reason', when: 'When', save: 'Save',
      foodsToEat: 'Foods to favour', foodsToAvoid: 'Foods to avoid', screen: 'Screen for patient',
      verdict: 'Verdict', allow: 'OK', caution: 'Limit', avoid: 'Avoid', noData: 'No data yet.',
      askAI: 'Ask about food, water, protein…', dailyGoals: 'Daily Goals', addWater: 'Add water',
      disclaimer: 'AI supports — never replaces. All clinical recommendations require dietitian review and sign-off.',
      runPrediction: 'Run prediction', clinicalInputs: 'Clinical inputs', weightLoss: 'Weight loss % (3–6 mo)',
      intakePct: 'Intake % of needs', albumin: 'Albumin (g/dL)', crp: 'CRP (mg/L)', severity: 'Disease severity (0–3)',
      icu: 'ICU admission', sarcopenia: 'Low muscle mass', height: 'Height (cm)', weight: 'Weight (kg)',
      print: 'Print / PDF', riskFactors: 'Risk factors', flags: 'High-risk flags', adimeNote: 'ADIME Note',
      pendingApproval: 'Pending dietitian approval', approved: 'Approved', invalidLogin: 'Invalid email or password',
      addPatient: 'Add Patient', aiBot: 'AI Assistant', createPatient: 'Create patient', cancel: 'Cancel',
      dob: 'Date of birth', diseaseModule: 'Disease module', none: 'None', interactions: 'Interactions & Reminders',
      medReminders: 'Medication reminders', foodDrug: 'Food–drug warnings', noMeds: 'No medications on file.',
      noInteractions: 'No known food–drug interactions for your medications.', nutritionInputs: 'Nutrition Targets',
      carbs: 'Carbs', fat: 'Fat', fiber: 'Fiber', satFatLbl: 'Saturated fat', askPhysicianAI: 'Ask: risk, labs, targets, foods, ADIME…',
      selectPatientFirst: 'Select a patient first',
      low: 'Low', moderate: 'Moderate', high: 'High', critical: 'Critical', medsTab: 'Meds',
      allRisk: 'All risk levels', exportCsv: 'Export CSV', deleteConfirm: 'Delete', deleted: 'Deleted',
      required: 'Required', fixErrors: 'Please fix the errors', saved: 'Saved', createdPatient: 'Patient created',
      doctorNotes: 'Doctor Notes', addNote: 'Add note', scheduleFollowup: 'Schedule follow-up', markComplete: 'Mark complete',
      assessmentHistory: 'Assessment History', saveAssessment: 'Save assessment', runAnalysis: 'Run AI analysis',
      recommendations: 'Recommendations', completed: 'Completed', noteAdded: 'Note added', assessmentSaved: 'Assessment saved',
      followupScheduled: 'Follow-up scheduled', back: 'Back', exportReport: 'Export', analyzing: 'Analyzing…',
      adherenceTab: 'Score', adherenceTitle: 'Health Adherence', adherenceSub: 'Weighted score from food, exercise, medication & lifestyle.',
      calcAdherence: 'Calculate Adherence', trend: 'Adherence Trend', dataPoints: 'points', latest: 'latest', previous: 'previous',
      nutritionAdh: 'Nutrition', exerciseAdh: 'Exercise', medicationAdh: 'Medication', lifestyleAdh: 'Lifestyle',
      aiInsights: 'AI Insights', recalculate: 'Recalculate', viewHistory: 'History', compare: 'Compare',
      sendDoctor: 'Send to doctor', adherenceCalculated: 'Adherence calculated', sentToDoctor: 'Sent to doctor',
      improving: 'Improving vs previous', declining: 'Declining vs previous', reportExported: 'Report exported',
      adherence: 'Adherence', nonCompliant: 'Non-compliant patients', ranking: 'Adherence ranking', notifications: 'Notifications',
      activityLevel: 'Activity level', dietType: 'Diet type', sleepHours: 'Sleep (hrs)', waterGoal: 'Water goal (ml)',
      bloodPressure: 'Blood pressure', bloodSugar: 'Blood sugar', smoking: 'Smoking', alcohol: 'Alcohol', stress: 'Stress (0–10)',
      lifestylePillars: 'Lifestyle & vitals',
    },
    ar: {
      appName: 'نيوتريكير', tagline: 'تغذية سريرية وحياتية — بإشراف طبي، آمنة، ثنائية اللغة',
      login: 'تسجيل الدخول', register: 'إنشاء حساب', email: 'البريد الإلكتروني', password: 'كلمة المرور', name: 'الاسم الكامل',
      forgot: 'نسيت كلمة المرور؟', role: 'الدور', patient: 'مريض', physician: 'طبيب', signOut: 'تسجيل الخروج',
      dashboard: 'لوحة التحكم', patients: 'المرضى', risk: 'توقع الخطر', foods: 'قاعدة الأطعمة',
      modules: 'وحدات الأمراض', messages: 'الرسائل', appointments: 'المواعيد', reports: 'التقارير',
      assistant: 'المساعد الذكي', settings: 'الإعدادات', myPlan: 'خطتي', logFood: 'تسجيل طعام', water: 'الماء',
      exercise: 'التمارين', progress: 'التقدم', totalPatients: 'إجمالي المرضى', highRisk: 'خطر مرتفع',
      adherence: 'متوسط الالتزام', neonatal: 'حديثو الولادة', riskScore: 'خطر سوء التغذية', tier: 'الفئة',
      ageBmi: 'العمر / مؤشر الكتلة', module: 'الوحدة', viewPatient: 'عرض', generateAdime: 'إنشاء ملاحظة ADIME',
      approve: 'اعتماد', send: 'إرسال', typeMessage: 'اكتب رسالة…', search: 'ابحث عن طعام…',
      energyTarget: 'الطاقة', proteinTarget: 'البروتين', sodium: 'الصوديوم', potassium: 'البوتاسيوم',
      phosphorus: 'الفوسفور', fluid: 'السوائل', whyTitle: 'لماذا هذه التوصية؟',
      sourceGuideline: 'المرجع الإرشادي', ruleFired: 'القاعدة المطبَّقة', patientValue: 'قيمة المريض',
      confidence: 'الثقة', flagDietitian: 'تنبيه اختصاصي التغذية', explainability: 'الشفافية',
      addAppt: 'موعد جديد', reason: 'السبب', when: 'الوقت', save: 'حفظ',
      foodsToEat: 'أطعمة مفضّلة', foodsToAvoid: 'أطعمة يُتجنّب', screen: 'فحص للمريض',
      verdict: 'القرار', allow: 'مسموح', caution: 'بحذر', avoid: 'تجنّب', noData: 'لا توجد بيانات بعد.',
      askAI: 'اسأل عن الطعام أو الماء أو البروتين…', dailyGoals: 'أهداف اليوم', addWater: 'أضف ماء',
      disclaimer: 'الذكاء الاصطناعي يساعد ولا يحل محل الطبيب. كل التوصيات السريرية تتطلب مراجعة واعتماد اختصاصي التغذية.',
      runPrediction: 'تشغيل التوقع', clinicalInputs: 'المدخلات السريرية', weightLoss: 'فقدان الوزن٪ (٣-٦ أشهر)',
      intakePct: 'نسبة التغذية٪', albumin: 'الألبومين (جم/دل)', crp: 'CRP (مجم/ل)', severity: 'شدة المرض (٠-٣)',
      icu: 'دخول العناية', sarcopenia: 'نقص الكتلة العضلية', height: 'الطول (سم)', weight: 'الوزن (كجم)',
      print: 'طباعة / PDF', riskFactors: 'عوامل الخطر', flags: 'مؤشرات الخطر المرتفع', adimeNote: 'ملاحظة ADIME',
      pendingApproval: 'بانتظار اعتماد اختصاصي التغذية', approved: 'معتمد', invalidLogin: 'البريد أو كلمة المرور غير صحيحة',
      addPatient: 'إضافة مريض', aiBot: 'المساعد الذكي', createPatient: 'إنشاء مريض', cancel: 'إلغاء',
      dob: 'تاريخ الميلاد', diseaseModule: 'وحدة المرض', none: 'لا يوجد', interactions: 'التفاعلات والتذكيرات',
      medReminders: 'تذكيرات الأدوية', foodDrug: 'تحذيرات الدواء والطعام', noMeds: 'لا توجد أدوية مسجّلة.',
      noInteractions: 'لا توجد تفاعلات معروفة بين أدويتك والطعام.', nutritionInputs: 'الأهداف الغذائية',
      carbs: 'الكربوهيدرات', fat: 'الدهون', fiber: 'الألياف', satFatLbl: 'الدهون المشبعة', askPhysicianAI: 'اسأل: الخطر، التحاليل، الأهداف، الأطعمة، ADIME…',
      selectPatientFirst: 'اختر مريضاً أولاً',
      low: 'منخفض', moderate: 'متوسط', high: 'مرتفع', critical: 'حرج', medsTab: 'دواء',
      allRisk: 'كل مستويات الخطر', exportCsv: 'تصدير CSV', deleteConfirm: 'حذف', deleted: 'تم الحذف',
      required: 'مطلوب', fixErrors: 'يرجى تصحيح الأخطاء', saved: 'تم الحفظ', createdPatient: 'تم إنشاء المريض',
      doctorNotes: 'ملاحظات الطبيب', addNote: 'إضافة ملاحظة', scheduleFollowup: 'حجز متابعة', markComplete: 'تحديد كمكتمل',
      assessmentHistory: 'سجل التقييمات', saveAssessment: 'حفظ التقييم', runAnalysis: 'تشغيل تحليل الذكاء',
      recommendations: 'التوصيات', completed: 'مكتمل', noteAdded: 'تمت إضافة الملاحظة', assessmentSaved: 'تم حفظ التقييم',
      followupScheduled: 'تم حجز المتابعة', back: 'رجوع', exportReport: 'تصدير', analyzing: 'جارٍ التحليل…',
      adherenceTab: 'الالتزام', adherenceTitle: 'التزام الصحة', adherenceSub: 'درجة مرجّحة من الطعام والتمارين والدواء ونمط الحياة.',
      calcAdherence: 'احسب الالتزام', trend: 'اتجاه الالتزام', dataPoints: 'نقاط', latest: 'الأحدث', previous: 'السابق',
      nutritionAdh: 'التغذية', exerciseAdh: 'التمارين', medicationAdh: 'الدواء', lifestyleAdh: 'نمط الحياة',
      aiInsights: 'رؤى الذكاء الاصطناعي', recalculate: 'إعادة الحساب', viewHistory: 'السجل', compare: 'مقارنة',
      sendDoctor: 'إرسال للطبيب', adherenceCalculated: 'تم حساب الالتزام', sentToDoctor: 'تم الإرسال للطبيب',
      improving: 'تحسّن عن السابق', declining: 'تراجع عن السابق', reportExported: 'تم تصدير التقرير',
      adherence: 'الالتزام', nonCompliant: 'مرضى غير ملتزمين', ranking: 'ترتيب الالتزام', notifications: 'الإشعارات',
      activityLevel: 'مستوى النشاط', dietType: 'نوع الحمية', sleepHours: 'النوم (ساعات)', waterGoal: 'هدف الماء (مل)',
      bloodPressure: 'ضغط الدم', bloodSugar: 'سكر الدم', smoking: 'التدخين', alcohol: 'الكحول', stress: 'التوتر (٠-١٠)',
      lifestylePillars: 'نمط الحياة والعلامات الحيوية',
    },
  };
  let lang = localStorage.getItem('nc_lang') || 'en';
  function t(k) { return (STR[lang] && STR[lang][k]) || STR.en[k] || k; }
  function setLang(l) {
    lang = l; localStorage.setItem('nc_lang', l);
    document.documentElement.lang = l; document.body.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
    document.querySelectorAll('[data-t]').forEach(e => { e.textContent = t(e.getAttribute('data-t')); });
    document.querySelectorAll('[data-tph]').forEach(e => { e.placeholder = t(e.getAttribute('data-tph')); });
    if (window.NC.onLangChange) window.NC.onLangChange();
  }
  function applyTheme() {
    const th = localStorage.getItem('nc_theme') || 'light';
    document.documentElement.setAttribute('data-theme', th);
  }
  function toggleTheme() {
    const cur = localStorage.getItem('nc_theme') || 'light';
    localStorage.setItem('nc_theme', cur === 'light' ? 'dark' : 'light'); applyTheme();
  }

  // ── API ───────────────────────────────────────────────────────────
  // Auth lives in sessionStorage so each browser TAB has its own session.
  // This lets you open the physician dashboard in one tab and the patient
  // app in another simultaneously (e.g. to demo real-time sync) without one
  // login clobbering the other. It still survives a page refresh.
  function token() { return sessionStorage.getItem('nc_token'); }
  function user() { try { return JSON.parse(sessionStorage.getItem('nc_user')); } catch { return null; } }
  function setAuth(tok, usr) { sessionStorage.setItem('nc_token', tok); sessionStorage.setItem('nc_user', JSON.stringify(usr)); }
  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token()) headers.Authorization = 'Bearer ' + token();
    const res = await fetch('/api' + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }
  function logout() { sessionStorage.removeItem('nc_token'); sessionStorage.removeItem('nc_user'); location.href = '/'; }
  function requireAuth(role) {
    const u = user();
    if (!token() || !u) { location.href = '/'; return null; }
    if (role && u.role !== role && u.role !== 'administrator') { location.href = '/'; return null; }
    return u;
  }

  // ── helpers ───────────────────────────────────────────────────────
  function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function riskGauge(score, tier) {
    const r = 56, c = 2 * Math.PI * r, off = c - (score / 100) * c;
    const col = `var(--${tier})`;
    return `<div class="gauge"><svg width="150" height="150">
      <circle cx="75" cy="75" r="${r}" fill="none" stroke="var(--border)" stroke-width="12"/>
      <circle cx="75" cy="75" r="${r}" fill="none" stroke="${col}" stroke-width="12"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/>
      </svg><div class="num" style="color:${col}">${score}</div></div>`;
  }
  // ── Toast notifications ───────────────────────────────────────────
  function toast(msg, type = 'info', ms = 3200) {
    let host = document.getElementById('nc-toasts');
    if (!host) { host = document.createElement('div'); host.id = 'nc-toasts'; document.body.appendChild(host); }
    const el = document.createElement('div');
    el.className = `nc-toast nc-toast-${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '⚠' : type === 'warn' ? '⚠' : 'ℹ';
    el.innerHTML = `<span class="nc-toast-icon">${icon}</span><span>${esc(msg)}</span>`;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, ms);
  }

  // ── Modal (Escape / click-outside / focus management) ─────────────
  function modal(innerHtml, { title = '', onClose } = {}) {
    const prevFocus = document.activeElement;
    const back = document.createElement('div');
    back.className = 'nc-modal-back';
    back.innerHTML = `<div class="nc-modal card" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="nc-modal-head"><h3 style="margin:0">${esc(title)}</h3><button class="btn btn-sm btn-ghost nc-modal-x" aria-label="Close">✕</button></div>
      <div class="nc-modal-body">${innerHtml}</div></div>`;
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('show'));
    const close = () => {
      back.classList.remove('show');
      setTimeout(() => back.remove(), 200);
      document.removeEventListener('keydown', onKey);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      if (onClose) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { // simple focus trap
        const f = back.querySelectorAll('input,select,textarea,button,[tabindex]');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    back.querySelector('.nc-modal-x').onclick = close;
    document.addEventListener('keydown', onKey);
    const firstField = back.querySelector('input,select,textarea,button:not(.nc-modal-x)');
    if (firstField) setTimeout(() => firstField.focus(), 50);
    return { close, root: back, body: back.querySelector('.nc-modal-body') };
  }

  // ── Confirm dialog (returns a promise<boolean>) ───────────────────
  function confirmDialog(message, { title = 'Confirm', danger = true } = {}) {
    return new Promise((resolve) => {
      const m = modal(`<p>${esc(message)}</p>
        <div class="row" style="justify-content:flex-end;gap:8px;margin-top:14px">
          <button class="btn nc-cancel" data-t="cancel">Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} nc-ok">Confirm</button>
        </div>`, { title, onClose: () => resolve(false) });
      m.body.querySelector('.nc-cancel').onclick = () => { m.close(); resolve(false); };
      m.body.querySelector('.nc-ok').onclick = () => { m.root.remove(); resolve(true); };
      setLang(lang);
    });
  }

  // ── Button loading state wrapper ──────────────────────────────────
  async function withLoading(btn, fn) {
    if (!btn) return fn();
    const orig = btn.innerHTML; btn.disabled = true; btn.dataset.loading = '1';
    btn.innerHTML = `<span class="nc-spin"></span> ${orig}`;
    try { return await fn(); }
    finally { btn.disabled = false; delete btn.dataset.loading; btn.innerHTML = orig; }
  }

  // ── CSV export ────────────────────────────────────────────────────
  function exportCSV(filename, rows) {
    if (!rows || !rows.length) { toast('Nothing to export', 'warn'); return; }
    const headers = Object.keys(rows[0]);
    const escc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escc(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    URL.revokeObjectURL(a.href);
    toast('CSV exported', 'success');
  }

  function connectSocket(onEvent) {
    if (!window.io) return null;
    const s = window.io();
    ['patient-updated', 'patient-activity', 'message', 'appointment-created', 'note-approved'].forEach(ev =>
      s.on(ev, (d) => onEvent(ev, d)));
    return s;
  }

  window.NC = { t, setLang, getLang: () => lang, applyTheme, toggleTheme, api, token, user, setAuth, logout, requireAuth, esc, riskGauge, connectSocket, toast, modal, confirmDialog, withLoading, exportCSV, STR };
  applyTheme();
  document.addEventListener('DOMContentLoaded', () => setLang(lang));
})();
