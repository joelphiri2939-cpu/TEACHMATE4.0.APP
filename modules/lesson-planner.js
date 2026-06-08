// ████  TEACHMATE 3.0 — AI LESSON PLANNER  v3.1  ████
//
//  AI-ONLY lesson generation using OpenRouter free models.
//  Exact CDC/MoE Zambia lesson plan format.
//
//  v3.1 ENHANCEMENTS:
//  ✅ Smart auto-fill for SEN, Classroom Setup, Question Types & Additional Instructions
//  ✅ Usage Guide modal — accessible anytime via the guide button in the header
//
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── CONFIG ────────────────────────────────────────────────────────────────
  const OR_KEY   = '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';
  const OR_MODEL = 'openrouter/auto';        // auto-selects best available free model

  // ─── ZAMBIA CURRICULUM DATA ────────────────────────────────────────────────
  const LEVELS = [
    'ECE Level 1','ECE Level 2',
    'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7',
    'Form 1','Form 2','Form 3','Form 4','Form 5','Form 6'
  ];

  const SUBJECTS = [
    'Agricultural Science','Art and Design','Biology','Braille','Chemistry',
    'Civic Education','Commerce','Computer Science',
    'Creative and Technology Studies','Design and Technology',
    'English Language','Expressive Arts','Fashion and Fabrics',
    'Food and Nutrition','French','Geography','History',
    'Home Economics and Hospitality','Information and Communication Technology',
    'Literacy and Language','Literature in English',
    'Literature in Zambian Languages','Mathematics',
    'Mathematics and Science','Music','Physical Education','Physics',
    'Pre-Literacy and Language','Pre-Mathematics and Science',
    'Principles of Accounts','Religious Education','Science',
    'Sign Language','Social Studies','Technology Studies',
    'Travel and Tourism'
  ];

  const DURATIONS  = ['30 minutes','40 minutes','60 minutes','80 minutes','120 minutes'];
  const SEN_OPTS   = [
    'No identified SEN','Visual Impairment','Hearing Impairment',
    'Learning Difficulties','Physical Disability',
    'Gifted and Talented','Multiple SEN','General Mixed Ability'
  ];
  const SETUP_OPTS = [
    'Mixed Grouping','Whole Class','Group Work','Pair Work','Individual Work'
  ];
  const QTYPE_OPTS = [
    'Mixed Variety (Recommended)','Multiple Choice Only','Short Answer Only',
    'Structured Questions','Fill-in-the-Blanks','Problem-Solving',
    'MCQ + Short Answer','Short Answer + Structured','Matching + Fill-in-the-Blanks'
  ];
  const TERMS = [
    'Term 1 Week 1','Term 1 Week 2','Term 1 Week 3','Term 1 Week 4',
    'Term 1 Week 5','Term 1 Week 6','Term 1 Week 7','Term 1 Week 8',
    'Term 2 Week 1','Term 2 Week 2','Term 2 Week 3','Term 2 Week 4',
    'Term 2 Week 5','Term 2 Week 6','Term 2 Week 7','Term 2 Week 8',
    'Term 3 Week 1','Term 3 Week 2','Term 3 Week 3','Term 3 Week 4',
    'Term 3 Week 5','Term 3 Week 6','Term 3 Week 7','Term 3 Week 8',
  ];

  // ─── STORE KEY ─────────────────────────────────────────────────────────────
  const LP_STORE = 'lp_v3_plans';

  // ─── UTILS ──────────────────────────────────────────────────────────────────
  const esc  = s => String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const uid  = () => 'lp_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
  const now  = () => new Date().toISOString();
  const sel  = id => document.getElementById(id);
  const val  = id => sel(id)?.value?.trim() ?? '';

  // ═══════════════════════════════════════════════════════════════════════════
  //  SMART AUTO-FILL ENGINE
  //  Called before generation. Reads form values and intelligently fills
  //  any Section 3 fields the teacher left at default / blank.
  // ═══════════════════════════════════════════════════════════════════════════
  function smartAutoFill() {
    const level    = val('f-level');
    const subject  = val('f-subject');
    const learners = parseInt(val('f-learners') || '0', 10);
    const setup    = val('f-setup');
    const sen      = val('f-sen');
    const qtypes   = val('f-qtypes');
    const extra    = val('f-extra');

    // ── Determine school tier ──────────────────────────────────────────────
    const isECE     = level.startsWith('ECE');
    const isLower   = ['Grade 1','Grade 2','Grade 3','Grade 4'].includes(level);
    const isUpper   = ['Grade 5','Grade 6','Grade 7'].includes(level);
    const isJunSec  = ['Form 1','Form 2'].includes(level);
    const isSenSec  = ['Form 3','Form 4','Form 5','Form 6'].includes(level);
    const isSecondary = isJunSec || isSenSec;

    // ── Subject categories ─────────────────────────────────────────────────
    const scienceSubjects = ['Biology','Chemistry','Physics','Science',
      'Mathematics and Science','Agricultural Science','Computer Science',
      'Information and Communication Technology'];
    const mathSubjects    = ['Mathematics','Mathematics and Science',
      'Principles of Accounts'];
    const practicalSubjects = ['Art and Design','Music','Physical Education',
      'Fashion and Fabrics','Food and Nutrition','Home Economics and Hospitality',
      'Technology Studies','Creative and Technology Studies','Design and Technology',
      'Travel and Tourism','Expressive Arts'];
    const langSubjects = ['English Language','Literacy and Language','French',
      'Literature in English','Literature in Zambian Languages',
      'Pre-Literacy and Language','Sign Language','Braille'];

    const isScience   = scienceSubjects.includes(subject);
    const isMath      = mathSubjects.includes(subject);
    const isPractical = practicalSubjects.includes(subject);
    const isLang      = langSubjects.includes(subject);

    const autoFilled = []; // track what was auto-filled for badge display

    // ── 1. SEN — default is "No identified SEN" which is fine, but upgrade
    //    to "General Mixed Ability" for large classes (more realistic for Zambia)
    if (!sen || sen === 'No identified SEN') {
      let autoSEN = 'No identified SEN';
      if (learners >= 35) {
        autoSEN = 'General Mixed Ability';
      } else if (isECE || isLower) {
        autoSEN = 'General Mixed Ability';
      }
      if (autoSEN !== sen) {
        const el = sel('f-sen');
        if (el) el.value = autoSEN;
        autoFilled.push(`SEN → "${autoSEN}"`);
      }
    }

    // ── 2. Classroom Setup — smart pick based on subject + level
    const isDefaultSetup = !setup || setup === 'Mixed Grouping';
    if (isDefaultSetup) {
      let autoSetup = 'Mixed Grouping';

      if (isECE || isLower) {
        autoSetup = 'Whole Class';
      } else if (isPractical) {
        autoSetup = 'Group Work';
      } else if (isScience && isSecondary) {
        autoSetup = 'Group Work';        // lab work suits groups
      } else if (isMath && isSecondary) {
        autoSetup = 'Individual Work';   // maths assessments are individual
      } else if (isLang && isUpper) {
        autoSetup = 'Pair Work';         // language pair activities
      } else if (isUpper || isJunSec) {
        autoSetup = 'Mixed Grouping';
      } else if (isSenSec) {
        autoSetup = 'Individual Work';
      }

      if (autoSetup !== setup) {
        const el = sel('f-setup');
        if (el) el.value = autoSetup;
        autoFilled.push(`Setup → "${autoSetup}"`);
      }
    }

    // ── 3. Exercise Question Types — smart pick based on subject + level
    const isDefaultQtype = !qtypes || qtypes === 'Mixed Variety (Recommended)';
    if (isDefaultQtype) {
      let autoQtype = 'Mixed Variety (Recommended)';

      if (isECE || isLower) {
        autoQtype = 'Fill-in-the-Blanks';          // simple for young learners
      } else if (isUpper && isLang) {
        autoQtype = 'Short Answer + Structured';
      } else if (isMath) {
        autoQtype = 'Problem-Solving';              // maths = problem solving
      } else if (isScience && isSecondary) {
        autoQtype = 'MCQ + Short Answer';           // science exams in Zambia
      } else if (isSenSec) {
        autoQtype = 'Short Answer + Structured';    // senior secondary = structured
      } else if (isPractical) {
        autoQtype = 'Short Answer Only';            // practical subjects simpler Qs
      } else if (isJunSec) {
        autoQtype = 'MCQ + Short Answer';
      }

      if (autoQtype !== qtypes) {
        const el = sel('f-qtypes');
        if (el) el.value = autoQtype;
        autoFilled.push(`Question Types → "${autoQtype}"`);
      }
    }

    // ── 4. Additional Instructions — build smart contextual instructions
    //    only if the teacher left the field empty
    if (!extra) {
      const instrParts = [];

      // Zambian context always
      instrParts.push('Use authentic Zambian local examples, names, towns, and contexts throughout');

      // Level-specific
      if (isECE || isLower) {
        instrParts.push('Use very simple language suitable for young learners');
        instrParts.push('Include a short rhyme, chant, or song related to the topic');
        instrParts.push('Use lots of pictures, drawings, and hands-on activities');
      } else if (isUpper) {
        instrParts.push('Include at least one practical hands-on activity');
        instrParts.push('Use relatable examples from Zambian daily life and environment');
      } else if (isJunSec) {
        instrParts.push('Balance theory with practical application');
        instrParts.push('Include critical thinking questions to stretch learners');
      } else if (isSenSec) {
        instrParts.push('Align questions to ECZ examination standard and format');
        instrParts.push('Include higher-order thinking questions');
        instrParts.push('Reference past ECZ exam question patterns where applicable');
      }

      // Subject-specific
      if (isScience) {
        instrParts.push('Suggest a simple experiment or demonstration that can be done with locally available materials');
      }
      if (isMath) {
        instrParts.push('Use real Zambian contexts for word problems (e.g. market prices, farming, distances between towns)');
      }
      if (isPractical) {
        instrParts.push('Describe practical steps clearly and include safety precautions where applicable');
      }
      if (isLang) {
        instrParts.push('Include a short reading or listening comprehension passage set in a Zambian context');
      }

      // Large class management
      if (learners >= 40) {
        instrParts.push('Suggest class management strategies suitable for large classes of 40+ learners with limited resources');
      }

      const autoExtra = instrParts.join('. ');
      const el = sel('f-extra');
      if (el) el.value = autoExtra;
      autoFilled.push('Additional Instructions (auto-generated)');
    }

    return autoFilled;
  }

  // ─── STORAGE ───────────────────────────────────────────────────────────────
  async function lpLoad() {
    try {
      if (typeof getIndexedDB === 'function') {
        const d = await getIndexedDB(LP_STORE);
        if (Array.isArray(d)) return d;
      }
    } catch {}
    try { return JSON.parse(localStorage.getItem(LP_STORE) || '[]'); }
    catch { return []; }
  }
  async function lpSave(plans) {
    try {
      if (typeof saveIndexedDB === 'function') { await saveIndexedDB(LP_STORE, plans); return; }
    } catch {}
    try { localStorage.setItem(LP_STORE, JSON.stringify(plans)); } catch {}
  }

  // ─── TOAST ─────────────────────────────────────────────────────────────────
  function lpToast(msg, type = 'success') {
    if (typeof showToast === 'function') { showToast(msg, type); return; }
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position:'fixed', bottom:'90px', left:'50%', transform:'translateX(-50%)',
      background: type === 'error' ? '#dc2626' : type === 'info' ? '#0369a1' : '#009960',
      color:'#fff', padding:'11px 22px', borderRadius:'10px',
      fontSize:'13px', fontWeight:'700', zIndex:'9999999',
      fontFamily:'inherit', boxShadow:'0 4px 20px rgba(0,0,0,.4)',
      whiteSpace:'nowrap', opacity:'1', transition:'opacity .3s'
    });
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 350); }, 3800);
  }

  // ─── INJECT GLOBAL STYLES ──────────────────────────────────────────────────
  function injectStyles() {
    if (sel('lp3-styles')) return;
    const s = document.createElement('style');
    s.id = 'lp3-styles';
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');

      :root {
        --lp-bg:       #f6fbf9;
        --lp-surface:  #ffffff;
        --lp-surface2: #f0faf5;
        --lp-border:   #d4ede4;
        --lp-green:    #008a54;
        --lp-green2:   #00b871;
        --lp-green3:   #00d483;
        --lp-text:     #0d1f18;
        --lp-text2:    #3d6657;
        --lp-text3:    #8aab9c;
        --lp-amber:    #d97706;
        --lp-red:      #dc2626;
        --lp-blue:     #0369a1;
        --lp-shadow:   0 2px 16px rgba(0,138,84,.10);
        --lp-shadow2:  0 8px 40px rgba(0,138,84,.16);
        --lp-font:     'Plus Jakarta Sans', system-ui, sans-serif;
        --lp-mono:     'JetBrains Mono', monospace;
        --lp-radius:   12px;
        --lp-radius2:  8px;
      }

      #lessonPlannerPanel {
        display: flex;
        flex-direction: column;
        height: 100%;
        font-family: var(--lp-font);
        background: var(--lp-bg);
        overflow: hidden;
        -webkit-font-smoothing: antialiased;
      }

      #lp3-body {
        flex: 1;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        scroll-behavior: smooth;
        scrollbar-width: thin;
        scrollbar-color: #b2d9ca transparent;
      }
      #lp3-body::-webkit-scrollbar { width: 5px; }
      #lp3-body::-webkit-scrollbar-thumb { background: #b2d9ca; border-radius: 4px; }

      @keyframes lp3-in    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
      @keyframes lp3-fade  { from{opacity:0} to{opacity:1} }
      @keyframes lp3-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      @keyframes lp3-shimmer {
        0%{background-position:-600px 0} 100%{background-position:600px 0}
      }
      @keyframes lp3-spin  { to{transform:rotate(360deg)} }
      @keyframes lp3-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      @keyframes lp3-guide-in {
        from{opacity:0;transform:translateY(20px) scale(.97)}
        to{opacity:1;transform:none}
      }

      .lp3-in   { animation: lp3-in   .24s cubic-bezier(.16,1,.3,1) both; }
      .lp3-fade { animation: lp3-fade .3s ease both; }

      .lp3-field {
        border: 1.5px solid var(--lp-border);
        border-radius: var(--lp-radius2);
        padding: 9px 13px;
        font-size: 13px;
        font-family: var(--lp-font);
        background: var(--lp-surface);
        color: var(--lp-text);
        width: 100%; box-sizing: border-box;
        outline: none;
        transition: border-color .15s, box-shadow .15s;
        -webkit-appearance: none;
      }
      .lp3-field::placeholder { color: var(--lp-text3); }
      .lp3-field:focus {
        border-color: var(--lp-green2);
        box-shadow: 0 0 0 3px rgba(0,184,113,.14);
      }
      textarea.lp3-field { resize: vertical; min-height: 72px; line-height: 1.65; }
      select.lp3-field {
        cursor: pointer;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='%23008a54' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 11px center;
        padding-right: 30px;
      }
      select.lp3-field option { background: #fff; color: var(--lp-text); }

      /* Auto-filled field highlight */
      .lp3-field.lp3-autofilled {
        border-color: #60a5fa;
        background: #f0f9ff;
        box-shadow: 0 0 0 3px rgba(96,165,250,.12);
      }

      .lp3-label {
        display: block;
        font-size: 10.5px;
        font-weight: 700;
        color: var(--lp-text2);
        text-transform: uppercase;
        letter-spacing: .065em;
        margin-bottom: 5px;
      }
      .lp3-label .req { color: var(--lp-amber); margin-left: 2px; }
      .lp3-label .auto-badge {
        background: #dbeafe; color: #1d4ed8;
        font-size: 8px; font-weight: 800;
        padding: 1px 5px; border-radius: 4px;
        margin-left: 5px; vertical-align: middle;
        letter-spacing: .04em; text-transform: uppercase;
        border: 1px solid #bfdbfe;
      }

      .lp3-card {
        background: var(--lp-surface);
        border: 1.5px solid var(--lp-border);
        border-radius: var(--lp-radius);
        padding: 18px 20px;
        margin-bottom: 14px;
        box-shadow: var(--lp-shadow);
      }
      .lp3-card-title {
        font-size: 12px;
        font-weight: 800;
        color: var(--lp-green);
        text-transform: uppercase;
        letter-spacing: .07em;
        margin-bottom: 14px;
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .lp3-card-title-icon {
        width: 24px; height: 24px;
        background: linear-gradient(135deg, var(--lp-green), var(--lp-green2));
        border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; flex-shrink: 0;
      }

      .lp3-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .lp3-grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
      @media (max-width: 540px) {
        .lp3-grid2, .lp3-grid3 { grid-template-columns: 1fr; }
      }

      .lp3-btn {
        display: inline-flex; align-items: center; gap: 7px;
        padding: 10px 20px; border: none; border-radius: var(--lp-radius2);
        font-size: 13px; font-weight: 700; font-family: var(--lp-font);
        cursor: pointer; white-space: nowrap;
        transition: all .15s; -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        min-height: 44px;
      }
      .lp3-btn-primary {
        background: linear-gradient(135deg, var(--lp-green), var(--lp-green2));
        color: #fff;
        box-shadow: 0 3px 14px rgba(0,138,84,.30);
      }
      .lp3-btn-primary:hover  { filter: brightness(1.07); box-shadow: 0 5px 20px rgba(0,138,84,.38); }
      .lp3-btn-primary:active { transform: scale(.97); }
      .lp3-btn-primary:disabled { opacity: .45; cursor: not-allowed; filter: none; box-shadow: none; }

      .lp3-btn-ghost {
        background: var(--lp-surface2);
        color: var(--lp-green);
        border: 1.5px solid var(--lp-border);
      }
      .lp3-btn-ghost:hover { background: #e0f5eb; border-color: var(--lp-green2); }

      .lp3-btn-danger {
        background: #fff1f2; color: var(--lp-red);
        border: 1.5px solid #fecdd3;
      }
      .lp3-btn-danger:hover { background: #ffe4e6; }

      .lp3-btn-guide {
        background: rgba(255,255,255,.15);
        color: #fff;
        border: 1.5px solid rgba(255,255,255,.30);
        font-size: 11px;
        padding: 7px 13px;
        min-height: 34px;
      }
      .lp3-btn-guide:hover { background: rgba(255,255,255,.25); }

      .lp3-tab {
        padding: 7px 16px; border-radius: 20px;
        font-size: 12px; font-weight: 700;
        cursor: pointer; border: 1.5px solid var(--lp-border);
        background: var(--lp-surface); color: var(--lp-text2);
        font-family: var(--lp-font); white-space: nowrap;
        transition: all .16s; display: flex; align-items: center; gap: 5px;
        min-height: 38px;
      }
      .lp3-tab.active {
        background: linear-gradient(135deg, var(--lp-green), var(--lp-green2));
        color: #fff; border-color: transparent;
        box-shadow: 0 2px 10px rgba(0,138,84,.28);
      }

      #lp3-stream-box {
        font-family: var(--lp-mono);
        font-size: 11.5px;
        line-height: 1.75;
        color: var(--lp-text2);
        background: var(--lp-surface2);
        border: 1px solid var(--lp-border);
        border-radius: var(--lp-radius2);
        padding: 12px 14px;
        min-height: 56px;
        max-height: 160px;
        overflow-y: auto;
        word-break: break-word;
        -webkit-overflow-scrolling: touch;
      }

      .lp3-dots { display: inline-flex; gap: 5px; align-items: center; }
      .lp3-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: var(--lp-green2);
        animation: lp3-bounce .75s ease-in-out infinite;
      }
      .lp3-dot:nth-child(2) { animation-delay: .12s; }
      .lp3-dot:nth-child(3) { animation-delay: .24s; }

      .lp3-output-section {
        border: 1.5px solid var(--lp-border);
        border-radius: var(--lp-radius);
        overflow: hidden;
        margin-bottom: 12px;
      }
      .lp3-output-head {
        background: var(--lp-surface2);
        padding: 9px 14px;
        font-size: 10.5px;
        font-weight: 800;
        color: var(--lp-green);
        text-transform: uppercase;
        letter-spacing: .07em;
        border-bottom: 1px solid var(--lp-border);
      }
      .lp3-output-body {
        padding: 12px 14px;
        font-size: 12.5px;
        color: var(--lp-text);
        line-height: 1.75;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .lp3-prog-table {
        width: 100%; border-collapse: collapse;
        font-size: 12px; color: var(--lp-text);
      }
      .lp3-prog-table th {
        background: var(--lp-surface2);
        padding: 8px 11px;
        font-size: 10px; font-weight: 800;
        color: var(--lp-green);
        text-transform: uppercase; letter-spacing: .065em;
        text-align: left; border: 1px solid var(--lp-border);
      }
      .lp3-prog-table td {
        padding: 10px 11px;
        vertical-align: top;
        border: 1px solid var(--lp-border);
        line-height: 1.7;
      }
      .lp3-prog-table tr:nth-child(even) td { background: #f9fefb; }

      .lp3-plan-card {
        background: var(--lp-surface);
        border: 1.5px solid var(--lp-border);
        border-radius: var(--lp-radius);
        padding: 14px 16px;
        margin-bottom: 10px;
        transition: all .16s;
        animation: lp3-in .22s ease both;
      }
      .lp3-plan-card:hover {
        border-color: var(--lp-green2);
        box-shadow: var(--lp-shadow2);
        transform: translateY(-1px);
      }

      .lp3-badge {
        display: inline-block;
        padding: 2px 8px; border-radius: 20px;
        font-size: 10px; font-weight: 700;
        background: #dcfce7; color: var(--lp-green);
        border: 1px solid #bbf7d0;
      }

      .lp3-actions {
        position: sticky; bottom: 0;
        background: var(--lp-surface);
        border-top: 1.5px solid var(--lp-border);
        padding: 12px 20px;
        display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
        z-index: 10;
        box-shadow: 0 -4px 20px rgba(0,0,0,.07);
      }

      /* ── Auto-fill notification banner ── */
      #lp3-autofill-notice {
        background: linear-gradient(135deg, #eff6ff, #dbeafe);
        border: 1.5px solid #bfdbfe;
        border-radius: var(--lp-radius2);
        padding: 10px 14px;
        margin-bottom: 14px;
        display: flex; align-items: flex-start; gap: 10px;
        animation: lp3-in .3s ease both;
      }
      #lp3-autofill-notice .notice-icon {
        font-size: 18px; flex-shrink: 0; margin-top: 1px;
      }
      #lp3-autofill-notice .notice-text {
        font-size: 11.5px; color: #1e40af; line-height: 1.65; flex: 1;
      }
      #lp3-autofill-notice .notice-title {
        font-weight: 800; font-size: 12px; margin-bottom: 3px;
      }
      #lp3-autofill-dismiss {
        background: none; border: none; color: #60a5fa;
        font-size: 16px; cursor: pointer; flex-shrink: 0;
        padding: 0; line-height: 1; margin-top: 1px;
        font-family: var(--lp-font);
      }

      /* ── Usage Guide overlay ── */
      #lp3-guide-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,.55);
        z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        padding: 16px;
        backdrop-filter: blur(3px);
      }
      #lp3-guide-modal {
        background: var(--lp-surface);
        border-radius: 16px;
        width: 100%; max-width: 680px;
        max-height: 88vh;
        display: flex; flex-direction: column;
        box-shadow: 0 24px 80px rgba(0,0,0,.28);
        animation: lp3-guide-in .28s cubic-bezier(.16,1,.3,1) both;
        overflow: hidden;
      }
      #lp3-guide-head {
        background: linear-gradient(135deg,#003d25,#006b40,#009960);
        padding: 18px 22px;
        display: flex; align-items: center; justify-content: space-between;
        flex-shrink: 0;
        position: relative; overflow: hidden;
      }
      #lp3-guide-head::before {
        content:'';
        position:absolute;top:0;left:0;right:0;height:2px;
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.7) 50%,transparent);
        background-size:300% 100%; animation:lp3-shimmer 2.8s linear infinite;
      }
      #lp3-guide-body {
        flex: 1; overflow-y: auto; padding: 22px 24px;
        scrollbar-width: thin; scrollbar-color: #b2d9ca transparent;
      }
      #lp3-guide-body::-webkit-scrollbar { width: 5px; }
      #lp3-guide-body::-webkit-scrollbar-thumb { background: #b2d9ca; border-radius: 4px; }

      .guide-section {
        margin-bottom: 22px;
      }
      .guide-section-title {
        font-size: 13px; font-weight: 800; color: var(--lp-green);
        margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
        padding-bottom: 7px; border-bottom: 1.5px solid var(--lp-border);
      }
      .guide-step {
        display: flex; gap: 12px; margin-bottom: 12px; align-items: flex-start;
      }
      .guide-step-num {
        width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
        background: linear-gradient(135deg, var(--lp-green), var(--lp-green2));
        color: #fff; font-size: 11px; font-weight: 800;
        display: flex; align-items: center; justify-content: center;
      }
      .guide-step-content { flex: 1; }
      .guide-step-title { font-size: 12.5px; font-weight: 700; color: var(--lp-text); margin-bottom: 3px; }
      .guide-step-desc  { font-size: 12px; color: var(--lp-text2); line-height: 1.65; }
      .guide-tip {
        background: #f0fdf4; border: 1px solid #bbf7d0;
        border-radius: 8px; padding: 10px 13px;
        font-size: 11.5px; color: #166534; line-height: 1.65;
        margin-top: 8px; display: flex; gap: 8px; align-items: flex-start;
      }
      .guide-tip-icon { font-size: 14px; flex-shrink: 0; }
      .guide-warn {
        background: #fffbeb; border: 1px solid #fde68a;
        border-radius: 8px; padding: 10px 13px;
        font-size: 11.5px; color: #92400e; line-height: 1.65;
        margin-top: 8px; display: flex; gap: 8px; align-items: flex-start;
      }
      .guide-field-tag {
        display: inline-block; background: var(--lp-surface2);
        border: 1px solid var(--lp-border); border-radius: 5px;
        padding: 1px 7px; font-size: 11px; font-weight: 700;
        color: var(--lp-green); margin: 1px;
      }
      .guide-auto-row {
        background: #eff6ff; border: 1px solid #bfdbfe;
        border-radius: 8px; padding: 9px 13px; margin-bottom: 8px;
        font-size: 11.5px; color: #1e40af; line-height: 1.6;
        display: flex; gap: 8px; align-items: flex-start;
      }
    `;
    document.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  USAGE GUIDE MODAL
  // ═══════════════════════════════════════════════════════════════════════════
  function openGuide() {
    if (sel('lp3-guide-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'lp3-guide-overlay';
    overlay.innerHTML = `
      <div id="lp3-guide-modal">

        <!-- GUIDE HEADER -->
        <div id="lp3-guide-head">
          <div style="display:flex;align-items:center;gap:11px;position:relative;z-index:1;">
            <div style="width:40px;height:40px;border-radius:10px;
              background:rgba(255,255,255,.16);border:1.5px solid rgba(255,255,255,.28);
              display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📖</div>
            <div>
              <div style="color:#fff;font-size:16px;font-weight:900;letter-spacing:-.02em;
                font-family:var(--lp-font);">Usage Guide</div>
              <div style="color:rgba(255,255,255,.65);font-size:10.5px;margin-top:1px;
                font-family:var(--lp-font);">Lesson Planner · TeachMate 3.0</div>
            </div>
          </div>
          <button id="lp3-guide-close" style="width:36px;height:36px;border-radius:50%;
            background:rgba(255,255,255,.14);border:1.5px solid rgba(255,255,255,.28);
            color:#fff;font-size:16px;cursor:pointer;display:flex;
            align-items:center;justify-content:center;flex-shrink:0;
            position:relative;z-index:1;font-family:var(--lp-font);">✕</button>
        </div>

        <!-- GUIDE BODY -->
        <div id="lp3-guide-body">

          <!-- INTRO -->
          <div style="background:linear-gradient(135deg,#f0faf5,#dcfce7);
            border:1.5px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
            <div style="font-size:13px;font-weight:800;color:var(--lp-green);margin-bottom:5px;">
              🎉 Welcome to the AI Lesson Planner!
            </div>
            <div style="font-size:12px;color:var(--lp-text2);line-height:1.7;">
              This tool generates <strong>complete, CDC/MoE Zambia-aligned lesson plans</strong>
              in seconds using AI. Fill in the required fields, hit Generate, and the AI writes
              your entire lesson plan — including the progression table, exercises, homework,
              and answer key. You can then download it as a PDF or save it to your library.
            </div>
          </div>

          <!-- SECTION 1: Getting Started -->
          <div class="guide-section">
            <div class="guide-section-title">🚀 Getting Started — Step by Step</div>

            <div class="guide-step">
              <div class="guide-step-num">1</div>
              <div class="guide-step-content">
                <div class="guide-step-title">Fill in Lesson Identification</div>
                <div class="guide-step-desc">
                  Enter your school name, teacher name, date, and select the
                  <span class="guide-field-tag">Class Level</span>,
                  <span class="guide-field-tag">Duration</span>, and
                  <span class="guide-field-tag">Subject</span>.
                  These three fields marked with ★ are <strong>required</strong>.
                </div>
              </div>
            </div>

            <div class="guide-step">
              <div class="guide-step-num">2</div>
              <div class="guide-step-content">
                <div class="guide-step-title">Fill in Curriculum Details</div>
                <div class="guide-step-desc">
                  Enter the <span class="guide-field-tag">Topic</span>,
                  <span class="guide-field-tag">Sub-Topic</span>,
                  <span class="guide-field-tag">Specific Competences</span>,
                  <span class="guide-field-tag">Learning Activities</span>, and
                  <span class="guide-field-tag">Expected Standard</span>.
                  All five are required. Be as descriptive as possible — the AI uses
                  these to generate a more accurate and relevant lesson plan.
                </div>
                <div class="guide-tip">
                  <span class="guide-tip-icon">💡</span>
                  <span>Copy competences and activities directly from your Zambia MoE syllabus
                  for best results. The AI will build around them.</span>
                </div>
              </div>
            </div>

            <div class="guide-step">
              <div class="guide-step-num">3</div>
              <div class="guide-step-content">
                <div class="guide-step-title">Section 3 — Leave it or customise it</div>
                <div class="guide-step-desc">
                  The <strong>Inclusion &amp; Exercise Preferences</strong> section is fully
                  optional. If you leave any of the four fields unchanged or blank,
                  the system <strong>automatically selects the most appropriate values</strong>
                  based on your class level, subject, and number of learners.
                </div>
                <div class="guide-tip">
                  <span class="guide-tip-icon">🤖</span>
                  <span>For example: a Grade 1 Literacy class will auto-get
                  <strong>General Mixed Ability</strong> SEN, <strong>Whole Class</strong>
                  setup, <strong>Fill-in-the-Blanks</strong> question types, and auto-generated
                  instructions including a request for songs and simple language.
                  A Form 4 Chemistry class gets <strong>Group Work</strong>,
                  <strong>MCQ + Short Answer</strong>, and ECZ-aligned instructions.</span>
                </div>
              </div>
            </div>

            <div class="guide-step">
              <div class="guide-step-num">4</div>
              <div class="guide-step-content">
                <div class="guide-step-title">Click ✨ Generate Lesson Plan</div>
                <div class="guide-step-desc">
                  The AI streams the lesson plan live. You can watch the output
                  appearing in real time. Generation typically takes 20–60 seconds
                  depending on the model selected by OpenRouter.
                </div>
                <div class="guide-warn">
                  <span class="guide-tip-icon">⚠️</span>
                  <span>Do not close the panel during generation. Wait for the
                  "Lesson plan generated!" banner to appear before taking any action.</span>
                </div>
              </div>
            </div>

            <div class="guide-step">
              <div class="guide-step-num">5</div>
              <div class="guide-step-content">
                <div class="guide-step-title">Download PDF or Save to Library</div>
                <div class="guide-step-desc">
                  After generation, use <strong>🖨️ Download PDF</strong> to open a
                  print-ready version in a new tab (then use your browser's Print →
                  Save as PDF). Use <strong>💾 Save to Library</strong> to store the
                  plan for later. Saved plans appear in the <strong>📂 Library</strong> tab.
                </div>
              </div>
            </div>
          </div>

          <!-- SECTION 2: Smart Auto-Fill -->
          <div class="guide-section">
            <div class="guide-section-title">🤖 Smart Auto-Fill — How It Works</div>
            <div style="font-size:12px;color:var(--lp-text2);line-height:1.7;margin-bottom:12px;">
              When you click Generate, the system checks Section 3 fields. Any field
              left at its default or blank is automatically filled using intelligent
              rules based on your lesson context. Here are some examples:
            </div>

            <div class="guide-auto-row">
              <span>🎓</span>
              <span><strong>ECE / Grade 1–4:</strong> Auto-sets SEN to "General Mixed Ability",
              Setup to "Whole Class", Questions to "Fill-in-the-Blanks", and adds
              instructions to include songs, chants, and simple language.</span>
            </div>
            <div class="guide-auto-row">
              <span>🔬</span>
              <span><strong>Science (Secondary):</strong> Auto-sets Setup to "Group Work"
              (for lab activities), Questions to "MCQ + Short Answer" (ECZ format),
              and instructs the AI to include a practical demonstration.</span>
            </div>
            <div class="guide-auto-row">
              <span>📐</span>
              <span><strong>Mathematics:</strong> Auto-sets Questions to "Problem-Solving"
              and instructs the AI to use Zambian market/farming contexts in word problems.</span>
            </div>
            <div class="guide-auto-row">
              <span>👥</span>
              <span><strong>Large class (40+ learners):</strong> Auto-adds class management
              strategies to the AI instructions for handling large groups with limited resources.</span>
            </div>
            <div class="guide-auto-row">
              <span>📝</span>
              <span><strong>Form 3–6 (Senior Secondary):</strong> Auto-sets Questions to
              "Short Answer + Structured" and instructs the AI to align with ECZ
              examination standards and past paper patterns.</span>
            </div>

            <div class="guide-tip" style="margin-top:10px;">
              <span class="guide-tip-icon">✏️</span>
              <span>Auto-filled fields are highlighted in <strong style="color:#1d4ed8;">blue</strong>
              so you can easily see what was changed. You can always edit them before generating.</span>
            </div>
          </div>

          <!-- SECTION 3: Library -->
          <div class="guide-section">
            <div class="guide-section-title">📂 Library Tab</div>
            <div style="font-size:12px;color:var(--lp-text2);line-height:1.7;">
              The Library stores all lesson plans you've saved. You can:
              <ul style="margin:8px 0 0 16px;line-height:2;">
                <li>🔍 <strong>Search</strong> plans by topic, subject, level, or term</li>
                <li>🖨️ <strong>Re-export</strong> any saved plan as PDF at any time</li>
                <li>🗑️ <strong>Delete</strong> plans you no longer need</li>
              </ul>
              Plans are stored locally on this device (IndexedDB or localStorage).
              They are not uploaded to any server.
            </div>
          </div>

          <!-- SECTION 4: Tips -->
          <div class="guide-section">
            <div class="guide-section-title">💡 Pro Tips for Better Plans</div>

            <div class="guide-step">
              <div class="guide-step-num" style="background:linear-gradient(135deg,#d97706,#f59e0b);">★</div>
              <div class="guide-step-content">
                <div class="guide-step-title">Be specific with Competences</div>
                <div class="guide-step-desc">
                  Instead of "understand photosynthesis", write
                  "Learners should be able to describe the process of photosynthesis,
                  identify the raw materials and products, and explain the role of sunlight
                  and chlorophyll." The more specific, the better the AI output.
                </div>
              </div>
            </div>

            <div class="guide-step">
              <div class="guide-step-num" style="background:linear-gradient(135deg,#d97706,#f59e0b);">★</div>
              <div class="guide-step-content">
                <div class="guide-step-title">Use Additional Instructions creatively</div>
                <div class="guide-step-desc">
                  You can type things like: <em>"Include a story about a Lusaka market vendor",
                  "Add a group competition activity", "Make it fun with a quiz game",
                  "Focus on environmental conservation near the Kafue River"</em>.
                  The AI will incorporate these into the lesson.
                </div>
              </div>
            </div>

            <div class="guide-step">
              <div class="guide-step-num" style="background:linear-gradient(135deg,#d97706,#f59e0b);">★</div>
              <div class="guide-step-content">
                <div class="guide-step-title">Regenerate if unsatisfied</div>
                <div class="guide-step-desc">
                  Use the <strong>🔄 Regenerate</strong> button at the bottom of any
                  generated plan to produce a fresh version with the same inputs.
                  Each generation is unique — sometimes the second attempt is better.
                </div>
              </div>
            </div>
          </div>

          <!-- FOOTER -->
          <div style="background:var(--lp-surface2);border-radius:10px;padding:12px 15px;
            font-size:11px;color:var(--lp-text3);line-height:1.65;text-align:center;">
            📚 TeachMate 3.0 · AI Lesson Planner · Zambia MoE / CDC Format<br>
            Plans are generated using OpenRouter AI models. Always review before classroom use.
          </div>

        </div>
      </div>`;

    document.body.appendChild(overlay);

    sel('lp3-guide-close').addEventListener('click', closeGuide);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeGuide(); });
  }

  function closeGuide() {
    const o = sel('lp3-guide-overlay');
    if (o) {
      o.style.opacity = '0';
      o.style.transition = 'opacity .2s';
      setTimeout(() => o.remove(), 220);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════════════════════════
  function init() {
    injectStyles();

    const panel   = sel('lessonPlannerPanel');
    const overlay = sel('panelOverlay');
    const openBtn = sel('openPlannerBtn');
    const closeBtn= sel('closePlannerBtn');

    if (!panel) { console.warn('[LP3] #lessonPlannerPanel missing'); return; }

    buildUI(panel);

    const openPanel  = () => {
      panel.classList.remove('translate-x-full');
      panel.style.display = 'block';
      if (overlay) { overlay.classList.remove('hidden'); overlay.style.display = 'block'; }
    };
    const closePanel = () => {
      panel.classList.add('translate-x-full');
      if (overlay) { overlay.classList.add('hidden'); overlay.style.display = 'none'; }
    };

    if (openBtn)  openBtn.addEventListener('click', openPanel);
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    if (overlay)  overlay.addEventListener('click', closePanel);

    window.openLessonPlanner  = openPanel;
    window.closeLessonPlanner = closePanel;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  BUILD UI
  // ═══════════════════════════════════════════════════════════════════════════
  async function buildUI(panel) {
    let plans    = await lpLoad();
    let activeTab = 'generate';
    let lastPlan  = null;

    panel.innerHTML = `
      <!-- HEADER -->
      <div style="
        background: linear-gradient(135deg,#003d25 0%,#006b40 50%,#009960 100%);
        padding: 0 20px;
        height: 60px; min-height: 60px;
        display: flex; align-items: center; justify-content: space-between;
        flex-shrink: 0; position: relative; overflow: hidden;">

        <div style="position:absolute;top:0;left:0;right:0;height:2.5px;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,.7) 50%,transparent);
          background-size:300% 100%; animation:lp3-shimmer 2.8s linear infinite;"></div>

        <div style="position:absolute;right:-18px;top:-18px;width:88px;height:88px;
          border-radius:50%;background:rgba(255,255,255,.06);pointer-events:none;"></div>

        <div style="display:flex;align-items:center;gap:11px;">
          <div style="width:38px;height:38px;border-radius:10px;flex-shrink:0;
            background:rgba(255,255,255,.16);border:1.5px solid rgba(255,255,255,.25);
            display:flex;align-items:center;justify-content:center;font-size:18px;">📚</div>
          <div>
            <div style="color:#fff;font-size:16px;font-weight:900;letter-spacing:-.02em;
              font-family:var(--lp-font);">Lesson Planner
              <span style="background:rgba(255,255,255,.18);font-size:8px;font-weight:800;
                padding:2px 7px;border-radius:20px;letter-spacing:.08em;
                border:1px solid rgba(255,255,255,.28);margin-left:5px;vertical-align:middle;">AI</span>
            </div>
            <div style="color:rgba(255,255,255,.65);font-size:10.5px;margin-top:1px;
              font-family:var(--lp-font);">CDC / MoE Zambia Format · TeachMate 3.0</div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;position:relative;z-index:1;">
          <button id="lp3-guide-btn" class="lp3-btn lp3-btn-guide">
            📖 Guide
          </button>
          <button id="lp3-close"
            style="width:36px;height:36px;border-radius:50%;
            background:rgba(255,255,255,.14);border:1.5px solid rgba(255,255,255,.28);
            color:#fff;font-size:16px;cursor:pointer;display:flex;
            align-items:center;justify-content:center;transition:background .15s;flex-shrink:0;
            font-family:var(--lp-font);">✕</button>
        </div>
      </div>

      <!-- TABS -->
      <div style="background:var(--lp-surface);border-bottom:1.5px solid var(--lp-border);
        padding:10px 18px;display:flex;gap:6px;flex-shrink:0;overflow-x:auto;
        scrollbar-width:none;-webkit-overflow-scrolling:touch;">
        <button class="lp3-tab active" data-tab="generate">✨ Generate</button>
        <button class="lp3-tab"        data-tab="library">📂 Library
          <span id="lp3-lib-count" style="background:#dcfce7;color:var(--lp-green);
            font-size:9px;font-weight:800;padding:1px 6px;border-radius:10px;
            margin-left:2px;">${plans.length}</span>
        </button>
      </div>

      <!-- BODY -->
      <div id="lp3-body" style="flex:1;overflow-y:auto;padding:16px 18px;background:var(--lp-bg);">
      </div>
    `;

    sel('lp3-close')?.addEventListener('click', () => {
      sel('closePlannerBtn')?.click() ||
      (panel.classList.add('translate-x-full'),
       sel('panelOverlay')?.classList.add('hidden'));
    });

    sel('lp3-guide-btn')?.addEventListener('click', openGuide);

    panel.querySelectorAll('.lp3-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        panel.querySelectorAll('.lp3-tab').forEach(b => b.classList.toggle('active', b === btn));
        render();
      });
    });

    function refreshLibCount() {
      const el = sel('lp3-lib-count');
      if (el) el.textContent = plans.length;
    }

    function render() {
      const body = sel('lp3-body');
      if (!body) return;
      body.innerHTML = '';
      if (activeTab === 'generate') renderGenerate(body);
      if (activeTab === 'library')  renderLibrary(body);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  TAB: GENERATE
    // ═════════════════════════════════════════════════════════════════════════
    function renderGenerate(body) {
      body.innerHTML = `
        <div style="max-width:760px;margin:0 auto;" class="lp3-in">

          <!-- SECTION 1: Lesson Identification -->
          <div class="lp3-card">
            <div class="lp3-card-title">
              <div class="lp3-card-title-icon">🏫</div>
              1. Lesson Identification
            </div>

            <div class="lp3-grid3" style="margin-bottom:12px;">
              <div>
                <label class="lp3-label">School Name</label>
                <input id="f-school" class="lp3-field" placeholder="e.g. Matero Basic School">
              </div>
              <div>
                <label class="lp3-label">Name of Teacher</label>
                <input id="f-teacher" class="lp3-field" placeholder="Full name">
              </div>
              <div>
                <label class="lp3-label">Date of Lesson</label>
                <input id="f-date" class="lp3-field" type="date"
                  value="${new Date().toISOString().slice(0,10)}">
              </div>
            </div>

            <div class="lp3-grid3" style="margin-bottom:12px;">
              <div>
                <label class="lp3-label">Class Level <span class="req">★</span></label>
                <select id="f-level" class="lp3-field">
                  <option value="">— Select —</option>
                  ${LEVELS.map(l=>`<option>${esc(l)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="lp3-label">Duration <span class="req">★</span></label>
                <select id="f-duration" class="lp3-field">
                  ${DURATIONS.map((d,i)=>`<option${i===1?' selected':''}>${esc(d)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="lp3-label">Time / Period</label>
                <input id="f-period" class="lp3-field" placeholder="e.g. 08:00 – 08:40">
              </div>
            </div>

            <div class="lp3-grid3">
              <div>
                <label class="lp3-label">Total No. of Learners</label>
                <input id="f-learners" class="lp3-field" type="number" min="1" max="120"
                  placeholder="e.g. 38">
              </div>
              <div>
                <label class="lp3-label">Term / Week</label>
                <select id="f-term" class="lp3-field">
                  <option value="">—</option>
                  ${TERMS.map(t=>`<option>${esc(t)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="lp3-label">Subject <span class="req">★</span></label>
                <select id="f-subject" class="lp3-field">
                  <option value="">— Select —</option>
                  ${SUBJECTS.map(s=>`<option>${esc(s)}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>

          <!-- SECTION 2: Curriculum Details -->
          <div class="lp3-card">
            <div class="lp3-card-title">
              <div class="lp3-card-title-icon">📚</div>
              2. Curriculum Details
            </div>

            <div class="lp3-grid2" style="margin-bottom:12px;">
              <div>
                <label class="lp3-label">Topic <span class="req">★</span></label>
                <input id="f-topic" class="lp3-field" placeholder="e.g. Photosynthesis">
              </div>
              <div>
                <label class="lp3-label">Sub-Topic <span class="req">★</span></label>
                <input id="f-subtopic" class="lp3-field"
                  placeholder="e.g. Light-dependent reactions">
              </div>
            </div>

            <div style="margin-bottom:12px;">
              <label class="lp3-label">Specific Competences <span class="req">★</span></label>
              <textarea id="f-competences" class="lp3-field"
                placeholder="e.g. Learners should be able to explain the process of photosynthesis and identify the factors that affect it."></textarea>
            </div>

            <div style="margin-bottom:12px;">
              <label class="lp3-label">Learning Activities <span class="req">★</span></label>
              <textarea id="f-activities" class="lp3-field"
                placeholder="e.g. Observation of plants, group discussion, drawing diagrams, answering questions, practical experiment."></textarea>
            </div>

            <div class="lp3-grid2">
              <div>
                <label class="lp3-label">Expected Standard <span class="req">★</span></label>
                <textarea id="f-standard" class="lp3-field"
                  placeholder="e.g. Learner correctly explains photosynthesis with at least 3 key factors."></textarea>
              </div>
              <div>
                <label class="lp3-label">References</label>
                <textarea id="f-refs" class="lp3-field"
                  placeholder="e.g. Biology Pupil's Book Grade 10, p.45; Zambia MoE Biology Syllabus 2023"></textarea>
              </div>
            </div>
          </div>

          <!-- SECTION 3: Inclusion & Exercise Preferences -->
          <div class="lp3-card">
            <div class="lp3-card-title">
              <div class="lp3-card-title-icon">♿</div>
              3. Inclusion &amp; Exercise Preferences
              <span style="margin-left:auto;font-size:9px;font-weight:600;color:var(--lp-text3);
                text-transform:none;letter-spacing:0;background:var(--lp-surface2);
                border:1px solid var(--lp-border);padding:2px 8px;border-radius:10px;">
                🤖 Auto-filled if left unchanged
              </span>
            </div>

            <div class="lp3-grid3" style="margin-bottom:12px;">
              <div>
                <label class="lp3-label" id="label-sen">Special Educational Needs</label>
                <select id="f-sen" class="lp3-field">
                  ${SEN_OPTS.map(o=>`<option>${esc(o)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="lp3-label" id="label-setup">Classroom Setup</label>
                <select id="f-setup" class="lp3-field">
                  ${SETUP_OPTS.map(o=>`<option>${esc(o)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="lp3-label" id="label-qtypes">Exercise Question Types</label>
                <select id="f-qtypes" class="lp3-field">
                  ${QTYPE_OPTS.map(o=>`<option>${esc(o)}</option>`).join('')}
                </select>
              </div>
            </div>

            <div>
              <label class="lp3-label" id="label-extra">Additional Instructions for the AI</label>
              <textarea id="f-extra" class="lp3-field"
                placeholder="e.g. Use local Zambian examples · Focus on hands-on activities · Include a song or chant · Avoid complex vocabulary&#10;&#10;💡 Leave blank — the AI will auto-generate smart instructions based on your level and subject."></textarea>
            </div>
          </div>

          <!-- GENERATE BUTTON -->
          <div style="
            background:linear-gradient(135deg,#003d25,#006b40);
            border-radius:var(--lp-radius); padding:18px 20px; margin-bottom:14px;
            display:flex; align-items:center; justify-content:space-between;
            flex-wrap:wrap; gap:12px; position:relative; overflow:hidden;">

            <div style="position:absolute;right:-12px;bottom:-12px;width:70px;height:70px;
              border-radius:50%;background:rgba(255,255,255,.06);pointer-events:none;"></div>

            <div style="position:relative;z-index:1;">
              <div style="font-size:14px;font-weight:800;color:#fff;margin-bottom:3px;">
                ✨ Ready to generate?
              </div>
              <div style="font-size:11.5px;color:rgba(255,255,255,.65);max-width:400px;line-height:1.5;">
                AI will write a complete CDC-aligned lesson plan including Goal,
                Rationale, Prior Knowledge, Lesson Progression Table,
                Exercise, Homework &amp; Answer Key.
              </div>
            </div>

            <button id="lp3-generate" class="lp3-btn lp3-btn-primary"
              style="font-size:14px;padding:13px 28px;position:relative;z-index:1;">
              ✨ Generate Lesson Plan
            </button>
          </div>

          <!-- AUTO-FILL NOTICE (shown after generation starts if fields were auto-filled) -->
          <div id="lp3-autofill-notice" style="display:none;"></div>

          <!-- STREAMING UI -->
          <div id="lp3-gen-progress" style="display:none;" class="lp3-card lp3-fade">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
              <div style="width:36px;height:36px;border-radius:9px;flex-shrink:0;
                background:linear-gradient(135deg,var(--lp-green),var(--lp-green2));
                display:flex;align-items:center;justify-content:center;
                font-size:17px;box-shadow:0 3px 10px rgba(0,138,84,.28);">🤖</div>
              <div>
                <div style="font-size:13px;font-weight:800;color:var(--lp-text);" id="lp3-gen-status">
                  Preparing your lesson plan…
                </div>
                <div style="font-size:11px;color:var(--lp-text3);margin-top:2px;">
                  Streaming live · Zambia CDC format
                </div>
              </div>
              <div class="lp3-dots" style="margin-left:auto;">
                <div class="lp3-dot"></div>
                <div class="lp3-dot"></div>
                <div class="lp3-dot"></div>
              </div>
            </div>

            <div id="lp3-steps" style="display:flex;flex-direction:column;gap:7px;margin-bottom:14px;"></div>

            <div style="font-size:10px;font-weight:700;color:var(--lp-text3);
              text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;">
              Live output
            </div>
            <div id="lp3-stream-box"></div>
          </div>

          <!-- PLAN OUTPUT -->
          <div id="lp3-plan-output" style="display:none;"></div>

        </div>`;

      sel('lp3-generate')?.addEventListener('click', () => runGenerate());
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  GENERATION ENGINE
    // ═════════════════════════════════════════════════════════════════════════
    async function runGenerate() {
      const level      = val('f-level');
      const subject    = val('f-subject');
      const topic      = val('f-topic');
      const subtopic   = val('f-subtopic');
      const competences= val('f-competences');
      const activities = val('f-activities');
      const standard   = val('f-standard');

      if (!level)      { lpToast('⚠️ Select a Class Level', 'error'); return; }
      if (!subject)    { lpToast('⚠️ Select a Subject',     'error'); return; }
      if (!topic)      { lpToast('⚠️ Enter a Topic',        'error'); return; }
      if (!subtopic)   { lpToast('⚠️ Enter a Sub-Topic',    'error'); return; }
      if (!competences){ lpToast('⚠️ Enter Specific Competences', 'error'); return; }
      if (!activities) { lpToast('⚠️ Enter Learning Activities',  'error'); return; }
      if (!standard)   { lpToast('⚠️ Enter Expected Standard',    'error'); return; }

      // ── SMART AUTO-FILL ─────────────────────────────────────────────────
      const autoFilled = smartAutoFill();

      // Highlight auto-filled fields
      if (autoFilled.length > 0) {
        ['f-sen','f-setup','f-qtypes','f-extra'].forEach(id => {
          const el = sel(id);
          if (el) {
            el.classList.add('lp3-autofilled');
            setTimeout(() => el.classList.remove('lp3-autofilled'), 6000);
          }
        });

        // Show notice banner
        const noticeEl = sel('lp3-autofill-notice');
        if (noticeEl) {
          noticeEl.style.display = 'flex';
          noticeEl.innerHTML = `
            <div class="notice-icon">🤖</div>
            <div class="notice-text">
              <div class="notice-title">Smart Auto-Fill Applied</div>
              The following fields were automatically set based on your lesson context:
              <strong>${autoFilled.join(' · ')}</strong>.
              You can edit them in Section 3 before regenerating.
            </div>
            <button id="lp3-autofill-dismiss">✕</button>`;
          sel('lp3-autofill-dismiss')?.addEventListener('click', () => {
            noticeEl.style.display = 'none';
          });
        }
      }

      // Re-read values after auto-fill
      const school    = val('f-school');
      const teacher   = val('f-teacher');
      const date      = val('f-date');
      const duration  = val('f-duration');
      const period    = val('f-period');
      const learners  = val('f-learners');
      const term      = val('f-term');
      const refs      = val('f-refs');
      const sen       = val('f-sen');
      const setup     = val('f-setup');
      const qtypes    = val('f-qtypes');
      const extra     = val('f-extra');

      const genBtn = sel('lp3-generate');
      if (genBtn) { genBtn.disabled = true; genBtn.innerHTML = '⏳ Generating…'; }

      const progressBox = sel('lp3-gen-progress');
      const outputBox   = sel('lp3-plan-output');
      if (progressBox) progressBox.style.display = 'block';
      if (outputBox)   outputBox.style.display   = 'none';

      setTimeout(() => progressBox?.scrollIntoView({ behavior:'smooth', block:'start' }), 80);

      const STEPS = [
        { icon:'🎯', text:'Writing Lesson Goal & Rationale…'          },
        { icon:'🧠', text:'Building Prior Knowledge section…'         },
        { icon:'🌍', text:'Setting up Learning Environment…'          },
        { icon:'⚡', text:'Building Lesson Progression Table…'        },
        { icon:'🔗', text:'Adding Cross-Cutting Issues…'              },
        { icon:'📝', text:'Writing Class Exercise & Homework…'        },
        { icon:'✅', text:'Finalising Answer Key & checking format…'  },
      ];
      const stepsEl = sel('lp3-steps');
      if (stepsEl) {
        stepsEl.innerHTML = STEPS.map((s, i) => `
          <div id="lp3-step-${i}" style="
            display:flex;align-items:center;gap:8px;
            padding:7px 11px;border-radius:8px;
            background:${i===0?'#f0faf5':'var(--lp-bg)'};
            border:1px solid ${i===0?'var(--lp-border)':'#e9f5ef'};
            opacity:${i===0?'1':'.4'};transition:all .3s;">
            <span style="font-size:13px;">${s.icon}</span>
            <span style="font-size:11.5px;font-weight:${i===0?'700':'500'};
              color:${i===0?'var(--lp-text)':'var(--lp-text3)'};">${s.text}</span>
          </div>`).join('');
      }

      let stepIdx = 0;
      const markStepDone = () => {
        const cur = sel(`lp3-step-${stepIdx}`);
        if (cur) {
          cur.style.background = '#dcfce7';
          cur.style.border     = '1px solid #bbf7d0';
          const span = cur.querySelector('span:last-of-type');
          if (span) span.style.color = 'var(--lp-green)';
          const check = document.createElement('span');
          check.textContent = '✅';
          check.style.cssText = 'margin-left:auto;font-size:12px;';
          cur.appendChild(check);
        }
        stepIdx++;
        const nxt = sel(`lp3-step-${stepIdx}`);
        if (nxt) {
          nxt.style.opacity    = '1';
          nxt.style.background = '#f0faf5';
          nxt.style.border     = '1px solid var(--lp-border)';
          const nl = nxt.querySelector('span:last-of-type');
          if (nl) nl.style.fontWeight = '700';
        }
      };
      const stepTimer = setInterval(markStepDone, 2200);

      const prompt = buildPrompt({
        school, teacher, date, level, duration, period, learners,
        term, subject, topic, subtopic, competences, activities,
        standard, refs, sen, setup, qtypes, extra
      });

      let rawJSON = '';
      try {
        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${OR_KEY}`,
            'HTTP-Referer':  window.location.origin,
            'X-Title':       'TeachMate 3.0 Lesson Planner'
          },
          body: JSON.stringify({
            model:       OR_MODEL,
            stream:      true,
            max_tokens:  3200,
            temperature: 0.3,
            messages: [
              {
                role: 'system',
                content: `You are a senior Zambia Ministry of Education curriculum specialist.
You produce lesson plans in the exact CDC/MoE Zambia format.
You ALWAYS respond with ONLY a valid JSON object — no markdown, no code fences, no preamble.`
              },
              { role: 'user', content: prompt }
            ]
          })
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`OpenRouter ${resp.status}: ${errText.slice(0,200)}`);
        }

        const reader  = resp.body.getReader();
        const decoder = new TextDecoder();
        let   buf     = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const j = line.slice(6).trim();
            if (!j || j === '[DONE]') continue;
            try {
              const parsed  = JSON.parse(j);
              const token   = parsed.choices?.[0]?.delta?.content || '';
              if (token) {
                rawJSON += token;
                const box = sel('lp3-stream-box');
                if (box) {
                  box.textContent = rawJSON.slice(-400);
                  box.scrollTop   = box.scrollHeight;
                }
              }
            } catch { /* ignore broken chunk */ }
          }
        }

      } catch (err) {
        clearInterval(stepTimer);
        if (genBtn) { genBtn.disabled = false; genBtn.innerHTML = '✨ Generate Lesson Plan'; }
        if (progressBox) progressBox.style.display = 'none';
        showGenError(err.message);
        return;
      }

      clearInterval(stepTimer);
      for (let i = stepIdx; i < STEPS.length; i++) markStepDone();

      if (genBtn) { genBtn.disabled = false; genBtn.innerHTML = '✨ Generate Lesson Plan'; }
      if (progressBox) progressBox.style.display = 'none';

      let plan;
      try {
        const cleaned = rawJSON.replace(/```json|```/g,'').trim();
        plan = JSON.parse(cleaned);
      } catch {
        try {
          const m = rawJSON.match(/\{[\s\S]*\}/);
          plan = m ? JSON.parse(m[0]) : null;
        } catch { plan = null; }
      }

      if (!plan) {
        showGenError('AI response was not valid JSON. Try again or switch to a different model.');
        return;
      }

      plan._meta = { school, teacher, date, level, duration, period,
                     learners, term, subject, topic, subtopic,
                     competences, activities, standard, refs,
                     sen, setup, qtypes, generatedAt: now(),
                     autoFilled: autoFilled.length > 0 ? autoFilled : undefined };
      lastPlan = plan;

      renderPlanOutput(outputBox, plan);
      outputBox.style.display = 'block';
      setTimeout(() => outputBox?.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  PROMPT BUILDER
    // ═════════════════════════════════════════════════════════════════════════
    function buildPrompt(f) {
      return `Generate a complete Zambia CDC/MoE lesson plan for this lesson:

LESSON IDENTIFICATION:
- School: ${f.school || 'Not specified'}
- Teacher: ${f.teacher || 'Not specified'}
- Date: ${f.date || 'Not specified'}
- Class Level: ${f.level}
- Duration: ${f.duration}
- Period/Time: ${f.period || 'Not specified'}
- Total Learners: ${f.learners || 'Not specified'}
- Term/Week: ${f.term || 'Not specified'}
- Subject: ${f.subject}

CURRICULUM DETAILS:
- Topic: ${f.topic}
- Sub-Topic: ${f.subtopic}
- Specific Competences: ${f.competences}
- Learning Activities: ${f.activities}
- Expected Standard: ${f.standard}
- References: ${f.refs || 'Standard MoE textbook'}

INCLUSION & PREFERENCES:
- SEN: ${f.sen}
- Classroom Setup: ${f.setup}
- Exercise Question Types: ${f.qtypes}
${f.extra ? `- Additional Instructions: ${f.extra}` : ''}

INSTRUCTIONS:
- Use authentic Zambian context, local examples (towns, rivers, wildlife, markets, crops)
- Assume large class (30–45 learners), limited ICT, limited resources
- Be thorough, practical and classroom-ready
- The lesson progression table MUST have all 3 phases with detailed rows
- Write 5 class exercise questions and 3 homework questions
- Write a complete answer key for all questions
- Cross-cutting issues must be specific to Zambia (gender equity, HIV/AIDS awareness,
  environmental education, peace/values, life skills)

Return ONLY this JSON object with no markdown, no code fences, no extra text:
{
  "lessonGoal": "string — one clear goal sentence",
  "rationale": "string — why this lesson matters (2-3 sentences, Zambian context)",
  "priorKnowledge": "string — what learners already know before this lesson",
  "learningEnvironment": {
    "natural": "string — natural environment elements used",
    "artificial": "string — man-made/classroom materials",
    "technological": "string — any tech or ICT used"
  },
  "teachingMaterials": ["string", "string"],
  "lessonProgression": [
    {
      "phase": "Introduction",
      "duration": "string e.g. 10 minutes",
      "teacherActivity": "string — detailed teacher steps",
      "learnerActivity": "string — what learners do",
      "assessmentCriteria": "string — how teacher checks understanding"
    },
    {
      "phase": "Development",
      "duration": "string e.g. 25 minutes",
      "teacherActivity": "string — detailed teacher steps",
      "learnerActivity": "string — what learners do",
      "assessmentCriteria": "string — how teacher checks understanding"
    },
    {
      "phase": "Conclusion",
      "duration": "string e.g. 5 minutes",
      "teacherActivity": "string",
      "learnerActivity": "string",
      "assessmentCriteria": "string"
    }
  ],
  "crossCuttingIssues": [
    { "issue": "string e.g. Gender", "description": "string" },
    { "issue": "string", "description": "string" }
  ],
  "classExercise": [
    { "qnum": 1, "question": "string", "marks": 2 },
    { "qnum": 2, "question": "string", "marks": 2 },
    { "qnum": 3, "question": "string", "marks": 2 },
    { "qnum": 4, "question": "string", "marks": 2 },
    { "qnum": 5, "question": "string", "marks": 2 }
  ],
  "homework": [
    { "qnum": 1, "question": "string", "marks": 3 },
    { "qnum": 2, "question": "string", "marks": 3 },
    { "qnum": 3, "question": "string", "marks": 4 }
  ],
  "answerKey": {
    "classExercise": [
      { "qnum": 1, "answer": "string" },
      { "qnum": 2, "answer": "string" },
      { "qnum": 3, "answer": "string" },
      { "qnum": 4, "answer": "string" },
      { "qnum": 5, "answer": "string" }
    ],
    "homework": [
      { "qnum": 1, "answer": "string" },
      { "qnum": 2, "answer": "string" },
      { "qnum": 3, "answer": "string" }
    ]
  }
}`;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  RENDER PLAN OUTPUT
    // ═════════════════════════════════════════════════════════════════════════
    function renderPlanOutput(container, p) {
      const m = p._meta || {};

      const progRows = (p.lessonProgression || []).map(row => `
        <tr>
          <td style="font-weight:700;white-space:nowrap;color:var(--lp-green);">
            ${esc(row.phase)}<br>
            <span style="font-size:10px;font-weight:600;color:var(--lp-text3);">
              ${esc(row.duration)}
            </span>
          </td>
          <td>${esc(row.teacherActivity)}</td>
          <td>${esc(row.learnerActivity)}</td>
          <td>${esc(row.assessmentCriteria)}</td>
        </tr>`).join('');

      const crossRows = (p.crossCuttingIssues || []).map(c =>
        `<div style="margin-bottom:7px;">
          <span style="font-weight:700;color:var(--lp-green);">${esc(c.issue)}:</span>
          <span style="margin-left:6px;">${esc(c.description)}</span>
        </div>`).join('');

      const exRows = (p.classExercise || []).map(q =>
        `<div style="display:flex;gap:8px;margin-bottom:8px;align-items:baseline;">
          <span style="font-weight:700;color:var(--lp-green);flex-shrink:0;min-width:22px;">
            ${q.qnum}.
          </span>
          <span style="flex:1;">${esc(q.question)}</span>
          <span style="font-size:10px;color:var(--lp-text3);flex-shrink:0;">[${q.marks} mk${q.marks>1?'s':''}]</span>
        </div>`).join('');

      const hwRows = (p.homework || []).map(q =>
        `<div style="display:flex;gap:8px;margin-bottom:8px;align-items:baseline;">
          <span style="font-weight:700;color:var(--lp-green);flex-shrink:0;min-width:22px;">
            ${q.qnum}.
          </span>
          <span style="flex:1;">${esc(q.question)}</span>
          <span style="font-size:10px;color:var(--lp-text3);flex-shrink:0;">[${q.marks} mk${q.marks>1?'s':''}]</span>
        </div>`).join('');

      const akExRows = (p.answerKey?.classExercise || []).map(a =>
        `<div style="display:flex;gap:8px;margin-bottom:6px;">
          <span style="font-weight:700;color:var(--lp-green);flex-shrink:0;min-width:22px;">${a.qnum}.</span>
          <span>${esc(a.answer)}</span>
        </div>`).join('');

      const akHwRows = (p.answerKey?.homework || []).map(a =>
        `<div style="display:flex;gap:8px;margin-bottom:6px;">
          <span style="font-weight:700;color:var(--lp-green);flex-shrink:0;min-width:22px;">${a.qnum}.</span>
          <span>${esc(a.answer)}</span>
        </div>`).join('');

      const matsList = (p.teachingMaterials || []).map(mt =>
        `<span style="display:inline-block;background:#dcfce7;border:1px solid #bbf7d0;
          color:var(--lp-green);padding:3px 10px;border-radius:20px;
          font-size:11px;margin:2px;">${esc(mt)}</span>`).join('');

      // Auto-fill note in output
      const autoNote = m.autoFilled?.length ? `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;
          padding:9px 13px;margin-bottom:14px;font-size:11px;color:#1e40af;
          display:flex;gap:8px;align-items:flex-start;">
          <span>🤖</span>
          <span><strong>Auto-filled:</strong> ${m.autoFilled.map(esc).join(' · ')}</span>
        </div>` : '';

      container.innerHTML = `
        <div class="lp3-in" id="lp3-plan-content">

          ${autoNote}

          <!-- SUCCESS BANNER -->
          <div style="
            background:linear-gradient(135deg,#003d25,#006b40,#009960);
            border-radius:var(--lp-radius);padding:16px 20px;margin-bottom:14px;
            display:flex;align-items:center;justify-content:space-between;
            flex-wrap:wrap;gap:10px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:2px;
              background:linear-gradient(90deg,transparent,rgba(255,255,255,.7) 50%,transparent);
              background-size:300% 100%;animation:lp3-shimmer 2.8s linear infinite;"></div>
            <div style="display:flex;align-items:center;gap:10px;position:relative;z-index:1;">
              <span style="font-size:22px;">🎉</span>
              <div>
                <div style="color:#fff;font-size:13px;font-weight:800;">Lesson plan generated!</div>
                <div style="color:rgba(255,255,255,.65);font-size:11px;margin-top:2px;">
                  Review below — then download as PDF or save to library.
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;position:relative;z-index:1;">
              <button id="lp3-pdf" class="lp3-btn"
                style="background:#fff;color:var(--lp-green);font-size:12px;padding:9px 16px;">
                🖨️ Download PDF
              </button>
              <button id="lp3-save" class="lp3-btn"
                style="background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.28);
                font-size:12px;padding:9px 16px;">
                💾 Save to Library
              </button>
            </div>
          </div>

          <!-- LESSON IDENTIFICATION TABLE -->
          <div class="lp3-output-section">
            <div class="lp3-output-head">🏫 Lesson Identification</div>
            <div class="lp3-output-body" style="padding:0;">
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                ${[
                  ['School Name',        m.school    || '—'],
                  ['Name of Teacher',    m.teacher   || '—'],
                  ['Date',               m.date      || '—'],
                  ['Class Level',        m.level     || '—'],
                  ['Duration',           m.duration  || '—'],
                  ['Time / Period',      m.period    || '—'],
                  ['Total No. Learners', m.learners  || '—'],
                  ['Term / Week',        m.term      || '—'],
                  ['Subject',            m.subject   || '—'],
                ].map(([k,v],i) => `
                  <tr style="background:${i%2===0?'var(--lp-bg)':'var(--lp-surface)'};">
                    <td style="padding:8px 14px;font-weight:700;color:var(--lp-text2);
                      width:170px;border-bottom:1px solid var(--lp-border);
                      white-space:nowrap;">${esc(k)}</td>
                    <td style="padding:8px 14px;color:var(--lp-text);
                      border-bottom:1px solid var(--lp-border);">${esc(v)}</td>
                  </tr>`).join('')}
              </table>
            </div>
          </div>

          <!-- CURRICULUM DETAILS -->
          <div class="lp3-output-section">
            <div class="lp3-output-head">📚 Curriculum Details</div>
            <div class="lp3-output-body" style="padding:0;">
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                ${[
                  ['Topic',                m.topic       || '—'],
                  ['Sub-Topic',            m.subtopic    || '—'],
                  ['General Competences',  m.competences || '—'],
                  ['Specific Competences', m.competences || '—'],
                  ['Learning Activities',  m.activities  || '—'],
                  ['Expected Standard',    m.standard    || '—'],
                  ['References',           m.refs        || '—'],
                ].map(([k,v],i) => `
                  <tr style="background:${i%2===0?'var(--lp-bg)':'var(--lp-surface)'};">
                    <td style="padding:8px 14px;font-weight:700;color:var(--lp-text2);
                      width:170px;border-bottom:1px solid var(--lp-border);
                      white-space:nowrap;">${esc(k)}</td>
                    <td style="padding:8px 14px;color:var(--lp-text);
                      border-bottom:1px solid var(--lp-border);white-space:pre-wrap;">${esc(v)}</td>
                  </tr>`).join('')}
              </table>
            </div>
          </div>

          <!-- LESSON GOAL -->
          <div class="lp3-output-section">
            <div class="lp3-output-head">🎯 Lesson Goal</div>
            <div class="lp3-output-body">${esc(p.lessonGoal || '—')}</div>
          </div>

          <!-- RATIONALE -->
          <div class="lp3-output-section">
            <div class="lp3-output-head">💡 Rationale</div>
            <div class="lp3-output-body">${esc(p.rationale || '—')}</div>
          </div>

          <!-- PRIOR KNOWLEDGE -->
          <div class="lp3-output-section">
            <div class="lp3-output-head">🧠 Prior Knowledge</div>
            <div class="lp3-output-body">${esc(p.priorKnowledge || '—')}</div>
          </div>

          <!-- LEARNING ENVIRONMENT -->
          <div class="lp3-output-section">
            <div class="lp3-output-head">🌍 Learning Environment</div>
            <div class="lp3-output-body" style="padding:0;">
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                ${[
                  ['Natural',       p.learningEnvironment?.natural       || '—'],
                  ['Artificial',    p.learningEnvironment?.artificial    || '—'],
                  ['Technological', p.learningEnvironment?.technological || '—'],
                ].map(([k,v],i) => `
                  <tr style="background:${i%2===0?'var(--lp-bg)':'var(--lp-surface)'};">
                    <td style="padding:8px 14px;font-weight:700;color:var(--lp-text2);
                      width:130px;border-bottom:1px solid var(--lp-border);">${esc(k)}</td>
                    <td style="padding:8px 14px;color:var(--lp-text);
                      border-bottom:1px solid var(--lp-border);">${esc(v)}</td>
                  </tr>`).join('')}
              </table>
            </div>
          </div>

          <!-- TEACHING & LEARNING MATERIALS -->
          <div class="lp3-output-section">
            <div class="lp3-output-head">📦 Teaching &amp; Learning Materials</div>
            <div class="lp3-output-body">${matsList || '—'}</div>
          </div>

          <!-- LESSON PROGRESSION TABLE -->
          <div class="lp3-output-section">
            <div class="lp3-output-head">⚡ Lesson Progression</div>
            <div style="overflow-x:auto;">
              <table class="lp3-prog-table">
                <thead>
                  <tr>
                    <th style="width:110px;">Phase / Time</th>
                    <th>Teacher Activity</th>
                    <th>Learner Activity</th>
                    <th style="width:150px;">Assessment Criteria</th>
                  </tr>
                </thead>
                <tbody>${progRows || '<tr><td colspan="4" style="padding:14px;color:var(--lp-text3);text-align:center;">—</td></tr>'}</tbody>
              </table>
            </div>
          </div>

          <!-- CROSS-CUTTING ISSUES -->
          <div class="lp3-output-section">
            <div class="lp3-output-head">🔗 Cross-Cutting Issues</div>
            <div class="lp3-output-body">${crossRows || '—'}</div>
          </div>

          <!-- CLASS EXERCISE -->
          <div class="lp3-output-section">
            <div class="lp3-output-head">📝 Class Exercise</div>
            <div class="lp3-output-body">${exRows || '—'}</div>
          </div>

          <!-- HOMEWORK -->
          <div class="lp3-output-section">
            <div class="lp3-output-head">🏠 Homework</div>
            <div class="lp3-output-body">${hwRows || '—'}</div>
          </div>

          <!-- ANSWER KEY -->
          <div class="lp3-output-section">
            <div class="lp3-output-head" style="display:flex;align-items:center;justify-content:space-between;">
              🔑 Answer Key
              <span style="font-size:9px;font-weight:600;opacity:.6;">Teacher use only</span>
            </div>
            <div class="lp3-output-body">
              ${akExRows || akHwRows ? `
                ${akExRows ? `<div style="font-size:11px;font-weight:700;color:var(--lp-text2);
                    margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">
                    Class Exercise</div>${akExRows}` : ''}
                ${akHwRows ? `<div style="font-size:11px;font-weight:700;color:var(--lp-text2);
                    margin-top:12px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">
                    Homework</div>${akHwRows}` : ''}
              ` : '—'}
            </div>
          </div>

          <!-- SIGNATURE BLOCK -->
          <div class="lp3-output-section">
            <div class="lp3-output-head">✍️ Signatures</div>
            <div class="lp3-output-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                ${["Teacher\u2019s Name & Signature","Head Teacher / HOD Signature",
                   "Date","Date of Supervision"].map(lbl => `
                  <div>
                    <div style="font-size:10px;color:var(--lp-text3);margin-bottom:4px;">${esc(lbl)}</div>
                    <div style="border-bottom:1.5px solid var(--lp-border);padding-bottom:22px;"></div>
                  </div>`).join('')}
              </div>
            </div>
          </div>

          <!-- BOTTOM ACTIONS -->
          <div class="lp3-actions">
            <button id="lp3-pdf2" class="lp3-btn lp3-btn-primary">🖨️ Download PDF</button>
            <button id="lp3-save2" class="lp3-btn lp3-btn-ghost">💾 Save to Library</button>
            <div style="flex:1;"></div>
            <button id="lp3-regen" class="lp3-btn lp3-btn-ghost" style="font-size:12px;">
              🔄 Regenerate
            </button>
          </div>

        </div>`;

      const doSave = async () => {
        if (!lastPlan) return;
        const entry = { ...lastPlan, _id: uid(), _savedAt: now() };
        plans = [entry, ...plans];
        await lpSave(plans);
        refreshLibCount();
        lpToast('💾 Plan saved to Library!');
      };

      sel('lp3-pdf')?.addEventListener('click',  () => exportPDF(lastPlan));
      sel('lp3-pdf2')?.addEventListener('click', () => exportPDF(lastPlan));
      sel('lp3-save')?.addEventListener('click',  doSave);
      sel('lp3-save2')?.addEventListener('click', doSave);
      sel('lp3-regen')?.addEventListener('click', () => {
        container.style.display = 'none';
        sel('lp3-generate')?.click();
      });
    }

    function showGenError(msg) {
      const outputBox = sel('lp3-plan-output');
      if (!outputBox) return;
      outputBox.style.display = 'block';
      outputBox.innerHTML = `
        <div class="lp3-card lp3-in" style="text-align:center;padding:28px;">
          <div style="font-size:38px;margin-bottom:10px;">⚠️</div>
          <div style="font-size:13px;font-weight:800;color:var(--lp-red);margin-bottom:8px;">
            ${esc(msg)}
          </div>
          <div style="font-size:12px;color:var(--lp-text3);line-height:1.65;margin-bottom:16px;">
            Make sure your OpenRouter API key is set in the JS file.<br>
            Replace <code style="background:var(--lp-surface2);padding:1px 5px;
              border-radius:4px;font-size:11px;">YOUR_OPENROUTER_KEY</code>
            with your real key from <strong>openrouter.ai</strong>.
          </div>
          <button id="lp3-retry" class="lp3-btn lp3-btn-primary"
            style="font-size:12px;padding:9px 18px;margin:0 auto;">🔄 Try Again</button>
        </div>`;
      sel('lp3-retry')?.addEventListener('click', runGenerate);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  PDF EXPORT
    // ═════════════════════════════════════════════════════════════════════════
    function exportPDF(p) {
      if (!p) { lpToast('⚠️ No plan to export yet.', 'error'); return; }
      const m = p._meta || {};

      const progRows = (p.lessonProgression || []).map(row => `
        <tr>
          <td class="phase-cell">
            <strong>${esc(row.phase)}</strong><br>
            <span class="dim">${esc(row.duration)}</span>
          </td>
          <td>${esc(row.teacherActivity).replace(/\n/g,'<br>')}</td>
          <td>${esc(row.learnerActivity).replace(/\n/g,'<br>')}</td>
          <td>${esc(row.assessmentCriteria).replace(/\n/g,'<br>')}</td>
        </tr>`).join('');

      const matsList = (p.teachingMaterials || []).map(x =>
        `<span class="chip">${esc(x)}</span>`).join('');

      const crossHtml = (p.crossCuttingIssues || []).map(c =>
        `<p><strong style="color:#006b40;">${esc(c.issue)}:</strong> ${esc(c.description)}</p>`
      ).join('');

      const exHtml = (p.classExercise || []).map(q =>
        `<div class="q-row">
          <span class="q-num">${q.qnum}.</span>
          <span class="q-text">${esc(q.question)}</span>
          <span class="q-mark">[${q.marks} mk${q.marks>1?'s':''}]</span>
        </div>`).join('');

      const hwHtml = (p.homework || []).map(q =>
        `<div class="q-row">
          <span class="q-num">${q.qnum}.</span>
          <span class="q-text">${esc(q.question)}</span>
          <span class="q-mark">[${q.marks} mk${q.marks>1?'s':''}]</span>
        </div>`).join('');

      const akExHtml = (p.answerKey?.classExercise || []).map(a =>
        `<div class="q-row"><span class="q-num">${a.qnum}.</span>
          <span>${esc(a.answer)}</span></div>`).join('');
      const akHwHtml = (p.answerKey?.homework || []).map(a =>
        `<div class="q-row"><span class="q-num">${a.qnum}.</span>
          <span>${esc(a.answer)}</span></div>`).join('');

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Lesson Plan — ${esc(m.topic || 'TeachMate')}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Plus Jakarta Sans',Arial,sans-serif; background:#fff;
         color:#0d1f18; font-size:11.5px; }
  .page { max-width:794px; margin:0 auto; padding:24px 28px; }
  .hdr {
    background:linear-gradient(135deg,#003d25,#006b40,#009960);
    border-radius:10px; padding:18px 22px; margin-bottom:18px; color:#fff;
    position:relative; overflow:hidden;
  }
  .hdr-accent {
    position:absolute;right:-16px;top:-16px;width:80px;height:80px;
    border-radius:50%;background:rgba(255,255,255,.06);
  }
  .hdr-label { font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;opacity:.65;margin-bottom:4px; }
  .hdr-title { font-size:17px;font-weight:900;margin-bottom:6px;line-height:1.2; }
  .hdr-meta  { display:flex;flex-wrap:wrap;gap:12px;font-size:10px;opacity:.8; }
  .hdr-meta span { display:flex;align-items:center;gap:3px; }
  .section { margin-bottom:14px;border:1.5px solid #d4ede4;border-radius:9px;overflow:hidden; }
  .section-head {
    background:#f0faf5;padding:7px 13px;
    font-size:9.5px;font-weight:800;color:#006b40;
    text-transform:uppercase;letter-spacing:.07em;
    border-bottom:1px solid #d4ede4;
  }
  .section-body { padding:10px 13px;line-height:1.75;color:#0d1f18;white-space:pre-wrap; }
  table { width:100%;border-collapse:collapse; }
  th { background:#f0faf5;padding:7px 10px;font-size:9.5px;font-weight:800;color:#006b40;text-transform:uppercase;letter-spacing:.06em;text-align:left;border:1px solid #d4ede4; }
  td { padding:8px 10px;border:1px solid #d4ede4;vertical-align:top;line-height:1.7; }
  tr:nth-child(even) td { background:#f9fefb; }
  .phase-cell { font-weight:700;color:#006b40;white-space:nowrap; }
  .dim { font-size:9.5px;font-weight:500;color:#8aab9c; }
  td.kv-key { font-weight:700;color:#3d6657;width:150px;white-space:nowrap; }
  .chip { display:inline-block;background:#dcfce7;border:1px solid #bbf7d0;color:#006b40;padding:2px 9px;border-radius:20px;font-size:10px;margin:2px; }
  .q-row { display:flex;gap:7px;margin-bottom:7px;align-items:baseline; }
  .q-num  { font-weight:800;color:#006b40;flex-shrink:0;min-width:20px; }
  .q-text { flex:1; }
  .q-mark { font-size:9.5px;color:#8aab9c;flex-shrink:0; }
  .sig-grid { display:grid;grid-template-columns:1fr 1fr;gap:20px; }
  .sig-line { border-bottom:1.5px solid #d4ede4;padding-bottom:22px;margin-top:4px; }
  .sig-label { font-size:9.5px;color:#8aab9c; }
  .footer { margin-top:18px;text-align:center;font-size:9.5px;color:#8aab9c;border-top:1px solid #f0faf5;padding-top:10px; }
  @media print { body{margin:0;} .page{padding:16px 20px;} .section{break-inside:avoid;} }
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <div class="hdr-accent"></div>
    <div class="hdr-label" style="position:relative;z-index:1;">📚 TeachMate 3.0 · Zambia Ministry of Education Lesson Plan</div>
    <div class="hdr-title" style="position:relative;z-index:1;">${esc(m.topic || 'Lesson Plan')}${m.subtopic ? ` — ${esc(m.subtopic)}` : ''}</div>
    <div class="hdr-meta" style="position:relative;z-index:1;">
      ${m.level   ? `<span>🎓 ${esc(m.level)}</span>`   : ''}
      ${m.subject ? `<span>📚 ${esc(m.subject)}</span>` : ''}
      ${m.term    ? `<span>📅 ${esc(m.term)}</span>`    : ''}
      ${m.date    ? `<span>🗓 ${esc(m.date)}</span>`    : ''}
      ${m.duration? `<span>⏱ ${esc(m.duration)}</span>`:''}
      ${m.learners? `<span>👥 ${esc(m.learners)} learners</span>` : ''}
      ${m.teacher ? `<span>👩‍🏫 ${esc(m.teacher)}</span>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-head">🏫 Lesson Identification</div>
    <table>
      ${[['School Name',m.school||'—'],['Name of Teacher',m.teacher||'—'],['Date',m.date||'—'],
         ['Class Level',m.level||'—'],['Duration',m.duration||'—'],['Time / Period',m.period||'—'],
         ['Total No. of Learners',m.learners||'—'],['Term / Week',m.term||'—'],['Subject',m.subject||'—']]
        .map(([k,v])=>`<tr><td class="kv-key">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
    </table>
  </div>

  <div class="section">
    <div class="section-head">📚 Curriculum Details</div>
    <table>
      ${[['Topic',m.topic||'—'],['Sub-Topic',m.subtopic||'—'],
         ['Specific Competences',m.competences||'—'],['Learning Activities',m.activities||'—'],
         ['Expected Standard',m.standard||'—'],['References',m.refs||'—']]
        .map(([k,v])=>`<tr><td class="kv-key">${esc(k)}</td><td style="white-space:pre-wrap;">${esc(v)}</td></tr>`).join('')}
    </table>
  </div>

  <div class="section"><div class="section-head">🎯 Lesson Goal</div>
    <div class="section-body">${esc(p.lessonGoal||'—')}</div></div>

  <div class="section"><div class="section-head">💡 Rationale</div>
    <div class="section-body">${esc(p.rationale||'—')}</div></div>

  <div class="section"><div class="section-head">🧠 Prior Knowledge</div>
    <div class="section-body">${esc(p.priorKnowledge||'—')}</div></div>

  <div class="section">
    <div class="section-head">🌍 Learning Environment</div>
    <table>
      ${[['Natural',p.learningEnvironment?.natural||'—'],
         ['Artificial',p.learningEnvironment?.artificial||'—'],
         ['Technological',p.learningEnvironment?.technological||'—']]
        .map(([k,v])=>`<tr><td class="kv-key">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
    </table>
  </div>

  <div class="section"><div class="section-head">📦 Teaching &amp; Learning Materials</div>
    <div class="section-body">${matsList||'—'}</div></div>

  <div class="section">
    <div class="section-head">⚡ Lesson Progression</div>
    <table>
      <thead><tr>
        <th style="width:100px;">Phase / Time</th>
        <th>Teacher Activity</th><th>Learner Activity</th>
        <th style="width:140px;">Assessment Criteria</th>
      </tr></thead>
      <tbody>${progRows||'<tr><td colspan="4" style="text-align:center;padding:12px;color:#8aab9c;">—</td></tr>'}</tbody>
    </table>
  </div>

  <div class="section"><div class="section-head">🔗 Cross-Cutting Issues</div>
    <div class="section-body">${crossHtml||'—'}</div></div>

  <div class="section"><div class="section-head">📝 Class Exercise</div>
    <div class="section-body">${exHtml||'—'}</div></div>

  <div class="section"><div class="section-head">🏠 Homework</div>
    <div class="section-body">${hwHtml||'—'}</div></div>

  <div class="section">
    <div class="section-head">🔑 Answer Key &nbsp;<span style="font-size:9px;font-weight:600;opacity:.55;">(Teacher use only)</span></div>
    <div class="section-body">
      ${akExHtml?`<p style="font-size:9.5px;font-weight:700;color:#3d6657;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Class Exercise</p>${akExHtml}`:''}
      ${akHwHtml?`<p style="font-size:9.5px;font-weight:700;color:#3d6657;text-transform:uppercase;letter-spacing:.06em;margin:12px 0 8px;">Homework</p>${akHwHtml}`:''}
      ${!akExHtml&&!akHwHtml?'—':''}
    </div>
  </div>

  <div class="section">
    <div class="section-head">✍️ Signatures</div>
    <div class="section-body">
      <div class="sig-grid">
        ${["Teacher\u2019s Name & Signature","Head Teacher / HOD Signature","Date","Date of Supervision"]
          .map(l=>`<div><div class="sig-label">${esc(l)}</div><div class="sig-line"></div></div>`).join('')}
      </div>
    </div>
  </div>

  <div class="footer">
    Generated by TeachMate 3.0 · Zambia Ministry of Education Format ·
    ${new Date().toLocaleDateString('en-ZM',{day:'numeric',month:'long',year:'numeric'})}
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},600);};<\/script>
</body>
</html>`;

      const win = window.open('', '_blank', 'width=900,height=750,menubar=no,toolbar=no');
      if (win) {
        win.document.write(html);
        win.document.close();
        lpToast('🖨️ Print window opened!');
      } else {
        try {
          const blob = new Blob([html], { type:'text/html;charset=utf-8' });
          const url  = URL.createObjectURL(blob);
          const a    = Object.assign(document.createElement('a'), {
            href: url,
            download: `LessonPlan_${(m.topic||'plan').replace(/\s+/g,'_').slice(0,40)}_${(m.date||'').slice(0,10)}.html`
          });
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 3000);
          lpToast('📄 Downloaded as HTML — open in browser and print to PDF.');
        } catch {
          lpToast('⚠️ Allow pop-ups to export PDF.', 'error');
        }
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  TAB: LIBRARY
    // ═════════════════════════════════════════════════════════════════════════
    function renderLibrary(body) {
      let searchQ = '';

      function draw() {
        const shown = plans.filter(p => {
          if (!searchQ) return true;
          const q = searchQ.toLowerCase();
          const m = p._meta || {};
          return `${m.topic} ${m.subject} ${m.level} ${m.term}`
            .toLowerCase().includes(q);
        });

        body.innerHTML = `
          <div style="max-width:760px;margin:0 auto;" class="lp3-in">
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap;">
              <input id="lib-q" class="lp3-field" style="flex:1;min-width:180px;"
                placeholder="🔍 Search plans…" value="${esc(searchQ)}">
              <span style="font-size:11.5px;color:var(--lp-text3);white-space:nowrap;">
                ${shown.length} of ${plans.length} plan${plans.length!==1?'s':''}
              </span>
            </div>

            ${plans.length === 0 ? `
              <div style="text-align:center;padding:60px 20px;">
                <div style="font-size:52px;margin-bottom:12px;">📭</div>
                <div style="font-size:15px;font-weight:800;color:var(--lp-text);">No saved plans yet</div>
                <div style="font-size:12px;color:var(--lp-text3);margin-top:6px;line-height:1.6;">
                  Generate a lesson plan and click <strong>💾 Save to Library</strong>.
                </div>
              </div>`
            : shown.length === 0 ? `
              <div style="text-align:center;padding:40px;color:var(--lp-text3);font-size:13px;">
                No plans match your search.
              </div>`
            : shown.map(p => {
                const m = p._meta || {};
                return `
                  <div class="lp3-plan-card">
                    <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;">
                      <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;font-weight:800;color:var(--lp-text);
                          margin-bottom:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                          📖 ${esc(m.topic || 'Untitled')}
                          ${m.subtopic ? `<span style="font-weight:500;color:var(--lp-text3);font-size:12px;">
                            — ${esc(m.subtopic)}</span>` : ''}
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:7px;font-size:11px;color:var(--lp-text3);">
                          ${m.level   ? `<span>🎓 ${esc(m.level)}</span>`   : ''}
                          ${m.subject ? `<span>📚 ${esc(m.subject)}</span>` : ''}
                          ${m.term    ? `<span>📅 ${esc(m.term)}</span>`    : ''}
                          ${m.duration? `<span>⏱ ${esc(m.duration)}</span>`:''}
                          ${m.date    ? `<span>🗓 ${esc(m.date)}</span>`    : ''}
                          ${m.autoFilled ? `<span style="background:#dbeafe;color:#1d4ed8;
                            padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700;
                            border:1px solid #bfdbfe;">🤖 Auto-filled</span>` : ''}
                        </div>
                      </div>
                      <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;">
                        <button class="lp3-btn lp3-btn-ghost lib-pdf" data-id="${p._id}"
                          style="padding:7px 13px;font-size:11.5px;">🖨️ PDF</button>
                        <button class="lp3-btn lp3-btn-danger lib-del" data-id="${p._id}"
                          style="padding:7px 10px;font-size:11.5px;">🗑️</button>
                      </div>
                    </div>
                  </div>`;
              }).join('')}
          </div>`;

        sel('lib-q')?.addEventListener('input', e => { searchQ = e.target.value; draw(); });

        body.querySelectorAll('.lib-pdf').forEach(btn => btn.addEventListener('click', () => {
          const p = plans.find(x => x._id === btn.dataset.id);
          if (p) exportPDF(p);
        }));

        body.querySelectorAll('.lib-del').forEach(btn => btn.addEventListener('click', async () => {
          const p = plans.find(x => x._id === btn.dataset.id);
          if (!confirm(`Delete plan "${p?._meta?.topic || 'this plan'}"?`)) return;
          plans = plans.filter(x => x._id !== btn.dataset.id);
          await lpSave(plans);
          refreshLibCount();
          lpToast('🗑️ Plan deleted');
          draw();
        }));
      }

      draw();
    }

    render();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  AUTO-INIT
  // ═══════════════════════════════════════════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

console.log('[TeachMate LP3] ✅ AI Lesson Planner v3.1 loaded — Smart Auto-Fill + Usage Guide');
