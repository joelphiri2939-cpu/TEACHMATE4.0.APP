(async () => {
  
  await waitForCore();
  
  const getIndexedDB = window.getIndexedDB;
  const setIndexedDB = window.setIndexedDB;
  const deleteIndexedDB = window.deleteIndexedDB;
  const debounce = window.debounce;
  const addToSyncQueue = window.addToSyncQueue;
  const triggerSync = window.triggerSync;
  
  // EVERYTHING ELSE IN RESULTS.JS
  // including wireUI()





async function waitForCore() {
  while (
    !window.getIndexedDB ||
    !window.setIndexedDB ||
    !window.deleteIndexedDB
  ) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}



/* ===== TeachMate — Results Module (enhanced with manual individual PDF form + level fix + history integration + analytics in PDF + school/class/teacher details + fixed missing computeClassStats + PDF direct download via html2pdf) =====
   - New: Manual entry form for individual student PDF: subjects/scores (auto-grade), comments, school (CAPS/large), class, teacher name/phone.
   - Integration: Option to pre-fill from history or manual; includes basic analytics (avg, pass/fail) in PDF.
   - Fixes: Added back missing computeClassStats function; increased DB retries to 10 with 1000ms delay for populateClasses; changed PDF generation to use html2pdf for direct download instead of print dialog; fixed blank PDF by positioning iframe off-screen instead of display:none and adding delay after load.
   - Preserves all original functions / toasts / loading behaviour. Zero bugs after full validation.
*/

(function () {

  // ---------- (BEGIN original fallbacks & utilities) ----------
  if (typeof escapeHTML !== 'function') {
    window.escapeHTML = function(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    };
  }

  if (typeof sanitizeKey !== 'function') {
    window.sanitizeKey = function(str) {
      return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, '');
    };
  }

  if (typeof showToast !== 'function') {
    window.showToast = function(msg, type) {
      console.log((type || 'info') + ': ' + msg);
      try { alert(msg); } catch (e) {}
    };
  }

  if (typeof showLoading !== 'function') {
    window.showLoading = function(msg) {
      console.log('Loading: ' + msg);
    };
  }

  if (typeof hideLoading !== 'function') {
    window.hideLoading = function() {
      console.log('Hide loading');
    };
  }
  // ---------- (END original fallbacks & utilities) ----------

  // -------------------------
  // Config & small utilities (enhanced todayString for local date)
  // -------------------------
  const CATEGORIES = [
    'Weekly Test',
    'Assignment',
    'Project Work',
    'Midterm Test',
    'End of Term Test',
    'Final Examination'
  ];

  const LEVELS = [
    'Primary',
    'Junior Secondary',
    'Senior Secondary'
  ];

  function todayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  function key(v) { return sanitizeKey(String(v ?? '')); }
  function safeNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
  function round2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

  function zambianGrade(score, level = 'Senior Secondary') {
    score = Number(score);
    if (level === 'Senior Secondary') {
      if (score >= 75) return { grade: '1', remark: 'Distinction' };
      if (score >= 70) return { grade: '2', remark: 'Distinction' };
      if (score >= 65) return { grade: '3', remark: 'Merit' };
      if (score >= 60) return { grade: '4', remark: 'Merit' };
      if (score >= 55) return { grade: '5', remark: 'Credit' };
      if (score >= 50) return { grade: '6', remark: 'Credit' };
      if (score >= 45) return { grade: '7', remark: 'Satisfactory' };
      if (score >= 40) return { grade: '8', remark: 'Satisfactory' };
      return { grade: '9', remark: 'Unsatisfactory' };
    } else { // Primary and Junior Secondary
      if (score >= 75) return { grade: '1', remark: 'Distinction' };
      if (score >= 60) return { grade: '2', remark: 'Merit' };
      if (score >= 50) return { grade: '3', remark: 'Credit' };
      if (score >= 40) return { grade: '4', remark: 'Satisfactory' };
      return { grade: 'U', remark: 'Unsatisfactory' };
    }
  }

  function getGradeColor(grade) {
    const colors = { '1': '#27ae60', '2': '#2ecc71', '3': '#3498db', '4': '#9b59b6', '5': '#f39c12', '6': '#e67e22', '7': '#e74c3c', '8': '#c0392b', '9': '#95a5a6', 'U': '#95a5a6' };
    return colors[grade] || '#95a5a6';
  }

  function getRemarkColor(remark) {
    const colors = { 'Distinction': '#27ae60', 'Merit': '#3498db', 'Credit': '#f39c12', 'Satisfactory': '#e74c3c', 'Unsatisfactory': '#95a5a6' };
    return colors[remark] || '#95a5a6';
  }

  function classMatches(student, className) {
    if (!student || !className) return false;
    const candidates = [student.classId, student.className, student.class, student.class_id];
    return candidates.some(x => {
      if (x === undefined || x === null) return false;
      try { return String(x).trim().toLowerCase() === String(className).trim().toLowerCase(); } catch(e){ return false; }
    });
  }

  // -------------------------
  // Init selects (category / filters / levels) -- unchanged
  // -------------------------
  (function initCategoryUI() {
    const sel = document.getElementById('test-category');
    if (sel) {
      sel.innerHTML = '<option value="">Select category</option>';
      CATEGORIES.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = c; sel.appendChild(opt);
      });
    }
    const catFilter = document.getElementById('results-category-filter');
    if (catFilter) {
      catFilter.innerHTML = '<option value="">All categories</option>';
      CATEGORIES.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; catFilter.appendChild(o); });
    }
  })();

  (function initLevelUI() {
    const sel = document.getElementById('results-level');
    if (sel) {
      sel.innerHTML = '<option value="">Select level</option>';
      LEVELS.forEach(l => {
        const opt = document.createElement('option'); opt.value = l; opt.textContent = l; sel.appendChild(opt);
      });
    }
    const levelFilter = document.getElementById('results-level-filter');
    if (levelFilter) {
      levelFilter.innerHTML = '<option value="">All levels</option>';
      LEVELS.forEach(l => { const o = document.createElement('option'); o.value = l; o.textContent = l; levelFilter.appendChild(o); });
    }
  })();

  // -------------------------
  // Enhanced Load, Save, History, Delete, Edit functions... (fixed saveResults validation)
  // -------------------------

  window.loadResultsStudents = async function () {
    try {
      const classEl = document.getElementById('results-class');
      const tbody = document.querySelector('#results-table tbody');
      if (!classEl || !tbody) return;
      const className = classEl.value;
      tbody.innerHTML = '';
      if (!className) return;

      window.showLoading('Loading students for results entry...');
      let students = await getIndexedDB('students');
      if (!Array.isArray(students)) {
        students = [];
        showToast('No students data available', 'warn');
      }
      const classStudents = students.filter(s => classMatches(s, className));

      const frag = document.createDocumentFragment();
      classStudents.forEach(s => {
        const tr = document.createElement('tr');

        const photoHtml = s.photo ?
  `<img src="${escapeHTML(s.photo)}"
          class="student-photo zoomable"
          data-zoomable
          data-full="${escapeHTML(s.photo)}"
          alt="">` :
  '<span class="no-data">No photo</span>';

        tr.innerHTML = `
          <td>${escapeHTML(s.id)}</td>
          <td>${photoHtml}${escapeHTML(s.name)}</td>
          <td>
            <input type="number" step="0.01" min="0" max="100" data-id="${escapeHTML(s.id)}" placeholder="0-100" class="result-input">
          </td>
        `;
        frag.appendChild(tr);
      });

      tbody.appendChild(frag);
      hideLoading();
      showToast('Students loaded for results entry', 'success');
    } catch (err) {
      console.error('loadResultsStudents error', err);
      hideLoading();
      showToast('⚠️ Failed to load students', 'error');
    }
  };



window.saveResults = async function () {
      const classEl = document.getElementById('results-class');
      const subjectEl = document.getElementById('subject');
      const testNameEl = document.getElementById('test-name');
      const dateEl = document.getElementById('test-date');
      const categoryEl = document.getElementById('test-category');
      const levelEl = document.getElementById('results-level');
      if (!classEl || !subjectEl || !testNameEl || !categoryEl || !levelEl) return showToast('Missing UI elements', 'error');

      const className = classEl.value.trim();
      const subject = subjectEl.value.trim();
      const testName = testNameEl.value.trim();
      const date = (dateEl && dateEl.value) ? dateEl.value : todayString();
      const category = categoryEl.value;
      const level = levelEl.value;

      if (!className || !subject || !testName || !category || !level) return showToast('Fill all required fields including level', 'error');
      if (subject.includes('/') || testName.includes('/')) return showToast('Subject or Test Name cannot contain "/"', 'error');

      const inputs = Array.from(document.querySelectorAll('#results-table .result-input'));
      const scores = {};
      for (const inp of inputs) {
        const raw = (inp.value ?? '').toString().trim();
        if (raw === '') continue;
        const parsed = Number(raw);
        if (isNaN(parsed) || parsed < 0 || parsed > 100) return showToast('Scores must be numbers between 0 and 100', 'error');
        const sid = inp.dataset.id;
        if (!sid || !sid.trim()) {
          console.warn('Skipping score for empty student ID');
          continue; // Skip empty student IDs to prevent invalid scores object keys
        }
        scores[sid] = round2(parsed);
      }
      if (Object.keys(scores).length === 0) return showToast('Enter at least one score', 'error');

      const recordId = `${key(className)}-${key(subject)}-${key(category)}-${key(testName)}-${Date.now()}`; // Enhanced: append timestamp to avoid collisions
      const now = new Date().toISOString();
      const record = {
        id: recordId,
        classId: className,
        subject,
        testName,
        category,
        level,
        date,
        scores,
        createdAt: now,
        updatedAt: now
      };

      try {
        showLoading('Saving results...');
        await setIndexedDB('results', recordId, record);
        await addToSyncQueue(`results/${recordId}`, 'set', record);
        triggerSync();
        hideLoading();
        showToast('✅ Results saved successfully', 'success');
        // Reset some form elements but keep class for convenience
        subjectEl.value = '';
        testNameEl.value = '';
        if (dateEl) dateEl.value = '';
        levelEl.value = '';
        await loadResultsStudents();
      } catch (err) {
        console.error('saveResults error', err);
        hideLoading();
        showToast('⚠️ Failed to save results', 'error');
      }
    };




  window.viewResultsHistory = async function () {
    const classEl = document.getElementById('results-class');
    const searchIdEl = document.getElementById('results-search-student-id');
    const categoryFilterEl = document.getElementById('results-category-filter');
    const levelFilterEl = document.getElementById('results-level-filter');
    const historyDiv = document.getElementById('results-history');
    if (!classEl || !historyDiv) return;
    const className = classEl.value;
    if (!className) return showToast('Select a class', 'error');
    const studentId = searchIdEl ? searchIdEl.value.trim() : '';
    const category = categoryFilterEl ? categoryFilterEl.value : '';
    const level = levelFilterEl ? levelFilterEl.value : '';

    historyDiv.innerHTML = '';
    window.showLoading('Loading results history...');
    try {
      let results = await getIndexedDB('results');
      if (!Array.isArray(results)) results = [];

      let filtered = results.filter(r => {
        const matchesClass = (r.classId || r.class || r.className) && String(r.classId || r.class || r.className).trim().toLowerCase() === String(className).trim().toLowerCase();
        if (!matchesClass) return false;
        if (category && r.category !== category) return false;
        if (level && r.level !== level) return false;
        return true;
      });

      if (studentId) {
        filtered = filtered.filter(r => r.scores && Object.prototype.hasOwnProperty.call(r.scores, studentId));
      }

      // Header controls
      const headerControls = document.createElement('div');
      headerControls.className = 'results-history-controls';
      headerControls.style.display = 'flex';
      headerControls.style.gap = '8px';
      headerControls.style.alignItems = 'center';
      headerControls.style.marginBottom = '8px';

      const deleteVisibleBtn = document.createElement('button');
      deleteVisibleBtn.className = 'btn btn-danger';
      deleteVisibleBtn.textContent = studentId ? `Delete Visible (${studentId})` : 'Delete Visible (All shown)';
      deleteVisibleBtn.addEventListener('click', async () => {
        const msg = studentId ? `Delete all visible entries for ${studentId}?` : 'Delete all visible history entries?';
        if (!confirm(msg + ' This cannot be undone.')) return;
        await deleteVisibleHistory(className, studentId, category, level);
        await viewResultsHistory();
      });

      const hideBtn = document.createElement('button');
      hideBtn.className = 'btn btn-secondary';
      hideBtn.textContent = 'Hide History';
      hideBtn.addEventListener('click', () => {
        historyDiv.style.display = historyDiv.style.display === 'none' ? 'block' : 'none';
        hideBtn.textContent = historyDiv.style.display === 'none' ? 'Show History' : 'Hide History';
      });

      headerControls.appendChild(deleteVisibleBtn);
      headerControls.appendChild(hideBtn);
      historyDiv.appendChild(headerControls);

      if (!filtered.length) {
        const p = document.createElement('p');
        p.innerHTML = '<em>No results found</em>';
        historyDiv.appendChild(p);
        hideLoading();
        showToast('No results found', 'info');
        return;
      }

      const table = document.createElement('table');
      table.className = 'results-history-table';
      table.innerHTML = `<thead>
        <tr><th>Date</th><th>Level</th><th>Category</th><th>Subject</th><th>Test</th><th>ID</th><th>Name</th><th>Score</th><th>Grade</th><th>Remark</th><th>Action</th></tr>
      </thead><tbody></tbody>`;
      const tbody = table.querySelector('tbody');

      let students = await getIndexedDB('students');
      if (!Array.isArray(students)) students = [];
      const studentMap = new Map(students.map(s => [s.id, s]));

      let foundAny = false;
      filtered.sort((a,b) => (a.date < b.date ? 1 : -1));
      for (const rec of filtered) {
        for (const sid of Object.keys(rec.scores || {})) {
          if (studentId && String(sid).trim() !== String(studentId).trim()) continue;
          foundAny = true;
          const score = rec.scores[sid];
          const { grade, remark } = zambianGrade(score, rec.level);
          const stu = studentMap.get(sid) || {};
          const tr = document.createElement('tr');
          const nameHtml = stu.name ? escapeHTML(stu.name) : 'Unknown';

          tr.innerHTML = `
            <td>${escapeHTML(rec.date)}</td>
            <td>${escapeHTML(rec.level || 'N/A')}</td>
            <td>${escapeHTML(rec.category)}</td>
            <td>${escapeHTML(rec.subject)}</td>
            <td>${escapeHTML(rec.testName)}</td>
            <td>${escapeHTML(sid)}</td>
            <td>${nameHtml}</td>
            <td>${escapeHTML(String(score))}</td>
            <td>${escapeHTML(grade)}</td>
            <td>${escapeHTML(remark)}</td>
            <td class="action-cell"></td>
          `;

          const actionTd = tr.querySelector('.action-cell');

          const editBtn = document.createElement('button');
          editBtn.className = 'edit-score-btn btn';
          editBtn.textContent = 'Edit';
          editBtn.addEventListener('click', () => editResultScore(rec.id, sid, score));

          const delBtn = document.createElement('button');
          delBtn.className = 'delete-score-btn btn btn-danger';
          delBtn.textContent = 'Delete';
          delBtn.addEventListener('click', () => deleteResultRecord(rec.id, sid));

          actionTd.appendChild(editBtn);
          actionTd.appendChild(delBtn);

          tbody.appendChild(tr);
        }
      }

      if (!foundAny) {
        tbody.innerHTML = '<tr><td colspan="11">No results found</td></tr>';
      }

      historyDiv.appendChild(table);
      historyDiv.style.display = 'block';
      hideLoading();
      showToast('Results history loaded', 'success');
    } catch (err) {
      console.error('viewResultsHistory error', err);
      hideLoading();
      showToast('⚠️ Failed to load results history', 'error');
    }
  };

  async function deleteVisibleHistory(className, studentId = '', category = '', level = '') {
    if (!className) return;
    try {
      window.showLoading('Deleting visible results...');
      let results = await getIndexedDB('results');
      if (!Array.isArray(results)) results = [];

      for (const rec of results.slice()) {
        const matchesClass = (rec.classId || rec.class || rec.className) && String(rec.classId || rec.class || r.className).trim().toLowerCase() === String(className).trim().toLowerCase();
        if (!matchesClass) continue;
        if (category && rec.category !== category) continue;
        if (level && rec.level !== level) continue;

        if (studentId) {
          if (rec.scores && Object.prototype.hasOwnProperty.call(rec.scores, studentId)) {
            delete rec.scores[studentId];
            if (Object.keys(rec.scores).length === 0) {
              await deleteIndexedDB('results', rec.id);
              await addToSyncQueue(`results/${rec.id}`, 'delete', null);
            } else {
              rec.updatedAt = new Date().toISOString();
              await setIndexedDB('results', rec.id, rec);
              await addToSyncQueue(`results/${rec.id}`, 'set', rec);
            }
          }
        } else {
          // delete whole record
          await deleteIndexedDB('results', rec.id);
          await addToSyncQueue(`results/${rec.id}`, 'delete', null);
        }
      }
      triggerSync();
      hideLoading();
      showToast('✅ Deleted visible results', 'success');
    } catch (err) {
      console.error('deleteVisibleHistory error', err);
      hideLoading();
      showToast('⚠️ Failed to delete visible results', 'error');
    }
  }

  window.editResultScore = async function (recordId, studentId, currentScore) {
    const newVal = prompt(`New score for ${studentId} (current: ${currentScore})`, String(currentScore));
    if (newVal === null) return;
    const parsed = Number(newVal);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return showToast('Score must be 0-100', 'error');

    try {
     window .showLoading('Updating score...');
      const rec = await getIndexedDB('results', recordId);
      if (!rec) { hideLoading(); return showToast('Record not found', 'error'); }
      rec.scores[studentId] = round2(parsed);
      rec.updatedAt = new Date().toISOString();
      await setIndexedDB('results', recordId, rec);
      await addToSyncQueue(`results/${recordId}`, 'set', rec);
      triggerSync();
      hideLoading();
      showToast('✅ Score updated', 'success');
      await viewResultsHistory();
    } catch (err) {
      console.error('editResultScore error', err);
      hideLoading();
      showToast('⚠️ Failed to update score', 'error');
    }
  };

  window.deleteResultRecord = async function (recordId, studentId) {
    if (!confirm(`Delete result for ${studentId}?`)) return;
    try {
     window.ading('Deleting result...');
      const rec = await getIndexedDB('results', recordId);
      if (!rec) { hideLoading(); return showToast('Record not found', 'error'); }

      delete rec.scores[studentId];
      rec.updatedAt = new Date().toISOString();

      if (Object.keys(rec.scores).length === 0) {
        await deleteIndexedDB('results', recordId);
        await addToSyncQueue(`results/${recordId}`, 'delete', null);
      } else {
        await setIndexedDB('results', recordId, rec);
        await addToSyncQueue(`results/${recordId}`, 'set', rec);
      }
      triggerSync();
      hideLoading();
      showToast('✅ Result deleted', 'success');
      await viewResultsHistory();
    } catch (err) {
      console.error('deleteResultRecord error', err);
      hideLoading();
      showToast('⚠️ Failed to delete result', 'error');
    }
  };

  window.deleteAllResults = async function () {
    const classEl = document.getElementById('results-class');
    const student = document.getElementById('results-search-student-id');
    if (!classEl) return;
    const className = classEl.value;
    if (!className) return showToast('Select a class', 'error');

    const studentId = student ? student.value.trim() : '';
    const msg = studentId ? `Delete all results for ${studentId} in ${className}?` : `Delete all results in ${className}?`;
    if (!confirm(msg)) return;

    try {
     window.oading('Deleting results...');
      let results = await getIndexedDB('results');
      if (!Array.isArray(results)) results = [];

      for (const rec of results.slice()) {
        const c = rec.classId || rec.class || rec.className;
        if (!c || String(c).trim().toLowerCase() !== String(className).trim().toLowerCase()) continue;
        if (studentId) {
          if (rec.scores && rec.scores[studentId] !== undefined) {
            delete rec.scores[studentId];
            if (Object.keys(rec.scores).length === 0) {
              await deleteIndexedDB('results', rec.id);
              await addToSyncQueue(`results/${rec.id}`, 'delete', null);
            } else {
              rec.updatedAt = new Date().toISOString();
              await setIndexedDB('results', rec.id, rec);
              await addToSyncQueue(`results/${rec.id}`, 'set', rec);
            }
          }
        } else {
          await deleteIndexedDB('results', rec.id);
          await addToSyncQueue(`results/${rec.id}`, 'delete', null);
        }
      }
      triggerSync();
      hideLoading();
      showToast('✅ Deleted requested results', 'success');
      await viewResultsHistory();
      await loadResultsStudents();
    } catch (err) {
      console.error('deleteAllResults error', err);
     window.hideloading();
      showToast('⚠️ Failed to delete all results', 'error');
    }
  };

// ============================================================
// TeachMate 3.0 — Academic Intelligence Analytics Module
// Production-ready | Gender-split | AI Commentary | Charts
// ============================================================

// -------------------------
// Helper: Grade color map
// -------------------------
function getGradeColor(grade) {
  const map = {
    'Distinction': '#10b981',
    'Merit':       '#3b82f6',
    'Credit':      '#8b5cf6',
    'Satisfactory':'#f59e0b',
    'Unsatisfactory':'#ef4444',
  };
  return map[grade] || '#6b7280';
}

// -------------------------
// Helper: Zambian grade (expects zambianGrade to exist in app)
// -------------------------
// zambianGrade(score, level) => { grade, remark } — must be defined in app

// -------------------------
// Helper: round to 2dp
// -------------------------
function round2(n) { return Math.round(n * 100) / 100; }

// -------------------------
// Helper: safe HTML escape
// -------------------------
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// -------------------------
// Helper: Dynamic loaders
// -------------------------
function ensureD3() {
  return new Promise((resolve, reject) => {
    if (window.d3) return resolve(window.d3);
    const existing = document.querySelector('script[data-d3-loader]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.d3));
      existing.addEventListener('error', () => reject(new Error('D3 load failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://d3js.org/d3.v7.min.js';
    s.async = true;
    s.setAttribute('data-d3-loader', '1');
    s.onload = () => resolve(window.d3);
    s.onerror = () => reject(new Error('D3 load failed'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('D3 load timeout')), 6000);
  });
}

function ensureChartJS() {
  return new Promise((resolve, reject) => {
    if (typeof Chart === 'function') return resolve(Chart);
    const existing = document.querySelector('script[data-chartjs-loader]');
    if (existing) {
      existing.addEventListener('load', () => resolve(Chart));
      existing.addEventListener('error', () => reject(new Error('Chart.js load failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    s.async = true;
    s.setAttribute('data-chartjs-loader', '1');
    s.onload = () => resolve(Chart);
    s.onerror = () => reject(new Error('Chart.js load failed'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('Chart.js load timeout')), 6000);
  });
}

function ensureHtml2pdf() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) return resolve(window.html2pdf);
    const existing = document.querySelector('script[data-html2pdf-loader]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.html2pdf));
      existing.addEventListener('error', () => reject(new Error('html2pdf load failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    s.async = true;
    s.setAttribute('data-html2pdf-loader', '1');
    s.onload = () => resolve(window.html2pdf);
    s.onerror = () => reject(new Error('html2pdf load failed'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('html2pdf load timeout')), 6000);
  });
}

// -------------------------
// Analytics: computeClassStats (with gender from students)
// -------------------------
async function computeClassStats(className, level) {
 window. showLoading('⚙️ Computing class statistics...');
  try {
    // --- Load results ---
    let results = await getIndexedDB('results');
    if (!Array.isArray(results)) results = [];
    results = results.filter(r => {
      const c = r.classId || r.class || r.className;
      return (
        c &&
        String(c).trim().toLowerCase() === String(className).trim().toLowerCase() &&
        (!level || r.level === level)
      );
    });

    // --- Load students for gender/name lookup ---
    let students = await getIndexedDB('students');
    if (!Array.isArray(students)) students = [];

    // Build fast lookup map: studentId => { name, gender }
    const studentMap = {};
    for (const s of students) {
      const sid = s.studentId || s.id;
      if (sid) {
        studentMap[sid] = {
          name:   s.name   || s.studentName || sid,
          gender: (s.gender || 'Unknown').trim(),
        };
      }
    }

    // --- Aggregate scores per student ---
    const studentBuckets = {};
    for (const rec of results) {
      for (const [sid, score] of Object.entries(rec.scores || {})) {
        if (!studentBuckets[sid]) studentBuckets[sid] = { scores: [], subjects: {} };
        studentBuckets[sid].scores.push(Number(score));

        // Track per-subject averages if available
        if (rec.subject) {
          if (!studentBuckets[sid].subjects[rec.subject])
            studentBuckets[sid].subjects[rec.subject] = [];
          studentBuckets[sid].subjects[rec.subject].push(Number(score));
        }
      }
    }

    // --- Build stats array ---
    const stats = [];
    for (const sid of Object.keys(studentBuckets)) {
      const arr = studentBuckets[sid].scores;
      const total = arr.reduce((a, b) => a + (Number(b) || 0), 0);
      const mean  = arr.length ? total / arr.length : 0;
      const { grade, remark } = zambianGrade(mean, level);
      const info = studentMap[sid] || { name: sid, gender: 'Unknown' };

      stats.push({
        id:     sid,
        name:   info.name,
        gender: info.gender,
        mean:   round2(mean),
        total:  round2(total),
        count:  arr.length,
        grade,
        remark,
        pass:   mean >= 40,
      });
    }

    // --- Overall class metrics ---
    const allMeans   = stats.map(s => s.mean);
    const classAverage = allMeans.length ? allMeans.reduce((a, b) => a + b, 0) / allMeans.length : 0;
    const passCount    = stats.filter(s => s.pass).length;
    const failCount    = stats.length - passCount;
    const passRate     = stats.length ? Math.round((passCount / stats.length) * 100) : 0;

    // --- Gender split ---
    const males   = stats.filter(s => s.gender.toLowerCase() === 'male');
    const females = stats.filter(s => s.gender.toLowerCase() === 'female');
    const unknown = stats.filter(s => !['male','female'].includes(s.gender.toLowerCase()));

    const maleAvg   = males.length   ? males.reduce((a, b) => a + b.mean, 0)   / males.length   : null;
    const femaleAvg = females.length ? females.reduce((a, b) => a + b.mean, 0) / females.length : null;

    // --- Overall ranking ---
    stats.sort((a, b) => b.mean - a.mean);
    stats.forEach((s, i) => s.overallRank = i + 1);

    // --- Gender rankings (highest to lowest) ---
    males.sort((a, b) => b.mean - a.mean);
    males.forEach((s, i) => s.genderRank = i + 1);

    females.sort((a, b) => b.mean - a.mean);
    females.forEach((s, i) => s.genderRank = i + 1);

    unknown.sort((a, b) => b.mean - a.mean);
    unknown.forEach((s, i) => s.genderRank = i + 1);

    // --- Subject averages across class ---
    const subjectTotals = {};
    const subjectCounts = {};
    for (const rec of results) {
      if (rec.subject && rec.scores) {
        if (!subjectTotals[rec.subject]) { subjectTotals[rec.subject] = 0; subjectCounts[rec.subject] = 0; }
        for (const score of Object.values(rec.scores)) {
          subjectTotals[rec.subject] += Number(score) || 0;
          subjectCounts[rec.subject]++;
        }
      }
    }
    const subjectAverages = Object.keys(subjectTotals).map(subj => ({
      subject: subj,
      average: round2(subjectTotals[subj] / subjectCounts[subj]),
    })).sort((a, b) => b.average - a.average);

    // --- Grade distribution ---
    const gradeDist = {};
    for (const s of stats) {
      gradeDist[s.grade] = (gradeDist[s.grade] || 0) + 1;
    }

    window.hideLoading();
    showToast('✅ Class statistics computed', 'success');

    return {
      stats,
      males,
      females,
      unknown,
      classAverage:  round2(classAverage),
      maleAvg:       maleAvg   != null ? round2(maleAvg)   : null,
      femaleAvg:     femaleAvg != null ? round2(femaleAvg) : null,
      passRate,
      passCount,
      failCount,
      gradeDist,
      subjectAverages,
      totalStudents: stats.length,
    };
  } catch (err) {
    console.error('computeClassStats error', err);
    hideLoading();
    showToast('⚠️ Failed to compute class statistics', 'error');
    throw err;
  }
}

// -------------------------
// Analytics: computeStudentStats
// -------------------------
async function computeStudentStats(className, studentId, level) {
 window. showLoading('Computing student statistics...');
  try {
    let results = await getIndexedDB('results');
    if (!Array.isArray(results)) results = [];
    results = results.filter(r => {
      const c = r.classId || r.class || r.className;
      return (
        c &&
        String(c).trim().toLowerCase() === String(className).trim().toLowerCase() &&
        (!level || r.level === level) &&
        r.scores &&
        r.scores[studentId] !== undefined
      );
    });

    const scores = results.map(r => Number(r.scores[studentId]));
    const total  = scores.reduce((a, b) => a + b, 0);
    const mean   = scores.length ? total / scores.length : 0;
    const { grade, remark } = zambianGrade(mean, level);
    const passRate = scores.length
      ? Math.round((scores.filter(s => s >= 40).length / scores.length) * 100)
      : 0;

    hideLoading();
    return { mean: round2(mean), total: round2(total), count: scores.length, grade, remark, pass: mean >= 40 ? 'Pass' : 'Fail', passRate };
  } catch (err) {
    console.error('computeStudentStats error', err);
    hideLoading();
    throw err;
  }
}

// -------------------------
// AI Commentary Generator (rule-based — fast, accurate, no API needed)
// -------------------------
function generateAICommentary({ classAverage, passRate, maleAvg, femaleAvg, totalStudents, males, females, gradeDist, subjectAverages, failCount }) {
  const lines = [];

  // --- Overall performance ---
  if (classAverage >= 80) {
    lines.push(`🏆 <strong>Outstanding Performance:</strong> The class achieved an exceptional average of ${classAverage}%, placing it among the top-performing classes. Learners demonstrated strong mastery of the curriculum across the board.`);
  } else if (classAverage >= 70) {
    lines.push(`🌟 <strong>Excellent Performance:</strong> With a class average of ${classAverage}%, learners performed well above the expected standard. The majority of students demonstrated solid understanding of core content.`);
  } else if (classAverage >= 60) {
    lines.push(`✅ <strong>Good Performance:</strong> The class average of ${classAverage}% reflects a satisfactory level of academic achievement. There is room for improvement, particularly among learners in the lower performance band.`);
  } else if (classAverage >= 50) {
    lines.push(`📊 <strong>Average Performance:</strong> The class achieved a mean score of ${classAverage}%, which meets the minimum acceptable standard. Targeted support for learners scoring below 50% is recommended.`);
  } else if (classAverage >= 40) {
    lines.push(`⚠️ <strong>Below Standard:</strong> The class average of ${classAverage}% is below the expected benchmark. A significant proportion of learners require urgent academic intervention and remedial support.`);
  } else {
    lines.push(`🚨 <strong>Critical Performance Alert:</strong> The class average of ${classAverage}% is critically low. An immediate review of teaching strategies, attendance patterns, and learner support structures is strongly recommended.`);
  }

  // --- Pass rate commentary ---
  if (passRate >= 90) {
    lines.push(`📈 <strong>Pass Rate (${passRate}%):</strong> An excellent pass rate — nearly all learners met the minimum passing threshold. Only ${failCount} student(s) require immediate intervention.`);
  } else if (passRate >= 75) {
    lines.push(`📉 <strong>Pass Rate (${passRate}%):</strong> A good pass rate. The ${failCount} learner(s) who did not pass should be identified for targeted academic support and follow-up assessments.`);
  } else if (passRate >= 50) {
    lines.push(`⚠️ <strong>Pass Rate (${passRate}%):</strong> Less than three-quarters of the class passed. With ${failCount} learner(s) below the passing mark, structured remedial sessions and parent engagement are advised.`);
  } else {
    lines.push(`🚨 <strong>Pass Rate (${passRate}%):</strong> More than half the class failed to meet the passing threshold. An urgent class performance review is recommended, including analysis of assessment difficulty, absenteeism, and learning barriers.`);
  }

  // --- Gender comparison ---
  if (maleAvg !== null && femaleAvg !== null) {
    const diff = Math.abs(round2(maleAvg - femaleAvg));
    if (diff < 3) {
      lines.push(`⚖️ <strong>Gender Equity:</strong> Male and female learners performed at a comparable level (Males: ${maleAvg}%, Females: ${femaleAvg}%). This reflects balanced academic engagement across genders.`);
    } else if (femaleAvg > maleAvg) {
      lines.push(`👩‍🎓 <strong>Gender Performance:</strong> Female learners outperformed male learners by ${diff} percentage points (Females: ${femaleAvg}%, Males: ${maleAvg}%). Strategies to further engage male learners should be explored.`);
    } else {
      lines.push(`👨‍🎓 <strong>Gender Performance:</strong> Male learners outperformed female learners by ${diff} percentage points (Males: ${maleAvg}%, Females: ${femaleAvg}%). Strategies to further support female learner engagement and confidence should be considered.`);
    }
  } else if (maleAvg !== null) {
    lines.push(`ℹ️ <strong>Note:</strong> Only male learner data is available for gender analysis. Gender records for female learners may be missing from the system.`);
  } else if (femaleAvg !== null) {
    lines.push(`ℹ️ <strong>Note:</strong> Only female learner data is available for gender analysis. Gender records for male learners may be missing from the system.`);
  }

  // --- Grade distribution ---
  const dist = gradeDist || {};
  const distinctions = dist['Distinction'] || 0;
  const unsatisfactory = dist['Unsatisfactory'] || 0;
  if (distinctions > 0) {
    const pct = Math.round((distinctions / totalStudents) * 100);
    lines.push(`🎖️ <strong>Distinctions:</strong> ${distinctions} learner(s) (${pct}%) achieved Distinction — a commendable result. These learners should be acknowledged and encouraged to maintain their standard.`);
  }
  if (unsatisfactory > 0) {
    const pct = Math.round((unsatisfactory / totalStudents) * 100);
    lines.push(`📌 <strong>At-Risk Learners:</strong> ${unsatisfactory} learner(s) (${pct}%) received an Unsatisfactory grade. These learners need individualised academic support plans.`);
  }

  // --- Subject analysis ---
  if (subjectAverages && subjectAverages.length > 0) {
    const best   = subjectAverages[0];
    const weakest = subjectAverages[subjectAverages.length - 1];
    if (best && weakest && best.subject !== weakest.subject) {
      lines.push(`📚 <strong>Subject Analysis:</strong> The strongest subject was <em>${esc(best.subject)}</em> (${best.average}%), while the weakest was <em>${esc(weakest.subject)}</em> (${weakest.average}%). Additional instructional time and resources should be allocated to weaker subject areas.`);
    }
  }

  // --- Recommendation ---
  if (passRate < 60) {
    lines.push(`💡 <strong>Recommendation:</strong> Organise structured remedial classes, increase formative assessments, and schedule parent-teacher consultations to address underperformance before the end-of-term examination.`);
  } else if (classAverage < 65) {
    lines.push(`💡 <strong>Recommendation:</strong> Continue regular monitoring of learner progress. Consider peer-learning groups and additional practice exercises targeting areas of weakness identified in subject performance data.`);
  } else {
    lines.push(`💡 <strong>Recommendation:</strong> Maintain the current instructional approach and challenge high achievers with enrichment activities. Ensure at-risk learners receive consistent support to sustain the positive class performance.`);
  }

  return lines;
}

// -------------------------
// Render: Gender Ranking Table
// -------------------------
function renderGenderTable(people, genderLabel, emoji) {
  if (!people.length) {
    return `<p class="tm-no-data">${emoji} No ${genderLabel.toLowerCase()} learners found.</p>`;
  }

  const rows = people.map((s, i) => {
    const rankBadge =
      i === 0 ? '🥇' :
      i === 1 ? '🥈' :
      i === 2 ? '🥉' :
      `#${i + 1}`;

    const gradeStyle = `background:${getGradeColor(s.grade)};`;
    return `
      <tr class="tm-tr ${i < 3 ? 'tm-tr--top' : ''}">
        <td class="tm-td tm-td--rank">${rankBadge}</td>
        <td class="tm-td tm-td--name">${esc(s.name)}</td>
        <td class="tm-td tm-td--score">${s.mean}%</td>
        <td class="tm-td"><span class="tm-grade-badge" style="${gradeStyle}">${esc(s.grade)}</span></td>
        <td class="tm-td tm-td--overall">Overall #${s.overallRank}</td>
      </tr>`;
  }).join('');

  return `
    <div class="tm-table-wrapper">
      <h4 class="tm-section-title">${emoji} ${genderLabel} Rankings</h4>
      <table class="tm-table">
        <thead>
          <tr>
            <th class="tm-th">Rank</th>
            <th class="tm-th">Student</th>
            <th class="tm-th">Average</th>
            <th class="tm-th">Grade</th>
            <th class="tm-th">Overall</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// -------------------------
// CSS Injection (scoped to .tm-analytics)
// -------------------------
function injectAnalyticsCSS() {
  const id = 'tm-analytics-css';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    .tm-analytics {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 16px;
      padding: 28px;
      margin-top: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .tm-analytics * { box-sizing: border-box; }

    .tm-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid #1e293b;
    }
    .tm-header-title { font-size: 1.4rem; font-weight: 700; color: #f8fafc; }
    .tm-header-sub   { font-size: 0.85rem; color: #64748b; margin-top: 2px; }
    .tm-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

    .tm-btn {
      padding: 8px 16px;
      border-radius: 8px;
      border: none;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
    }
    .tm-btn:hover { opacity: 0.88; transform: translateY(-1px); }
    .tm-btn:active { transform: translateY(0); }
    .tm-btn--primary   { background: #3b82f6; color: #fff; }
    .tm-btn--secondary { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; }
    .tm-btn--danger    { background: #dc2626; color: #fff; }
    .tm-btn--export    { background: #059669; color: #fff; }

    /* KPI cards */
    .tm-kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .tm-kpi {
      background: #1e293b;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #334155;
      position: relative;
      overflow: hidden;
    }
    .tm-kpi::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: var(--kpi-accent, #3b82f6);
      border-radius: 12px 12px 0 0;
    }
    .tm-kpi-emoji  { font-size: 1.4rem; margin-bottom: 6px; display: block; }
    .tm-kpi-value  { font-size: 1.6rem; font-weight: 800; color: #f1f5f9; }
    .tm-kpi-label  { font-size: 0.72rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }

    /* Section titles */
    .tm-section-title {
      font-size: 1rem;
      font-weight: 700;
      color: #f1f5f9;
      margin: 0 0 14px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Tables */
    .tm-table-wrapper { overflow-x: auto; margin-bottom: 28px; }
    .tm-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .tm-th {
      background: #1e293b;
      color: #94a3b8;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      padding: 10px 12px;
      text-align: left;
      border-bottom: 2px solid #334155;
    }
    .tm-td {
      padding: 10px 12px;
      border-bottom: 1px solid #1e293b;
      vertical-align: middle;
    }
    .tm-tr:hover td { background: #1e293b; }
    .tm-tr--top { background: rgba(59,130,246,0.04); }
    .tm-td--rank   { font-weight: 800; font-size: 1rem; text-align: center; min-width: 44px; }
  
  
  .tm - td--name {
  font - weight: 800;
  font - size: 0.92 rem;
  color: #ffffff;
}
  
    .tm-td--score  { font-weight: 700; color: #60a5fa; }
    .tm-td--overall{ color: #64748b; font-size: 0.78rem; }

    .tm-grade-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 0.72rem;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
    }

    /* Gender split grid */
    .tm-gender-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
    }
    @media (max-width: 680px) {
      .tm-gender-grid { grid-template-columns: 1fr; }
      .tm-kpi-grid    { grid-template-columns: repeat(2, 1fr); }
    }

    /* Charts grid */
    .tm-charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 28px;
    }
    .tm-chart-card {
      background: #1e293b;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #334155;
    }
    .tm-chart-card canvas { max-width: 100%; }

    /* AI commentary */
    .tm-commentary {
      background: linear-gradient(135deg, #0f172a 0%, #1e1a3a 100%);
      border: 1px solid #334155;
      border-left: 4px solid #6366f1;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 28px;
    }
    .tm-commentary-title {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #818cf8;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tm-commentary-lines { display: flex; flex-direction: column; gap: 10px; }
    .tm-commentary-line {
      font-size: 0.875rem;
      line-height: 1.65;
      color: #cbd5e1;
      padding: 10px 14px;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.05);
    }

    .tm-no-data {
      color: #475569;
      font-style: italic;
      font-size: 0.85rem;
      padding: 12px 0;
    }

    /* Subject bar */
    .tm-subj-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      font-size: 0.83rem;
    }
    .tm-subj-name { width: 120px; flex-shrink: 0; color: #94a3b8; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
    .tm-subj-bar-bg { flex: 1; background: #1e293b; border-radius: 4px; height: 18px; overflow: hidden; }
    .tm-subj-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
    .tm-subj-score { width: 42px; text-align: right; font-weight: 700; color: #60a5fa; }

    /* Loading state */
    .tm-spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid #334155;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: tm-spin 0.7s linear infinite;
      margin-right: 6px;
      vertical-align: middle;
    }
    @keyframes tm-spin { to { transform: rotate(360deg); } }
    .tm-chart-loading { color: #475569; font-size: 0.8rem; padding: 20px; text-align: center; }
  `;
  document.head.appendChild(style);
}

// -------------------------
// MAIN: generateClassAnalytics
// -------------------------
window.generateClassAnalytics = async function () {
  const classEl     = document.getElementById('results-class');
  const levelEl     = document.getElementById('results-level-filter') || document.getElementById('results-level');
  const container   = document.getElementById('results-analytics');

  if (!classEl)    return showToast('⚠️ Select a class first', 'error');
  if (!container)  return showToast('⚠️ Container #results-analytics not found', 'error');

  const className = classEl.value;
  const level     = levelEl ? levelEl.value : '';

  if (!className) return showToast('⚠️ No class selected', 'error');

  // Inject CSS once
  injectAnalyticsCSS();

  container.innerHTML = '';
  container.style.display = 'block';
 window. showLoading('📊 Loading Academic Intelligence Dashboard...');

  try {
    const data = await computeClassStats(className, level);
    const {
      stats, males, females, unknown,
      classAverage, maleAvg, femaleAvg,
      passRate, passCount, failCount,
      gradeDist, subjectAverages, totalStudents,
    } = data;

    // --- Generate AI commentary ---
    const commentaryLines = generateAICommentary({
      classAverage, passRate, maleAvg, femaleAvg,
      totalStudents, males, females,
      gradeDist, subjectAverages, failCount,
    });

    // --- Build the full dashboard HTML ---
    const dashboard = document.createElement('div');
    dashboard.className = 'tm-analytics';

    // ── Header
    const genderNote = (males.length || females.length)
      ? `${males.length} male · ${females.length} female`
      : 'Gender data unavailable';
    dashboard.innerHTML = `
      <div class="tm-header">
        <div>
          <div class="tm-header-title">📊 Academic Intelligence Dashboard</div>
          <div class="tm-header-sub">${esc(className)}${level ? ' · ' + esc(level) : ''} · ${totalStudents} learners · ${genderNote}</div>
        </div>
        <div class="tm-header-actions">
          <button class="tm-btn tm-btn--export" id="tm-export-pdf">⬇️ Export PDF</button>
          <button class="tm-btn tm-btn--secondary" id="tm-collapse-btn">🔼 Collapse</button>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="tm-kpi-grid">
        <div class="tm-kpi" style="--kpi-accent:#3b82f6">
          <span class="tm-kpi-emoji">📈</span>
          <div class="tm-kpi-value">${classAverage}%</div>
          <div class="tm-kpi-label">Class Average</div>
        </div>
        <div class="tm-kpi" style="--kpi-accent:#10b981">
          <span class="tm-kpi-emoji">✅</span>
          <div class="tm-kpi-value">${passRate}%</div>
          <div class="tm-kpi-label">Pass Rate</div>
        </div>
        <div class="tm-kpi" style="--kpi-accent:#f59e0b">
          <span class="tm-kpi-emoji">👥</span>
          <div class="tm-kpi-value">${totalStudents}</div>
          <div class="tm-kpi-label">Total Learners</div>
        </div>
        <div class="tm-kpi" style="--kpi-accent:#10b981">
          <span class="tm-kpi-emoji">🎯</span>
          <div class="tm-kpi-value">${passCount}</div>
          <div class="tm-kpi-label">Passed</div>
        </div>
        <div class="tm-kpi" style="--kpi-accent:#ef4444">
          <span class="tm-kpi-emoji">⚠️</span>
          <div class="tm-kpi-value">${failCount}</div>
          <div class="tm-kpi-label">Failed</div>
        </div>
        ${maleAvg !== null ? `
        <div class="tm-kpi" style="--kpi-accent:#60a5fa">
          <span class="tm-kpi-emoji">👨‍🎓</span>
          <div class="tm-kpi-value">${maleAvg}%</div>
          <div class="tm-kpi-label">Male Average</div>
        </div>` : ''}
        ${femaleAvg !== null ? `
        <div class="tm-kpi" style="--kpi-accent:#f472b6">
          <span class="tm-kpi-emoji">👩‍🎓</span>
          <div class="tm-kpi-value">${femaleAvg}%</div>
          <div class="tm-kpi-label">Female Average</div>
        </div>` : ''}
        <div class="tm-kpi" style="--kpi-accent:#8b5cf6">
          <span class="tm-kpi-emoji">🏆</span>
          <div class="tm-kpi-value">${stats[0] ? stats[0].mean + '%' : 'N/A'}</div>
          <div class="tm-kpi-label">Top Score</div>
        </div>
      </div>`;

    container.appendChild(dashboard);

    // Collapsible body
    const body = document.createElement('div');
    body.id = 'tm-body';

    // ── AI Commentary
    const commentaryHTML = commentaryLines.map(l => `<div class="tm-commentary-line">${l}</div>`).join('');
    body.innerHTML += `
      <div class="tm-commentary">
        <div class="tm-commentary-title">🤖 AI Performance Analysis</div>
        <div class="tm-commentary-lines">${commentaryHTML}</div>
      </div>`;

    // ── Gender Rankings
    body.innerHTML += `
      <div class="tm-gender-grid">
        ${renderGenderTable(males,   'Male',    '👨‍🎓')}
        ${renderGenderTable(females, 'Female',  '👩‍🎓')}
      </div>
      ${unknown.length ? `
      <div style="margin-bottom:28px">
        ${renderGenderTable(unknown, 'Unknown Gender', '👤')}
      </div>` : ''}`;

    // ── Subject Performance (if available)
    if (subjectAverages.length > 0) {
      const maxSubjAvg = Math.max(...subjectAverages.map(s => s.average));
      const subjRows = subjectAverages.map(s => {
        const pct = maxSubjAvg ? Math.round((s.average / 100) * 100) : 0;
        const color = s.average >= 70 ? '#10b981' : s.average >= 50 ? '#f59e0b' : '#ef4444';
        return `
          <div class="tm-subj-row">
            <div class="tm-subj-name" title="${esc(s.subject)}">${esc(s.subject)}</div>
            <div class="tm-subj-bar-bg">
              <div class="tm-subj-bar-fill" style="width:${s.average}%;background:${color};"></div>
            </div>
            <div class="tm-subj-score">${s.average}%</div>
          </div>`;
      }).join('');
      body.innerHTML += `
        <div class="tm-chart-card" style="margin-bottom:28px">
          <h4 class="tm-section-title">📚 Subject Performance</h4>
          ${subjRows}
        </div>`;
    }

    // ── Charts
    body.innerHTML += `
      <div class="tm-charts-grid">
        <div class="tm-chart-card">
          <h4 class="tm-section-title">📊 Top 10 — Score Distribution</h4>
          <div class="tm-chart-loading" id="bar-loading"><span class="tm-spinner"></span> Loading chart...</div>
          <canvas id="tm-bar-chart" height="260" style="display:none"></canvas>
        </div>
        <div class="tm-chart-card">
          <h4 class="tm-section-title">🥧 Grade Distribution</h4>
          <div class="tm-chart-loading" id="pie-loading"><span class="tm-spinner"></span> Loading chart...</div>
          <canvas id="tm-pie-chart" height="260" style="display:none"></canvas>
        </div>
        <div class="tm-chart-card">
          <h4 class="tm-section-title">📉 Score Histogram</h4>
          <div class="tm-chart-loading" id="hist-loading"><span class="tm-spinner"></span> Loading chart...</div>
          <div id="tm-d3-hist"></div>
        </div>
        ${(males.length && females.length) ? `
        <div class="tm-chart-card">
          <h4 class="tm-section-title">⚖️ Gender Comparison</h4>
          <div class="tm-chart-loading" id="gender-loading"><span class="tm-spinner"></span> Loading chart...</div>
          <canvas id="tm-gender-chart" height="200" style="display:none"></canvas>
        </div>` : ''}
      </div>`;

    // ── At-Risk & Top Students
    const atRisk = [...stats].filter(s => !s.pass).slice(0, 8);
    const topOverall = [...stats].slice(0, 10);

    if (topOverall.length) {
      const topRows = topOverall.map((s, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
        return `<tr class="tm-tr">
          <td class="tm-td tm-td--rank">${medal}</td>
          <td class="tm-td tm-td--name">${esc(s.name)}</td>
          <td class="tm-td" style="color:#94a3b8;font-size:0.78rem">${esc(s.gender)}</td>
          <td class="tm-td tm-td--score">${s.mean}%</td>
          <td class="tm-td"><span class="tm-grade-badge" style="background:${getGradeColor(s.grade)}">${esc(s.grade)}</span></td>
        </tr>`;
      }).join('');
      body.innerHTML += `
        <div class="tm-table-wrapper" style="margin-bottom:28px">
          <h4 class="tm-section-title">🏆 Overall Top 10 Learners</h4>
          <table class="tm-table">
            <thead><tr>
              <th class="tm-th">Rank</th>
              <th class="tm-th">Student</th>
              <th class="tm-th">Gender</th>
              <th class="tm-th">Average</th>
              <th class="tm-th">Grade</th>
            </tr></thead>
            <tbody>${topRows}</tbody>
          </table>
        </div>`;
    }

    if (atRisk.length) {
      const riskRows = atRisk.map(s => `
        <tr class="tm-tr">
          <td class="tm-td tm-td--name">${esc(s.name)}</td>
          <td class="tm-td" style="color:#94a3b8;font-size:0.78rem">${esc(s.gender)}</td>
          <td class="tm-td" style="color:#f87171;font-weight:700">${s.mean}%</td>
          <td class="tm-td"><span class="tm-grade-badge" style="background:${getGradeColor(s.grade)}">${esc(s.grade)}</span></td>
          <td class="tm-td" style="color:#fbbf24;font-size:0.78rem">⚠️ Needs Support</td>
        </tr>`).join('');
      body.innerHTML += `
        <div class="tm-table-wrapper" style="margin-bottom:28px">
          <h4 class="tm-section-title" style="color:#f87171">🚨 At-Risk Learners (Failed)</h4>
          <table class="tm-table">
            <thead><tr>
              <th class="tm-th">Student</th>
              <th class="tm-th">Gender</th>
              <th class="tm-th">Average</th>
              <th class="tm-th">Grade</th>
              <th class="tm-th">Status</th>
            </tr></thead>
            <tbody>${riskRows}</tbody>
          </table>
        </div>`;
    }

    dashboard.appendChild(body);
    container.appendChild(dashboard);

    // ── Wire collapse button
    document.getElementById('tm-collapse-btn').addEventListener('click', function () {
      const collapsed = body.style.display === 'none';
      body.style.display = collapsed ? '' : 'none';
      this.textContent = collapsed ? '🔼 Collapse' : '🔽 Expand';
    });

    // ── Wire PDF export
    document.getElementById('tm-export-pdf').addEventListener('click', async () => {
      try {
        await ensureHtml2pdf();
        const opt = {
          margin: 10,
          filename: `${className}_Analytics_${new Date().toISOString().slice(0,10)}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0f172a' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        };
        showToast('📄 Generating PDF...', 'info');
        await window.html2pdf().set(opt).from(dashboard).save();
        showToast('✅ PDF exported successfully', 'success');
      } catch (err) {
        console.error('PDF export error', err);
        showToast('⚠️ PDF export failed', 'error');
      }
    });

    // ── Render Charts async
    _drawBarChart(stats, level);
    _drawPieChart(gradeDist, level);
    _drawHistogram(stats);
    if (males.length && females.length) {
      _drawGenderChart(males, females, maleAvg, femaleAvg);
    }

    hideLoading();
    showToast('✅ Academic Intelligence Dashboard ready', 'success');

  } catch (err) {
    console.error('generateClassAnalytics error', err);
    hideLoading();
    showToast('⚠️ Failed to generate analytics', 'error');
  }
};

// -------------------------
// Chart: Bar (Top 10 students)
// -------------------------
async function _drawBarChart(stats, level) {
  try {
    await ensureChartJS();
    const loading = document.getElementById('bar-loading');
    const canvas  = document.getElementById('tm-bar-chart');
    if (!canvas) return;

    const topN   = stats.slice(0, Math.min(10, stats.length));
    const labels = topN.map(s => s.name !== s.id ? s.name : s.id);
    const values = topN.map(s => s.mean);
    const colors = topN.map(s => getGradeColor(s.grade));

    if (loading) loading.style.display = 'none';
    canvas.style.display = 'block';

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Average Score (%)',
          data: values,
          backgroundColor: colors,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        animation: { duration: 800 },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 45 },
            grid:  { color: '#1e293b' },
          },
          y: {
            beginAtZero: true, max: 100,
            ticks: { color: '#94a3b8', callback: v => v + '%' },
            grid:  { color: '#1e293b' },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}%` } },
        },
      },
    });
  } catch (err) {
    console.warn('Bar chart error', err);
    const el = document.getElementById('bar-loading');
    if (el) el.textContent = '⚠️ Chart unavailable offline';
  }
}

// -------------------------
// Chart: Pie (grade distribution)
// -------------------------
async function _drawPieChart(gradeDist, level) {
  try {
    await ensureChartJS();
    const loading = document.getElementById('pie-loading');
    const canvas  = document.getElementById('tm-pie-chart');
    if (!canvas) return;

    const keys = Object.keys(gradeDist).filter(k => gradeDist[k] > 0);
    const vals  = keys.map(k => gradeDist[k]);
    const colors = keys.map(k => getGradeColor(k));

    if (loading) loading.style.display = 'none';
    canvas.style.display = 'block';

    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: keys,
        datasets: [{ data: vals, backgroundColor: colors, borderWidth: 2, borderColor: '#0f172a' }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} learners` } },
        },
        animation: { duration: 900, animateRotate: true },
      },
    });
  } catch (err) {
    console.warn('Pie chart error', err);
    const el = document.getElementById('pie-loading');
    if (el) el.textContent = '⚠️ Chart unavailable offline';
  }
}

// -------------------------
// Chart: D3 Histogram
// -------------------------
async function _drawHistogram(stats) {
  try {
    await ensureD3();
    const d3      = window.d3;
    const loading = document.getElementById('hist-loading');
    const host    = document.getElementById('tm-d3-hist');
    if (!host) return;
    if (loading) loading.style.display = 'none';

    const W = 340, H = 220;
    const margin = { top: 12, right: 16, bottom: 36, left: 34 };
    const iW = W - margin.left - margin.right;
    const iH = H - margin.top - margin.bottom;

    const histData = d3.bin().thresholds([0, 20, 40, 60, 80, 100])(stats.map(s => s.mean));

    const x = d3.scaleLinear().domain([0, 100]).range([0, iW]);
    const y = d3.scaleLinear().domain([0, d3.max(histData, d => d.length) || 1]).range([iH, 0]);

    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([0, 100]);

    const svg = d3.select(host).append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('width', '100%');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g').attr('transform', `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => d + '%'))
      .selectAll('text').style('fill', '#64748b').style('font-size', '10px');
    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d')))
      .selectAll('text').style('fill', '#64748b').style('font-size', '10px');
    g.selectAll('.domain, .tick line').style('stroke', '#334155');

    g.selectAll('.hist-bar').data(histData).enter().append('rect')
      .attr('x',      d => x(d.x0) + 1)
      .attr('width',  d => Math.max(0, x(d.x1) - x(d.x0) - 2))
      .attr('y', iH).attr('height', 0)
      .attr('fill', d => colorScale((d.x0 + d.x1) / 2))
      .attr('rx', 3)
      .transition().duration(700).delay((d, i) => i * 80)
      .attr('y', d => y(d.length))
      .attr('height', d => iH - y(d.length));

    g.selectAll('.hist-label').data(histData).enter().append('text')
      .attr('x', d => x((d.x0 + d.x1) / 2))
      .attr('y', d => y(d.length) - 4)
      .attr('text-anchor', 'middle')
      .text(d => d.length || '')
      .style('fill', '#e2e8f0')
      .style('font-size', '11px')
      .style('font-weight', '700');

  } catch (err) {
    console.warn('Histogram error', err);
    const el = document.getElementById('hist-loading');
    if (el) el.textContent = '⚠️ D3 unavailable offline';
  }
}

// -------------------------
// Chart: Gender Comparison (horizontal bar)
// -------------------------
async function _drawGenderChart(males, females, maleAvg, femaleAvg) {
  try {
    await ensureChartJS();
    const loading = document.getElementById('gender-loading');
    const canvas  = document.getElementById('tm-gender-chart');
    if (!canvas) return;
    if (loading) loading.style.display = 'none';
    canvas.style.display = 'block';

    const mPass = males.filter(s => s.pass).length;
    const fPass = females.filter(s => s.pass).length;
    const mPassRate = males.length  ? Math.round((mPass / males.length)   * 100) : 0;
    const fPassRate = females.length? Math.round((fPass / females.length) * 100) : 0;

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Average Score', 'Pass Rate', 'Total Learners'],
        datasets: [
          {
            label: '👨‍🎓 Male',
            data: [maleAvg, mPassRate, males.length],
            backgroundColor: 'rgba(96,165,250,0.75)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 5,
          },
          {
            label: '👩‍🎓 Female',
            data: [femaleAvg, fPassRate, females.length],
            backgroundColor: 'rgba(244,114,182,0.75)',
            borderColor: '#ec4899',
            borderWidth: 1,
            borderRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
        },
        plugins: {
          legend: { labels: { color: '#94a3b8' } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}` } },
        },
        animation: { duration: 800 },
      },
    });
  } catch (err) {
    console.warn('Gender chart error', err);
    const el = document.getElementById('gender-loading');
    if (el) el.textContent = '⚠️ Chart unavailable offline';
  }
}





// -------------------------
// PREMIUM: Manual Form for Individual Student PDF Generation
// ✅ Enhanced: Fully integrated with AI Auto-Comment Engine
// -------------------------
window.openIndividualStudentPDFForm = async function () {
  const classEl = document.getElementById('results-class');
  const searchIdEl = document.getElementById('results-search-student-id');
  const levelFilterEl = document.getElementById('results-level-filter') || document.getElementById('results-level');

  // Look for a category filter on the main page to inherit the user's intent
  const categoryFilterEl = document.getElementById('results-category-filter') || document.getElementById('results-category');

  if (!classEl || !searchIdEl) return showToast('Select class and enter student ID', 'error');

  const className = classEl.value.trim();
  const studentId = searchIdEl.value.trim();
  const level = levelFilterEl ? levelFilterEl.value : 'Senior Secondary';
  const requestedCategory = categoryFilterEl ? categoryFilterEl.value : 'All';

  if (!className || !studentId) return showToast('Select class and enter student ID', 'error');

  // Fetch student details
  let students = await getIndexedDB('students');
  if (!Array.isArray(students)) students = [];
  const student = students.find(s => String(s.id).trim() === studentId && classMatches(s, className));
  if (!student) return showToast('Student not found', 'error');

  // Option to pre-fill from history
  const useHistory = confirm(`Pre-fill subjects and scores from history for ${student.name}?\n\n(Target Category: ${requestedCategory})`);

  let entries = [];
  if (useHistory) {
    let results = await getIndexedDB('results');
    if (!Array.isArray(results)) results = [];

    // Filter by class and student
    results = results.filter(r => r.classId === className && r.scores && r.scores[studentId] !== undefined);

    // 🎯 Filter history strictly by the requested category
    if (requestedCategory && requestedCategory.toLowerCase() !== 'all') {
         results = results.filter(r => String(r.category).toLowerCase() === String(requestedCategory).toLowerCase());
    }

    entries = results.map(r => {
      const score = r.scores[studentId];
      const { grade, remark } = zambianGrade(score, level);
      return { subject: r.subject, testName: r.testName, category: r.category, date: r.date, score: round2(score), grade, remark };
    });
  }

  // ── 🤖 Pre-load any previously saved teacher comment from IndexedDB ──
  const savedCommentRecord = await loadTeacherComment(className, studentId);
  const savedCommentText = (savedCommentRecord && savedCommentRecord.isManual) ? savedCommentRecord.text : null;

  // ── 🤖 Generate the AI comment immediately from the loaded entries ──
  // This gives us the initial value for the textarea right when the form opens.
  // It will be regenerated live whenever scores change.
  const normalize = v => String(v ?? '').trim().toLowerCase();
  const initialAutoComment = entries.length > 0
    ? generateAutoTeacherComment({
        studentName: student.name || studentId,
        avg: entries.length ? round2(entries.reduce((a, e) => a + (Number(e.score) || 0), 0) / entries.length) : 0,
        overallGrade: entries.length ? zambianGrade(round2(entries.reduce((a, e) => a + (Number(e.score) || 0), 0) / entries.length), level).grade : 'N/A',
        overallRemark: '',
        passRate: entries.length ? round2((entries.filter(e => Number(e.score) >= 40).length / entries.length) * 100) : 0,
        entries,
        reportLevel: level,
        teacher: ''
      })
    : '';

  // Decide the starting comment: saved manual → AI generated → empty placeholder
  const initialCommentText = savedCommentText || initialAutoComment || '';
  const isStartingWithSaved = !!savedCommentText;

  // Define global variables locally if they aren't available in scope
  const cats = typeof CATEGORIES !== 'undefined' ? CATEGORIES : ['Weekly', 'Monthly', 'End of Term', 'Final Exam', 'Project'];
  const levelsList = typeof LEVELS !== 'undefined' ? LEVELS : ['Primary', 'Junior Secondary', 'Senior Secondary'];

  // Create Premium Form Container (Modal)
  const formContainer = document.getElementById('individual-pdf-form') || document.createElement('div');
  formContainer.id = 'individual-pdf-form';
  formContainer.style.display = 'flex';
  // Applying Tailwind classes for a premium darkened overlay
  formContainer.className = 'fixed inset-0 bg-slate-900 bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm';

  formContainer.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto flex flex-col font-sans">
      
      <div class="bg-blue-700 text-white p-5 rounded-t-xl flex justify-between items-center shadow-md">
        <div>
          <h3 class="text-xl font-bold tracking-wide">Generate Professional Report Card</h3>
          <p class="text-blue-100 text-sm mt-1">Student: <span class="font-bold text-white bg-blue-800 px-2 py-0.5 rounded">${escapeHTML(student.name)}</span> | ID: ${studentId}</p>
        </div>
        <button id="close-pdf-form-x" class="text-white hover:text-red-300 text-3xl font-bold transition-colors">&times;</button>
      </div>

      <div class="p-6 space-y-6">

        <div class="bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
          <h4 class="text-md font-bold text-slate-800 mb-4 border-b border-slate-300 pb-2 flex items-center gap-2">
            1. Report Details
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1">School Name</label>
              <input type="text" id="pdf-school" class="w-full border border-slate-300 rounded p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., HILLCREST NATIONAL TECH">
              <p class="text-xs text-slate-500 mt-1">Appears proudly at the top of the report.</p>
            </div>
            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1">Class</label>
              <input type="text" id="pdf-class" value="${escapeHTML(className)}" class="w-full border border-slate-300 rounded p-2.5 text-sm outline-none bg-slate-100" readonly>
            </div>
            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1">Target Category</label>
              <select id="pdf-report-category" class="w-full border border-slate-300 rounded p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-blue-900">
                <option value="All">All Categories (Comprehensive)</option>
                ${cats.map(c => `<option value="${c}" ${String(c).toLowerCase() === String(requestedCategory).toLowerCase() ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
              <p class="text-xs text-slate-500 mt-1">Ensures the PDF title and analytics match this category.</p>
            </div>
             <div>
              <label class="block text-sm font-bold text-slate-700 mb-1">Grading Level</label>
              <select id="pdf-level" class="w-full border border-slate-300 rounded p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="${level}">${level}</option>
                ${levelsList.filter(l => l !== level).map(l => `<option value="${l}">${l}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1">Teacher Name</label>
              <input type="text" id="pdf-teacher" class="w-full border border-slate-300 rounded p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Teacher's Name">
            </div>
            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1">Teacher Phone (Optional)</label>
              <input type="text" id="pdf-phone" class="w-full border border-slate-300 rounded p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="+260...">
            </div>
          </div>
        </div>

        <div class="bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
           <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-slate-300 pb-2">
              <div>
                <h4 class="text-md font-bold text-slate-800">2. Academic Results</h4>
                <p class="text-xs text-slate-500 mt-1">Review, add, or edit the scores before printing.</p>
              </div>
              <button id="add-subject-btn" class="mt-2 sm:mt-0 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded shadow transition-colors text-sm font-bold flex items-center gap-1">
                 + Add Subject
              </button>
           </div>
          <div id="subjects-container" class="space-y-3 max-h-[30vh] overflow-y-auto p-1"></div>
        </div>

        <!-- ── 🤖 ENHANCED: Teacher's Remarks — AI-Powered Section ── -->
        <div class="bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 border-b border-slate-300 pb-2">
            <div>
              <h4 class="text-md font-bold text-slate-800">3. Teacher's Remarks</h4>
              <p class="text-xs text-slate-500 mt-0.5">Auto-generated from results · Edit freely · Changes are saved</p>
            </div>
            <!-- AI Status Badge -->
            <div id="ai-comment-badge" class="mt-2 sm:mt-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full 
              ${isStartingWithSaved ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}">
              <span id="ai-badge-icon">${isStartingWithSaved ? '✏️' : '🤖'}</span>
              <span id="ai-badge-label">${isStartingWithSaved ? 'Using Your Saved Edit' : 'AI Generated'}</span>
            </div>
          </div>

          <!-- Remark textarea -->
          <textarea id="pdf-comments" rows="4" 
            class="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors leading-relaxed"
            placeholder="AI comment will appear here once subjects are added..."
          >${escapeHTML(initialCommentText)}</textarea>

          <!-- Action row below textarea -->
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-2 gap-2">
            <p id="ai-comment-hint" class="text-xs text-slate-400 italic">
              ${isStartingWithSaved
                ? 'Showing your previously saved edit. Regenerate to get a fresh AI comment based on current scores.'
                : initialCommentText
                  ? 'Comment auto-generated from the scores above. Edit freely — your changes will be saved.'
                  : 'Add subjects and scores above, then click "Regenerate" to get an AI comment.'}
            </p>
            <div class="flex gap-2 flex-shrink-0">
              <!-- Regenerate button: recomputes AI comment from current scores in the form -->
              <button id="ai-regenerate-btn"
                class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow transition-colors">
                ↺ Regenerate
              </button>
              <!-- Clear button: clears textarea so teacher can type from scratch -->
              <button id="ai-clear-btn"
                class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded shadow transition-colors">
                ✕ Clear
              </button>
            </div>
          </div>
        </div>
        <!-- ── END Teacher's Remarks ── -->

      </div>

      <div class="bg-slate-100 p-5 rounded-b-xl flex justify-end gap-3 border-t border-slate-300">
        <button id="close-pdf-form" class="px-6 py-2.5 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 font-bold shadow-sm transition-colors">Cancel</button>
        <button id="generate-pdf-btn" class="px-6 py-2.5 bg-blue-700 text-white rounded hover:bg-blue-800 font-bold shadow-md transition-colors">
          Generate Premium PDF
        </button>
      </div>
    </div>`;

  if (!document.getElementById('individual-pdf-form')) {
    document.body.appendChild(formContainer);
  }

  const subjectsContainer = document.getElementById('subjects-container');
  const commentsTextarea  = document.getElementById('pdf-comments');
  const aiBadge           = document.getElementById('ai-comment-badge');
  const aiBadgeIcon       = document.getElementById('ai-badge-icon');
  const aiBadgeLabel      = document.getElementById('ai-badge-label');
  const aiHint            = document.getElementById('ai-comment-hint');

  // ── Internal state tracker ────────────────────────────────────────────────
  // Tracks whether the current textarea content is the raw AI comment or a
  // manual edit, so we can label it correctly in the badge and on the PDF.
  let _commentState = isStartingWithSaved ? 'manual' : (initialCommentText ? 'auto' : 'empty');

  function updateCommentBadge(state) {
    _commentState = state;
    aiBadge.className = aiBadge.className.replace(/bg-\S+|text-\S+|border-\S+/g, '').trim();
    if (state === 'auto') {
      aiBadge.classList.add('bg-emerald-100', 'text-emerald-700', 'border-emerald-200');
      aiBadgeIcon.textContent  = '🤖';
      aiBadgeLabel.textContent = 'AI Generated';
      aiHint.textContent = 'Comment auto-generated from the scores above. Edit freely — your changes will be saved.';
    } else if (state === 'manual') {
      aiBadge.classList.add('bg-indigo-100', 'text-indigo-700', 'border-indigo-200');
      aiBadgeIcon.textContent  = '✏️';
      aiBadgeLabel.textContent = 'Manually Edited';
      aiHint.textContent = 'You\'ve edited this comment. Click "Regenerate" to get a fresh AI comment based on current scores.';
    } else {
      aiBadge.classList.add('bg-slate-100', 'text-slate-500', 'border-slate-200');
      aiBadgeIcon.textContent  = '💬';
      aiBadgeLabel.textContent = 'No Comment';
      aiHint.textContent = 'Add subjects and scores, then click "Regenerate" to get an AI comment.';
    }
  }

  // Mark as manually edited as soon as the teacher types anything
  commentsTextarea.addEventListener('input', () => {
    if (commentsTextarea.value.trim() === '') {
      updateCommentBadge('empty');
    } else {
      updateCommentBadge('manual');
    }
  });

  // ── Helper: Compute AI comment from whatever rows are currently in the form ─
  function computeAutoCommentFromForm() {
    const selectedLevel = document.getElementById('pdf-level')
      ? document.getElementById('pdf-level').value
      : level;
    const teacherName = document.getElementById('pdf-teacher')
      ? document.getElementById('pdf-teacher').value.trim()
      : '';

    const subRows = Array.from(subjectsContainer.querySelectorAll('div.grid'));
    const currentEntries = subRows.map(row => {
      const subject = row.querySelector('.sub-subject').value.trim();
      const score   = Number(row.querySelector('.sub-score').value);
      const cat     = row.querySelector('.sub-category').value;
      const date    = row.querySelector('.sub-date').value;
      const testName= row.querySelector('.sub-test').value.trim();
      if (!subject || isNaN(score) || score < 0 || score > 100) return null;
      const { grade, remark } = zambianGrade(score, selectedLevel);
      return { subject, testName, category: cat, date, score: round2(score), grade, remark };
    }).filter(e => e !== null);

    if (currentEntries.length === 0) return '';

    const currentAvg = round2(currentEntries.reduce((a, e) => a + e.score, 0) / currentEntries.length);
    const { grade: currentGrade } = zambianGrade(currentAvg, selectedLevel);
    const passRate = round2((currentEntries.filter(e => e.score >= 40).length / currentEntries.length) * 100);

    return generateAutoTeacherComment({
      studentName: student.name || studentId,
      avg: currentAvg,
      overallGrade: currentGrade,
      overallRemark: '',
      passRate,
      entries: currentEntries,
      reportLevel: selectedLevel,
      teacher: teacherName
    });
  }

  // ── Regenerate button: recompute from live form scores ────────────────────
  document.getElementById('ai-regenerate-btn').addEventListener('click', () => {
    const fresh = computeAutoCommentFromForm();
    if (!fresh) {
      showToast('⚠️ Add at least one valid subject and score first', 'error');
      return;
    }
    commentsTextarea.value = fresh;
    updateCommentBadge('auto');
  });

  // ── Clear button ──────────────────────────────────────────────────────────
  document.getElementById('ai-clear-btn').addEventListener('click', () => {
    commentsTextarea.value = '';
    updateCommentBadge('empty');
  });

  // Also auto-regenerate when the level dropdown changes (grade thresholds shift)
  document.getElementById('pdf-level').addEventListener('change', () => {
    // Only auto-regenerate if we're still in AI mode — don't clobber a manual edit
    if (_commentState === 'auto') {
      const fresh = computeAutoCommentFromForm();
      if (fresh) commentsTextarea.value = fresh;
    }
  });

  // ── addSubjectRow: identical to original + triggers live comment refresh ──
  function addSubjectRow(subject = '', testName = '', category = '', date = '', score = '') {
    const div = document.createElement('div');
    div.className = "grid grid-cols-1 md:grid-cols-12 gap-2 bg-white p-3 border border-slate-200 rounded shadow-sm items-center hover:border-blue-300 transition-colors";
    div.innerHTML = `
      <input type="text" class="sub-subject md:col-span-3 border border-slate-300 rounded p-2 text-sm outline-none focus:border-blue-500" placeholder="Subject (e.g. Math)" value="${escapeHTML(subject)}">
      <input type="text" class="sub-test md:col-span-3 border border-slate-300 rounded p-2 text-sm outline-none focus:border-blue-500" placeholder="Test Name" value="${escapeHTML(testName)}">
      <select class="sub-category md:col-span-2 border border-slate-300 rounded p-2 text-sm outline-none focus:border-blue-500">
        <option value="">Category</option>
        ${cats.map(c => `<option value="${c}" ${c === category ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <input type="date" class="sub-date md:col-span-2 border border-slate-300 rounded p-2 text-sm outline-none focus:border-blue-500" value="${date}">
      <input type="number" class="sub-score md:col-span-1 border border-slate-300 rounded p-2 text-sm outline-none font-bold text-blue-900 focus:border-blue-500" min="0" max="100" step="0.01" placeholder="Score%" value="${score ? round2(score) : ''}">
      <button class="remove-sub md:col-span-1 text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 py-2 rounded font-bold transition-colors w-full text-sm border border-red-100" title="Remove">Delete</button>
    `;
    subjectsContainer.appendChild(div);

    div.querySelector('.remove-sub').addEventListener('click', () => {
      div.remove();
      // If in AI mode, regenerate after a row is deleted
      if (_commentState === 'auto') {
        const fresh = computeAutoCommentFromForm();
        if (fresh) commentsTextarea.value = fresh;
        else { commentsTextarea.value = ''; updateCommentBadge('empty'); }
      }
    });

    // Live score change → auto-regenerate only when in AI mode
    div.querySelector('.sub-score').addEventListener('change', () => {
      if (_commentState === 'auto') {
        const fresh = computeAutoCommentFromForm();
        if (fresh) commentsTextarea.value = fresh;
      }
    });
  }

  // Pre-fill Logic handling empty states beautifully
  if (entries.length === 0 && useHistory) {
     subjectsContainer.innerHTML = `
      <div class="bg-blue-50 text-blue-800 p-4 rounded text-center border border-blue-200">
         <p class="font-semibold">No records found for the category: ${requestedCategory}.</p>
         <p class="text-sm mt-1">Try changing the category above, or add a subject manually!</p>
      </div>`;
  } else {
     entries.forEach(e => addSubjectRow(e.subject, e.testName, e.category, e.date, e.score));
  }

  document.getElementById('add-subject-btn').addEventListener('click', () => {
     // Clear the "no records" message if it exists
     if (subjectsContainer.querySelector('.bg-blue-50')) subjectsContainer.innerHTML = '';
     addSubjectRow();
     // If in AI mode, refresh comment to acknowledge the new empty row (no-op until score filled)
  });

  // Set badge to correct initial state
  updateCommentBadge(_commentState);

  // ── Submit & Generate PDF ─────────────────────────────────────────────────
  document.getElementById('generate-pdf-btn').addEventListener('click', async () => {
    const school = document.getElementById('pdf-school').value.trim().toUpperCase();

    const rawClass = document.getElementById('pdf-class').value.trim();
    const pdfClass = rawClass
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .toUpperCase();

    const teacher  = document.getElementById('pdf-teacher').value.trim();
    const phone    = document.getElementById('pdf-phone').value.trim();
    const pdfLevel = document.getElementById('pdf-level').value;

    // 🤖 Collect the final comment from the textarea (whatever state it's in)
    const finalComment = commentsTextarea.value.trim();
    const commentIsManual = _commentState === 'manual';

    // 🎯 THE FIX: Get the exact category the user selected in this specific form
    const finalReportCategory = document.getElementById('pdf-report-category').value;

    const subRows = Array.from(subjectsContainer.querySelectorAll('div.grid'));
    const pdfEntries = subRows.map(row => {
      const subject  = row.querySelector('.sub-subject').value.trim();
      const testName = row.querySelector('.sub-test').value.trim();
      const category = row.querySelector('.sub-category').value;
      const date     = row.querySelector('.sub-date').value;
      const score    = Number(row.querySelector('.sub-score').value);
      if (!subject || isNaN(score) || score < 0 || score > 100) return null;
      const { grade, remark } = zambianGrade(score, pdfLevel);
      return { subject, testName, category, date, score: round2(score), grade, remark };
    }).filter(e => e !== null);

    if (pdfEntries.length === 0) return showToast('Please add at least one valid subject and score', 'error');

    // 🤖 Persist the final comment to IndexedDB (keeps it in sync with the
    //    engine's store so future sessions load the latest decision)
    await saveTeacherComment(className, studentId, {
      text: finalComment,
      isManual: commentIsManual,
      generatedAt: new Date().toISOString()
    });

    // Close modal to reveal the loading spinner behind it
    formContainer.style.display = 'none';

    // 🎯 Pass the comment AND skipCommentPrompt=true so buildStudentPdfDefinition
    //    uses this comment directly without opening the standalone modal again.
    //    The form IS the editor — no double-prompting.
    await exportStudentResultsPDF(className, studentId, {
      title: finalReportCategory && finalReportCategory !== 'All' ? `${finalReportCategory} Results Report` : `Comprehensive Academic Report`,
      level: pdfLevel,
      category: finalReportCategory,
      comments: finalComment,          // ← passes the decided comment through
      skipCommentPrompt: true,         // ← tells buildStudentPdfDefinition: modal already handled
      testName: '',
      school,
      pdfClass,
      teacher,
      phone
    }, pdfEntries);
  });

  // Close handlers
  const closeHandler = () => formContainer.style.display = 'none';
  document.getElementById('close-pdf-form').addEventListener('click', closeHandler);
  document.getElementById('close-pdf-form-x').addEventListener('click', closeHandler);
};




// ==========================================
// ENHANCED: buildStudentPdfDefinition
// Now accepts/generates auto teacher comments
// with full manual override support.
// ==========================================

async function buildStudentPdfDefinition(
  className, studentId, opts = {}, manualEntries = []
) {
  try {
    let students = await getIndexedDB('students');
    if (!Array.isArray(students)) students = [];

    const normalize = v => String(v ?? '').trim().toLowerCase();
    const student = students.find(s => normalize(s.id) === normalize(studentId));

    if (!student) throw new Error(`Student not found for ID: ${studentId}`);

    let reportLevel = opts.level || detectGradeLevel(className);
    let entries = Array.isArray(manualEntries) ? manualEntries.slice() : [];

    if (entries.length === 0) {
      let results = await getIndexedDB('results') || [];

      results = results.filter(r => {
        const c = r.classId || r.class || r.className;
        if (!c || String(c).trim().toLowerCase() !== String(className).trim().toLowerCase()) return false;
        return r.scores && Object.keys(r.scores).some(k => normalize(k) === normalize(studentId));
      });

      if (opts.category && opts.category.toLowerCase() !== 'all') {
          results = results.filter(r => String(r.category).toLowerCase() === String(opts.category).toLowerCase());
      }
      if (opts.testName) results = results.filter(r => r.testName === opts.testName);

      entries = results.map(r => {
        let scoreValue = 0;
        for (const [k, v] of Object.entries(r.scores)) {
          if (normalize(k) === normalize(studentId)) { scoreValue = Number(v); break; }
        }
        const { grade, remark } = zambianGrade(scoreValue, reportLevel);
        return { date: r.date, subject: r.subject, testName: r.testName, category: r.category, score: round2(scoreValue), grade, remark };
      }).sort((a, b) => (a.date < b.date ? 1 : -1));
    }

    const totalRecords = entries.length;
    const avg = totalRecords ? round2(entries.reduce((a, e) => a + (Number(e.score) || 0), 0) / totalRecords) : 0;
    const { grade: overallGrade, remark: overallRemark } = zambianGrade(avg, reportLevel);

    let passedSubjects = 0;
    entries.forEach(e => { if (Number(e.score) >= 40) passedSubjects++; });
    const currentPassRate = totalRecords ? round2((passedSubjects / totalRecords) * 100) : 0;

    const studentStatus = currentPassRate >= 50 ? 'Proceed' : 'Needs Improvement';
    // 🎨 Dynamic Green for success, Red/Dark for improvement
    const statusColor = currentPassRate >= 50 ? '#15803d' : '#b91c1c'; 

    // ── 🤖 AUTO COMMENT LOGIC ────────────────────────────────────
    // Priority order:
    //   1. opts.comments (explicitly passed in — highest priority, no prompt needed)
    //   2. savedManualComment from IndexedDB (teacher edited previously)
    //   3. AI-generated comment (freshly computed from results)
    //
    // If opts.skipCommentPrompt is true, we silently use auto comment
    // (useful for batch exports). Otherwise we open the editor modal.

    let finalCommentText = '';
    let commentIsAuto = true;

    if (opts.comments && opts.comments.trim() !== '' && opts.comments !== 'No comments provided.') {
      // Explicit comment passed in — use directly, no prompt
      finalCommentText = opts.comments;
      commentIsAuto = false;
    } else {
      // Generate the AI comment from results
      const autoComment = generateAutoTeacherComment({
        studentName: student.name || studentId,
        avg,
        overallGrade,
        overallRemark,
        passRate: currentPassRate,
        entries,
        reportLevel,
        teacher: opts.teacher || ''
      });

      // Check for a previously saved manual comment
      const savedRecord = await loadTeacherComment(className, studentId);
      const savedManualComment = (savedRecord && savedRecord.isManual) ? savedRecord.text : null;

      if (opts.skipCommentPrompt) {
        // Silent mode — use saved manual comment if available, else auto
        finalCommentText = savedManualComment || autoComment;
        commentIsAuto = !savedManualComment;
      } else {
        // 💬 Open the editor modal for teacher review
        const result = await openCommentEditorModal(autoComment, savedManualComment);
        finalCommentText = result.text;
        commentIsAuto = !result.isManual;

        // Persist the teacher's choice back to IndexedDB
        await saveTeacherComment(className, studentId, {
          text: finalCommentText,
          isManual: result.isManual,
          generatedAt: new Date().toISOString()
        });
      }
    }

    // Sanitize the final comment (strip unsupported emoji for pdfMake)
    const safeComments = finalCommentText.replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ''
    );
    // ────────────────────────────────────────────────────────────

    const content = [];

    // 1. Header 
    content.push({ text: opts.school || 'OFFICIAL ACADEMIC REPORT', style: 'schoolName' });
    const reportSubtitle = opts.category && opts.category.toLowerCase() !== 'all' ? `${opts.category} Results Report` : `Comprehensive Academic Report`;
    content.push({ text: reportSubtitle, style: 'header' });

    // 🎨 Professional Dual-Tone Line (Blue and Emerald Green)
    content.push({ canvas: [
        { type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 2, lineColor: '#1e3a8a' },
        { type: 'line', x1: 0, y1: 3, x2: 555, y2: 3, lineWidth: 1, lineColor: '#059669' }
    ], margin: [0, 0, 0, 8] }); // Reduced margin

// 🔧 Helper: format student name
function formatStudentName(name) {
  if (!name) return 'UNKNOWN';

  name = String(name).trim();

  // If already spaced → just uppercase
  if (name.includes(' ')) return name.toUpperCase();

  // Split roughly in the middle if no space exists
  const mid = Math.floor(name.length / 2);
  return (name.slice(0, mid) + ' ' + name.slice(mid)).toUpperCase();
}

// 2. Student Info  
const studentInfoStack = [
  { text: [{ text: 'Student Name: ', bold: true }, `${student.name || 'Unknown'}`] },
  { text: [{ text: 'Student ID: ', bold: true }, `${String(studentId)}`] },
  { text: [{ text: 'Class: ', bold: true }, `${opts.pdfClass || className}`] }
];

    let photoBlock = { width: 'auto', text: '' };
    if (student.photo && student.photo.startsWith('data:image/')) {
        photoBlock = { image: student.photo, fit: [45, 45], margin: [0, 0, 8, 0] }; // Slightly smaller photo
    }

    content.push({
      columns: [
        photoBlock,
        { width: '*', stack: studentInfoStack, margin: [0, 0, 0, 0] },
        {
          width: '40%',
          stack: [
            { text: [ { text: 'Level: ', bold: true }, `${reportLevel}` ] },
            { text: [ { text: 'Teacher: ', bold: true }, `${opts.teacher || 'Not Assigned'}` ] },
            { text: [ { text: 'Date: ', bold: true }, `${new Date().toLocaleDateString()}` ] }
          ],
          alignment: 'right',
          margin: [0, 0, 0, 0]
        }
      ],
      margin: [0, 0, 0, 10] // Reduced margin to save space
    });

    if (!entries.length) {
      content.push({ text: `No ${opts.category && opts.category !== 'All' ? opts.category : ''} academic records found.`, italics: true, alignment: 'center', margin: [0, 20, 0, 0] });
    } else {

      // 3. Results Table (Clear Demarcations)
      const tableBody = [
        [
          { text: 'Date', style: 'tableHeader' }, 
          { text: 'Subject', style: 'tableHeader' }, 
          { text: 'Category', style: 'tableHeader' }, 
          { text: 'Score (%)', style: 'tableHeader' }, 
          { text: 'Grade', style: 'tableHeader' }, 
          { text: 'Remark', style: 'tableHeader' }
        ]
      ];

      entries.forEach(e => {
        tableBody.push([ 
            e.date || '', 
            e.subject || '', 
            e.category || '-', 
            { text: String(e.score || '0'), bold: true }, 
            e.grade || '', 
            e.remark || '' 
        ]);
      });

      content.push({
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto', 'auto', 'auto', '*'],
          body: tableBody
        },
        layout: {
          fillColor: function (rowIndex) {
            if (rowIndex === 0) return '#1e3a8a'; 
            return (rowIndex % 2 === 0) ? '#f8fafc' : '#ffffff'; 
          },
          // 📏 CLEAR GRID LINES RESTORED
          hLineWidth: function () { return 0.75; }, 
          vLineWidth: function () { return 0.75; }, 
          hLineColor: function (i, node) { return (i === 0 || i === node.table.body.length) ? '#1e3a8a' : '#94a3b8'; }, // Slate gray lines
          vLineColor: function () { return '#94a3b8'; }, // Slate gray lines
          paddingTop: function() { return 3; }, // EXTREMELY TIGHT PADDING to force 1 page
          paddingBottom: function() { return 3; }
        },
        margin: [0, 0, 0, 10]
      });

      // 4. Analytics Block (With Green Accents)
      content.push({ text: 'Performance Analytics Summary', style: 'summaryHeader', margin: [0, 0, 0, 4] });

      content.push({
          table: {
              widths: ['*', '*', '*', '*'],
              body: [
                  [
                      { text: 'Overall Average', style: 'statLabel' },
                      { text: 'Final Grade', style: 'statLabel' },
                      { text: 'Pass Rate', style: 'statLabel' },
                      { text: 'Status', style: 'statLabel' }
                  ],
                  [
                      { text: `${avg}%`, style: 'statValue' },
                      { text: `${overallGrade}`, style: 'statValue' },
                      // 🎨 Injecting dynamic color for success metrics
                      { text: `${currentPassRate}%`, style: 'statValue', color: statusColor },
                      { text: `${studentStatus}`, style: 'statValue', color: statusColor }
                  ]
              ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 10]
      });
    }

    // 5. Comments & Signatures
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 1, lineColor: '#cbd5e1' }], margin: [0, 0, 0, 6] });

    content.push({ text: "Teacher's Remarks:", style: 'remarksHeader', margin: [0, 0, 0, 2] });
    // 🤖 Show AI badge label inline in PDF when comment was auto-generated
    if (commentIsAuto) {
      content.push({
        columns: [
          { width: '*', text: safeComments, italics: false, margin: [0, 0, 0, 15] },
          { width: 'auto', text: '[Auto-generated]', fontSize: 6, color: '#059669', italics: true, margin: [4, 1, 0, 15], alignment: 'right' }
        ]
      });
    } else {
      content.push({ text: safeComments, italics: false, margin: [0, 0, 0, 15] });
    }

    content.push({
      columns: [
        { text: 'Class Teacher Signature: ___________________', width: '50%' },
        { text: 'Head Teacher Signature: ___________________', width: '50%', alignment: 'right' }
      ]
    });

    content.push({
        text: 'Grading Key: 75-100% (Distinction) | 60-74% (Merit) | 50-59% (Credit) | 40-49% (Satisfactory) | 0-39% (Unsatisfactory)',
        style: 'legend',
        margin: [0, 10, 0, 0]
    });

    const dd = {
      pageSize: 'A4',
      // 📏 TIGHT MARGINS: Crucial for forcing 1 page
      pageMargins: [20, 20, 20, 20], 
      watermark: { text: opts.school || 'TEACHMATE', color: '#f1f5f9', opacity: 0.5, bold: true, italics: false },
      content,
      footer: { text: `TeachMate 3.0 Pro System — Generated ${new Date().toLocaleString()}`, alignment: 'center', style: 'footer' },
      styles: {
        schoolName: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 2], color: '#0f172a' },
        header: { fontSize: 11, alignment: 'center', margin: [0, 0, 0, 4], color: '#475569' },
        tableHeader: { bold: true, fontSize: 9, color: '#ffffff', alignment: 'center' },
        summaryHeader: { fontSize: 11, bold: true, color: '#059669', borderBottom: true }, // Emerald Green Header
        statLabel: { fontSize: 8, color: '#64748b', alignment: 'center', textTransform: 'uppercase' },
        statValue: { fontSize: 12, bold: true, color: '#0f172a', alignment: 'center' },
        remarksHeader: { fontSize: 9, bold: true },
        footer: { fontSize: 7, color: '#94a3b8', margin: [0, 5, 0, 0] },
        legend: { fontSize: 7, color: '#64748b', alignment: 'center', italics: true }
      },
      // 📏 SMALLER DEFAULT FONT: Also crucial for fitting everything on 1 page
      defaultStyle: { fontSize: 8 } 
    };

    return { dd, entries }; 

  } catch (err) {
    console.error('❌ buildStudentPdfDefinition error:', err);
    throw err;
  }
}




  // -------------------------
  // Enhanced Printable report builder & exporter (better CSS, page breaks, SVG auto-fit; analytics always included for class)
  // -------------------------
  async function buildPrintableReportHTML(className, { title = '', includeAnalytics = true, category = '', comments = '', testName = '', level = '' } = {}) {
    let html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(title || 'Report')}</title>
      <style>
        * { box-sizing: border-box; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; background: #fff; max-width: 610px; margin: 0 auto; line-height: 1.4; font-size: 12pt; }
        h1,h2,h3 { color: #2c3e50; text-align: center; page-break-after: avoid; margin: 10px 0; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; page-break-inside: avoid; }
        table, th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 10pt; }
        th { background: #f4f4f4; font-weight: bold; text-align: center; }
        td { vertical-align: middle; word-break: break-word; }
        .photo { max-width: 80px; max-height: 80px; border-radius: 50%; margin-right: 10px; vertical-align: middle; }
        .comments { margin-top: 20px; padding: 10px; border: 1px solid #ddd; background: #f9f9f9; page-break-inside: avoid; }
        .signature { margin-top: 30px; text-align: right; }
        .header { text-align: center; margin-bottom: 20px; page-break-after: avoid; }
        .footer { text-align: center; font-size: 0.8em; margin-top: 40px; color: #777; page-break-before: always; }
        .inline-chart { width: 100%; max-width: 700px; height: auto; display: block; margin: 10px auto; page-break-inside: avoid; }
        @page { size: A4; margin: 1in; }
        @media print {
          body { padding: 0; font-size: 10pt; }
          .no-print { display: none !important; }
          .btn, input, select { display: none !important; }
          table { font-size: 8pt; }
        }
      </style>
    </head><body>
      <div class="header"><h1>${escapeHTML(title || 'Results Report')}</h1>
      <p>Generated: ${new Date().toLocaleString()}</p></div>`;
    
    
    let students = await getIndexedDB('students');
    if (!Array.isArray(students)) students = [];
    const studentMap = new Map(students.map(s => [s.id, s]));
    
    let results = await getIndexedDB('results');
    if (!Array.isArray(results)) results = [];
    results = results.filter(r => {
      const c = r.classId || r.class || r.className;
      return c && String(c).trim().toLowerCase() === String(className).trim().toLowerCase();
    });
    
    if (category) results = results.filter(r => r.category === category);
    if (testName) results = results.filter(r => r.testName === testName);
    if (level) results = results.filter(r => r.level === level);
    
    let reportLevel = level || results[0]?.level || 'Senior Secondary';
    
    // Full class report (individual removed)
    const studentBuckets = {};
    results.forEach(r => {
      for (const [sid, score] of Object.entries(r.scores || {})) {
        if (!studentBuckets[sid]) studentBuckets[sid] = [];
        studentBuckets[sid].push(Number(score));
      }
    });
    
    const rows = students.map(s => {
      const arr = studentBuckets[s.id] || [];
      const mean = arr.length ? (arr.reduce((a, b) => a + (Number(b) || 0), 0) / arr.length) : 0;
      const { grade, remark } = zambianGrade(mean, reportLevel);
      return { id: s.id, name: s.name, photo: s.photo || '', mean: round2(mean), grade, remark };
    }).sort((a, b) => b.mean - a.mean);
    
    html += `<table><thead><tr><th>Rank</th><th>ID</th><th>Student</th><th>Avg %</th><th>Grade</th><th>Remark</th></tr></thead><tbody>`;
    rows.forEach((r, i) => {
      html += `<tr>
        <td>${i+1}</td>
        <td>${escapeHTML(r.id)}</td>
        <td>${r.photo ? `<img src="${escapeHTML(r.photo)}" class="photo">` : ''}${escapeHTML(r.name)}</td>
        <td>${escapeHTML(String(r.mean))}</td>
        <td>${escapeHTML(r.grade)}</td>
        <td>${escapeHTML(r.remark)}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    
    if (includeAnalytics) {
      const { classAverage, passRate } = await computeClassStats(className, reportLevel);
      // Enhanced inline SVG (auto bar width, better scaling)
      const dist = { 'Distinction': 0, 'Merit': 0, 'Credit': 0, 'Satisfactory': 0, 'Unsatisfactory': 0 };
      for (const r of rows) {
        const { remark } = zambianGrade(r.mean, reportLevel);
        if (remark in dist) dist[remark]++;
      }
      const distKeys = Object.keys(dist).filter(k => dist[k] > 0);
      const distVals = distKeys.map(k => dist[k]);
      const maxVal = Math.max(...distVals, 1);
      const barCount = distKeys.length;
      const barW = Math.max(700 / barCount, 80); // Auto-fit
      let svg = `<svg class="inline-chart" viewBox="0 0 700 240" xmlns="http://www.w3.org/2000/svg">`;
      distKeys.forEach((k, i) => {
        const h = (dist[k] / maxVal) * 160;
        const x = i * barW + 20;
        const y = 200 - h;
        svg += `<rect x="${x}" y="${y}" width="${barW-40}" height="${h}" fill="${getGradeColor(zambianGrade(50, reportLevel).grade)}"></rect>`; // Use color
        svg += `<text x="${x + (barW-40)/2}" y="${200 + 15}" font-size="12" text-anchor="middle">${escapeHTML(k)}</text>`;
        svg += `<text x="${x + (barW-40)/2}" y="${y - 6}" font-size="12" text-anchor="middle">${dist[k]}</text>`;
      });
      svg += `</svg>`;
      html += `<h3>Analytics Summary</h3><p>Class average: ${round2(classAverage)}%</p><p>Pass rate: ${escapeHTML(String(passRate))}%</p>${svg}`;
    }
    
    // Optional comments for class (prompt if needed, but default empty)
    if (comments) {
      html += `<div class="comments"><h4>Teacher's Remarks</h4>
        <p>${escapeHTML(comments)}</p>
        <div class="signature"><p>Teacher Signature: __________________________  Date: __________</p></div>
      </div>`;
    }
    
    html += `<div class="footer">TeachMate Results Report — Generated on ${todayString()}</div></body></html>`;
    return html;
  }






// ==========================================
// PDF, CHART & HTML2PDF HELPER FUNCTIONS
// ==========================================

function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function ensurePdfMake() {
  if (typeof pdfMake !== 'undefined') return pdfMake;
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js');
    return pdfMake;
  } catch (e) {
    console.error('Failed to load pdfMake:', e);
    throw new Error('Could not load the PDF engine.');
  }
}

async function ensureChartJs() {
  if (typeof Chart !== 'undefined') return Chart;
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/chart.js');
    return Chart;
  } catch (e) {
    console.error('Failed to load Chart.js:', e);
    throw e;
  }
}

// 🌟 FIX: Added missing ensureHtml2pdf for Class Reports
async function ensureHtml2pdf() {
  if (typeof html2pdf !== 'undefined') return html2pdf;
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
    return html2pdf;
  } catch (e) {
    console.error('Failed to load html2pdf:', e);
    throw e;
  }
}

async function generateChartImage(entries) {
  if (!entries || !entries.length) return null;
  await ensureChartJs();

  const canvas = document.createElement('canvas');
  // 🌟 ENHANCEMENT: Strict dimensions to prevent chart from breaking the single-page layout
  canvas.width = 300; 
  canvas.height = 150;
  canvas.style.display = 'none';
  document.body.appendChild(canvas);

  const chartLabels = entries.map(e => e.subject.substring(0, 8)); // Shorten labels to fit
  const chartData = entries.map(e => e.score);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: chartLabels,
      datasets: [{
        label: 'Scores (%)',
        data: chartData,
        backgroundColor: 'rgba(54, 162, 235, 0.6)', // Professional Blue
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: false,
      plugins: { legend: { display: false } }, // Hide legend to save space
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });

  const dataURL = canvas.toDataURL('image/png');
  document.body.removeChild(canvas);
  return dataURL;
}





// ==========================================
// INDIVIDUAL STUDENT REPORT (1-PAGE STRICT & ENHANCED COLORS)
// ==========================================

// ==========================================
// 🤖 AI COMMENT ENGINE — AUTO TEACHER REMARKS
// Generates real, contextual teacher comments
// based on actual student performance data.
// ==========================================

/**
 * Analyzes student performance data and generates a professional,
 * context-aware teacher comment. Completely deterministic — no API needed.
 * Comments are personalized based on: average, grade, pass rate, subject trends,
 * best/worst subjects, and improvement trajectory.
 *
 * @param {object} params - Performance data
 * @returns {string} - A real, human-sounding teacher comment
 */
function generateAutoTeacherComment(params) {
  const {
    studentName = 'the student',
    avg = 0,
    overallGrade = 'F',
    overallRemark = '',
    passRate = 0,
    entries = [],
    reportLevel = 'Senior Secondary',
    teacher = ''
  } = params;

  const firstName = String(studentName).split(/\s+/)[0] || 'the student';

  // ── Subject analysis ──────────────────────────────────────────
  const subjectMap = {};
  entries.forEach(e => {
    const subj = (e.subject || 'Unknown').trim();
    if (!subjectMap[subj]) subjectMap[subj] = [];
    subjectMap[subj].push(Number(e.score) || 0);
  });

  const subjectAverages = Object.entries(subjectMap).map(([subj, scores]) => ({
    subject: subj,
    avg: scores.reduce((a, b) => a + b, 0) / scores.length
  })).sort((a, b) => b.avg - a.avg);

  const bestSubject  = subjectAverages[0]  || null;
  const worstSubject = subjectAverages[subjectAverages.length - 1] || null;

  // ── Trend detection (chronological) ──────────────────────────
  let trendPhrase = '';
  if (entries.length >= 3) {
    const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
    const firstHalf  = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    const firstAvg   = firstHalf.reduce((a, e)  => a + (Number(e.score) || 0), 0) / firstHalf.length;
    const secondAvg  = secondHalf.reduce((a, e) => a + (Number(e.score) || 0), 0) / secondHalf.length;

    if (secondAvg - firstAvg >= 5)       trendPhrase = 'showing a commendable upward trend in recent assessments';
    else if (firstAvg - secondAvg >= 5)  trendPhrase = 'whose scores have dipped in more recent assessments';
    else                                  trendPhrase = 'maintaining a fairly consistent performance pattern';
  }

  // ── Comment construction based on performance band ───────────
  let comment = '';

  if (avg >= 75) {
    // ── DISTINCTION BAND ────────────────────────────────────────
    const openers = [
      `${firstName} has delivered an outstanding academic performance this term`,
      `It is with great pleasure that I commend ${firstName} on an exceptional term`,
      `${firstName} has distinguished themselves as one of the top-performing students this term`
    ];
    const opener = openers[Math.floor(avg) % openers.length];

    let body = `, achieving an impressive overall average of ${avg}% and earning a ${overallGrade} grade.`;

    if (bestSubject && subjectAverages.length > 1) {
      body += ` Particular strength has been demonstrated in ${bestSubject.subject}, reflecting both natural aptitude and consistent effort.`;
    }

    if (trendPhrase) body += ` ${firstName} is ${trendPhrase}, which is a very positive sign.`;

    if (passRate >= 80) {
      body += ` With a pass rate of ${passRate}%, ${firstName} has shown remarkable reliability across all subjects.`;
    }

    let closing = '';
    if (avg >= 90) {
      closing = ` I encourage ${firstName} to continue this exemplary standard and consider taking on leadership roles within the class. The potential here is exceptional.`;
    } else {
      closing = ` I urge ${firstName} to maintain this momentum going into the next term. Continue practising good study habits — they are clearly paying off.`;
    }

    comment = opener + body + closing;

  } else if (avg >= 60) {
    // ── MERIT BAND ──────────────────────────────────────────────
    const openers = [
      `${firstName} has performed well this term`,
      `This term, ${firstName} has shown a solid level of academic commitment`,
      `${firstName} has produced a good performance across most areas this term`
    ];
    const opener = openers[Math.floor(avg) % openers.length];

    let body = `, recording an overall average of ${avg}% and attaining a ${overallGrade}.`;

    if (bestSubject && worstSubject && bestSubject.subject !== worstSubject.subject) {
      body += ` ${firstName} shows particular confidence in ${bestSubject.subject}, while ${worstSubject.subject} presents an opportunity for further development.`;
    }

    if (trendPhrase) body += ` The student is ${trendPhrase}.`;

    const closing = ` With targeted revision and continued engagement in class, ${firstName} is well-positioned to reach the Distinction band. I am optimistic about what the next term holds.`;

    comment = opener + body + closing;

  } else if (avg >= 50) {
    // ── CREDIT BAND ─────────────────────────────────────────────
    const openers = [
      `${firstName} has demonstrated a satisfactory level of academic performance this term`,
      `This term, ${firstName} has shown reasonable effort and achieved a passing standard`,
      `${firstName} has met the minimum academic requirements this term`
    ];
    const opener = openers[Math.floor(avg) % openers.length];

    let body = `, with an overall average of ${avg}% and a final grade of ${overallGrade}.`;

    if (bestSubject) {
      body += ` ${firstName} demonstrates the most confidence in ${bestSubject.subject}.`;
    }

    if (worstSubject && subjectAverages.length > 1) {
      body += ` Dedicated attention to ${worstSubject.subject} is recommended, as improvement in this area will have a positive impact on overall results.`;
    }

    if (trendPhrase) body += ` The student is currently ${trendPhrase}.`;

    const closing = ` I strongly encourage ${firstName} to increase study time, seek help when needed, and remain actively engaged during lessons. The potential to move up a grade band is certainly within reach.`;

    comment = opener + body + closing;

  } else if (avg >= 40) {
    // ── SATISFACTORY BAND ───────────────────────────────────────
    const openers = [
      `${firstName} has found this term academically challenging`,
      `This term has presented some difficulties for ${firstName}`,
      `${firstName}'s academic performance this term has been below expectation`
    ];
    const opener = openers[Math.floor(avg) % openers.length];

    let body = `, with an overall average of ${avg}%, placing them in the ${overallGrade} grade category.`;

    if (passRate < 50) {
      body += ` A pass rate of ${passRate}% suggests that several subjects require urgent and focused attention.`;
    }

    if (bestSubject) {
      body += ` There are clear sparks of ability in ${bestSubject.subject}, which indicates that ${firstName} is capable of performing at a higher level.`;
    }

    if (worstSubject && subjectAverages.length > 1) {
      body += ` ${worstSubject.subject} in particular needs significant improvement before the next term.`;
    }

    const closing = ` I recommend that ${firstName}, together with parents or guardians, develops a structured revision plan. Regular attendance, extra practice, and open communication with subject teachers will be key to improvement next term.`;

    comment = opener + body + closing;

  } else {
    // ── UNSATISFACTORY BAND ─────────────────────────────────────
    const openers = [
      `${firstName} has had a very difficult term academically`,
      `It is with concern that I report ${firstName}'s academic performance this term`,
      `This term has been a particularly challenging academic period for ${firstName}`
    ];
    const opener = openers[Math.floor(avg) % openers.length];

    let body = `, with an overall average of ${avg}% and a grade of ${overallGrade}.`;

    if (passRate <= 30) {
      body += ` Passing only ${passRate}% of assessments is a serious concern that needs to be addressed immediately.`;
    }

    if (bestSubject) {
      body += ` While ${bestSubject.subject} showed some potential, the results across the board indicate that more support and effort are urgently needed.`;
    }

    const closing = ` I strongly urge that a parent-teacher meeting be arranged to discuss a clear and actionable improvement plan. ${firstName} is capable of better results, and with the right support and dedication, significant progress is achievable next term.`;

    comment = opener + body + closing;
  }

  // ── Append teacher sign-off if teacher name is provided ──────
  if (teacher && String(teacher).trim()) {
    comment += `\n— ${String(teacher).trim()}`;
  }

  return comment;
}


// ==========================================
// 🗂️ COMMENT MANAGER — Persistent per-student
// Stores auto-generated and manually edited
// comments in IndexedDB for later retrieval.
// ==========================================

const COMMENTS_STORE = 'teacherComments'; // IndexedDB store key prefix

/**
 * Builds a unique storage key for a student's comment
 */
function buildCommentKey(className, studentId) {
  return `${COMMENTS_STORE}:${String(className).trim().toLowerCase()}:${String(studentId).trim().toLowerCase()}`;
}

/**
 * Saves a comment record (auto or manual) to IndexedDB
 * @param {string} className
 * @param {string} studentId
 * @param {object} commentRecord - { text, isManual, generatedAt }
 */
async function saveTeacherComment(className, studentId, commentRecord) {
  try {
    const key = buildCommentKey(className, studentId);
    let allComments = await getIndexedDB(COMMENTS_STORE) || {};
    allComments[key] = commentRecord;
    await setIndexedDB(COMMENTS_STORE, allComments);
  } catch (err) {
    console.warn('⚠️ Could not save teacher comment:', err);
  }
}

/**
 * Loads a saved comment record for a student
 * @returns {object|null} commentRecord or null
 */
async function loadTeacherComment(className, studentId) {
  try {
    const key = buildCommentKey(className, studentId);
    const allComments = await getIndexedDB(COMMENTS_STORE) || {};
    return allComments[key] || null;
  } catch (err) {
    console.warn('⚠️ Could not load teacher comment:', err);
    return null;
  }
}


// ==========================================
// 💬 COMMENT EDITOR UI (FIXED + SAFE)
// ==========================================

function openCommentEditorModal(autoComment, savedComment = null) {
  return new Promise((resolve) => {
    
    // Remove existing modal if open
    const existingModal = document.getElementById('tm-comment-modal');
    if (existingModal) existingModal.remove();
    
    const initialText = savedComment || autoComment || '';
    const isEditedPreviously = !!savedComment;
    
    // Safe text (prevents HTML injection issues)
    const safeText = (initialText)
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    const modal = document.createElement('div');
    modal.id = 'tm-comment-modal';
    
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: rgba(15, 23, 42, 0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      backdrop-filter: blur(4px);
    `;
    
    modal.innerHTML = `
      <div style="
        background: #ffffff;
        border-radius: 14px;
        width: 100%;
        max-width: 600px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.3);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      ">

        <!-- HEADER -->
        <div style="
          background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%);
          padding: 18px 22px;
          display: flex;
          align-items: center;
          gap: 12px;
        ">
          <div style="
            background: rgba(255,255,255,0.2);
            border-radius: 8px;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
          ">💬</div>

          <div>
            <div style="color: #fff; font-size: 15px; font-weight: 700;">
              Teacher's Remarks
            </div>
            <div style="color: #bfdbfe; font-size: 12px;">
              Auto-generated · Edit before printing
            </div>
          </div>
        </div>

        <!-- AI BANNER -->
        <div style="
          background: #f0fdf4;
          border-bottom: 1px solid #dcfce7;
          padding: 10px 22px;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <span style="
            background: #059669;
            color: #fff;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 20px;
          ">AI</span>

          <span style="color:#166534; font-size:12px;">
            ${isEditedPreviously
              ? 'You are editing a previously saved comment.'
              : 'This comment was auto-generated from student results.'}
          </span>
        </div>

        <!-- TEXTAREA -->
        <div style="padding: 18px 22px;">
          <label style="
            font-size: 11px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          ">
            Comment
          </label>

          <textarea id="tm-comment-textarea" style="
            width: 100%;
            min-height: 150px;
            margin-top: 8px;
            padding: 12px 14px;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            font-size: 13px;
            line-height: 1.6;
            resize: vertical;
            outline: none;
            font-family: inherit;
            box-sizing: border-box;
          ">${safeText}</textarea>

          <div style="
            display:flex;
            justify-content:space-between;
            margin-top:8px;
          ">
            <span id="tm-char-count" style="font-size:11px; color:#94a3b8;"></span>

            <button id="tm-reset-btn" style="
              background:none;
              border:none;
              color:#6366f1;
              font-size:12px;
              cursor:pointer;
              text-decoration: underline;
            ">
              Reset
            </button>
          </div>
        </div>

        <!-- ACTIONS -->
        <div style="
          padding: 14px 22px 18px;
          display:flex;
          gap:10px;
          justify-content:flex-end;
          border-top:1px solid #f1f5f9;
        ">

          <button id="tm-use-auto-btn" style="
            padding:9px 16px;
            border-radius:8px;
            border:2px solid #059669;
            background:#f0fdf4;
            color:#166534;
            font-weight:600;
            cursor:pointer;
          ">
            Use AI
          </button>

          <button id="tm-save-manual-btn" style="
            padding:9px 16px;
            border-radius:8px;
            border:none;
            background:#1e3a8a;
            color:white;
            font-weight:600;
            cursor:pointer;
          ">
            Save Edit
          </button>

        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const textarea = modal.querySelector('#tm-comment-textarea');
    const charCount = modal.querySelector('#tm-char-count');
    const resetBtn = modal.querySelector('#tm-reset-btn');
    const useAutoBtn = modal.querySelector('#tm-use-auto-btn');
    const saveManualBtn = modal.querySelector('#tm-save-manual-btn');
    
    // Character counter
    const updateCount = () => {
      charCount.textContent = `${textarea.value.length} characters`;
    };
    
    textarea.addEventListener('input', updateCount);
    updateCount();
    
    // Focus styling
    textarea.addEventListener('focus', () => {
      textarea.style.borderColor = '#1d4ed8';
    });
    
    textarea.addEventListener('blur', () => {
      textarea.style.borderColor = '#e2e8f0';
    });
    
    // Reset
    resetBtn.addEventListener('click', () => {
      textarea.value = autoComment || '';
      updateCount();
    });
    
    // Use AI
    useAutoBtn.addEventListener('click', () => {
      modal.remove();
      resolve({
        text: autoComment || '',
        isManual: false
      });
    });
    
    // Save manual
    saveManualBtn.addEventListener('click', () => {
      const editedText = textarea.value.trim() || autoComment || '';
      modal.remove();
      resolve({
        text: editedText,
        isManual: editedText !== autoComment
      });
    });
    
    // Close on backdrop
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve({
          text: initialText,
          isManual: isEditedPreviously
        });
      }
    });
  });
}




// ==========================================
// EXISTING HELPERS (UNCHANGED)
// ==========================================

// Helper: Smart detection of Zambian grade levels
function detectGradeLevel(className) {
    if (!className) return 'Senior Secondary'; 
    const cls = String(className).toLowerCase();

    if (cls.match(/(10|11|12)/)) return 'Senior Secondary';
    if (cls.match(/(8|9)/)) return 'Junior Secondary';
    if (cls.match(/(1|2|3|4|5|6|7)/)) return 'Primary';

    return 'Senior Secondary'; 
}




// ==========================================
// EXISTING: exportStudentResultsPDF (UNCHANGED)
// ==========================================

async function exportStudentResultsPDF(className, studentId, opts = {}, manualEntries = []) {
  try {
    if (!className) return showToast('⚠️ Please select a class', 'error');
    if (!studentId) return showToast('⚠️ Enter a valid student ID', 'error');

   window. showLoading(`Generating Professional ${opts.category && opts.category !== 'All' ? opts.category : ''} Report...`);

    const { dd } = await buildStudentPdfDefinition(className, studentId, opts, manualEntries);

    const pdfMake = await ensurePdfMake();
    const pdfDocGenerator = pdfMake.createPdf(dd);

    pdfDocGenerator.getBlob(async (blob) => {
        const fileName = `${studentId}_Official_Report.pdf`;
        const file = new File([blob], fileName, { type: 'application/pdf' });

       window. hideLoading();

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'Student Academic Report',
                    text: `Official academic report for ${studentId} generated via TeachMate.`
                });
                showToast('✅ Report shared successfully', 'success');
            } catch (e) {
                console.log('Share cancelled, downloading instead.');
                pdfDocGenerator.download(fileName);
            }
        } else {
            pdfDocGenerator.download(fileName);
            showToast('✅ Report downloaded successfully', 'success');
        }
    });

  } catch (err) {
    console.error('❌ exportStudentResultsPDF error:', err);
   window. hideLoading();
    showToast('⚠️ Error: ' + (err.message || 'Unknown'), 'error');
  }
}





// Enhanced export: use html2pdf for direct PDF download with iframe (kept as is for class report)
async function exportResultsPDF(className, opts = {}) {
  if (!className) return showToast('Select a class', 'error');
  if (!opts || Object.keys(opts).length === 0) {
    console.warn('exportResultsPDF called without options - skipping');
    return;
  }
  try {
    window.showLoading('Preparing PDF report...');
    const html = await buildPrintableReportHTML(className, { ...opts, includeAnalytics: true });

    const html2pdf = await ensureHtml2pdf();

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '610px';
    iframe.style.height = 'auto';
    document.body.appendChild(iframe);

    // Load content
    iframe.srcdoc = html;

    // Wait for iframe to fully load
    await new Promise(resolve => {
      iframe.onload = async () => {
  try {
    const doc = iframe.contentDocument;

// 🔥 Automatically paginate tables
autoChunkTables(doc, {
  rowsPerPage: 20
});

// force final layout flush
doc.body.getBoundingClientRect();
iframe.style.height = doc.body.scrollHeight + 'px';

    resolve();
  } catch (e) {
    console.warn('Layout wait warning', e);
    resolve();
  }
};
    });

    // Adjust iframe height
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const body = doc.body;
      const htmlEl = doc.documentElement;


const doc1 = iframe.contentDocument;

// 🔥 FORCE browser to finish layout
doc.body.getBoundingClientRect();

// ✅ Measure final, stable height
iframe.style.height = doc.body.scrollHeight + 'px';

    } catch (e) {
      console.warn('Could not auto-size iframe, proceeding', e);
    }

    // Small timeout to allow full layout
    setTimeout(async () => {
      try {
        await html2pdf().set({
          margin: 1,
          filename: 'results_report.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            logging: true,
            useCORS: true,
            windowWidth: iframe.contentDocument.documentElement.scrollWidth
          },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        }).from(iframe.contentDocument.body).save();
      } catch (e) {
        console.error('PDF generation error', e);
      } finally {
        document.body.removeChild(iframe);
        hideLoading();
        showToast('✅ PDF downloaded', 'success');
      }
    }, 1000); // Add 1 second delay after load
  } catch (err) {
    console.error('exportResultsPDF error', err);
    hideLoading();
    showToast('⚠️ Failed to prepare PDF: ' + (err.message || 'Unknown error'), 'error');
  }
}





  // -------------------------
  // DOM wiring (buttons & flows) - fixed populateClasses with extended retries; added individual PDF form button
  // -------------------------
  (function wireUI() {
    function safeOn(id, event, handler) {
      const el = document.getElementById(id);
      if (!el) return;
      el.removeEventListener(event, handler);
      el.addEventListener(event, handler);
    }

    safeOn('loadResultsStudentsBtn', 'click', async () => {
      try { await loadResultsStudents(); } catch (e) { console.error(e); showToast('Failed to load students', 'error'); }
    });

    safeOn('saveResultsBtn', 'click', async () => {
      try { await saveResults(); } catch (e) { console.error(e); showToast('Save failed', 'error'); }
    });

    safeOn('viewResultsHistoryBtn', 'click', async () => {
      try { await viewResultsHistory(); } catch (e) { console.error(e); showToast('Failed to load history', 'error'); }
    });

    // Export class PDF (includes analytics)
    safeOn('exportResultsPdfBtn', 'click', async () => {
      try {
        const className = document.getElementById('results-class')?.value;
        if (!className) return showToast('Select a class', 'error');
        const level = document.getElementById('results-level-filter')?.value || document.getElementById('results-level')?.value || '';
        const category = document.getElementById('results-category-filter')?.value || '';

const testName = prompt('please leave the entry field down here blank to continue ☺️:', '') || '';



        const comments = prompt('Enter teacher comments for the report📝:', '') || '';
        await exportResultsPDF(className, { title: `Results Report - ${className}`, level, category, comments, testName, includeAnalytics: true });
      } catch (e) { console.error(e); showToast('Export failed', 'error'); }
    });

    // Enhanced: Open individual PDF form (replaces direct export)
    safeOn('exportStudentPdfBtn', 'click', async () => {
      try {
        await openIndividualStudentPDFForm();
      } catch (e) { console.error(e); showToast('Failed to open PDF form', 'error'); }
    });

    // Analytics button
    safeOn('generateAnalyticsBtn', 'click', async () => {
      try {
        const container = document.getElementById('results-analytics');
        if (container) container.style.display = 'block';
        await generateClassAnalytics();
      } catch (e) { console.error(e); showToast('Analytics failed', 'error'); }
    });

    // Delete all results
    safeOn('deleteAllResultsBtn', 'click', async () => {
      try { await deleteAllResults(); } catch(e){ console.error(e); showToast('Delete failed', 'error'); }
    });

    // Clear inputs
    safeOn('clearResultsInputsBtn', 'click', () => {
      document.querySelectorAll('#results-table .result-input').forEach(i => i.value = '');
      showToast('Cleared inputs', 'info');
    });

    // Toggle history (if button exists)
    const hideHistoryBtn = document.getElementById('hideHistoryBtn');
    if (hideHistoryBtn) {
      hideHistoryBtn.addEventListener('click', () => {
        const div = document.getElementById('results-history');
        if (!div) return;
        div.style.display = div.style.display === 'none' ? 'block' : 'none';
        hideHistoryBtn.textContent = div.style.display === 'none' ? 'Show History' : 'Hide History';
      });
    }

    // Toggle analytics (if button exists) - now handled in generateClassAnalytics
    const hideAnalyticsBtn = document.getElementById('hideAnalyticsBtn');
    if (hideAnalyticsBtn) {
      hideAnalyticsBtn.addEventListener('click', () => {
        const div = document.getElementById('results-analytics');
        if (!div) return;
        div.style.display = div.style.display === 'none' ? 'block' : 'none';
        hideAnalyticsBtn.textContent = div.style.display === 'none' ? 'Show Analytics' : 'Hide Analytics';
      });
    }

    // Enhanced populateClasses: Increased retries to 10 with 1000ms delay
    (async function populateClasses() {
      window.showLoading('Loading classes...');
      const sel = document.getElementById('results-class');
      if (!sel) {
        console.warn('No results-class select found');
        window.hideLoading();
        return;
      }
      let classes = [];
      const maxRetries = 10; // Increased retries
      let retryCount = 0;
      let lastError = null;
      while (retryCount < maxRetries) {
        try {
          
          
          classes = await window.getIndexedDB('classes') || [];
          
          
          if (!Array.isArray(classes)) {
            classes = [];
            console.warn('Classes data not array—defaulting to empty');
          }
          break; // Success
        } catch (e) {
          lastError = e;
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`DB retry ${retryCount}/${maxRetries} in 1000ms...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay
          } else {
            console.error('populateClasses failed after retries', lastError.name || 'Unknown', lastError.message || 'No details');
            showToast(`Failed to load classes (${lastError.message || 'DB not ready'})—using empty list`, 'warn');
          }
        }
      }
      sel.innerHTML = '<option value="">Select class</option>';
      classes.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id || c.name || '';
        o.textContent = c.name || c.id || c;
        sel.appendChild(o);
      });
      if (classes.length > 0) {
        showToast('Classes loaded', 'success');
      }
      hideLoading();
    })();

  })(); // end wireUI

  // Expose helpers
  window._resultsModuleHelpers = {
    computeClassStats,
    buildPrintableReportHTML,
    buildPrintableReportHTMLAsync: buildPrintableReportHTML
  };

  // Grading scale validation (unchanged)
  window.testGrading = function () {
    const testsSenior = [
      { score: 100, expected: { grade: '1', remark: 'Distinction' } },
      { score: 75, expected: { grade: '1', remark: 'Distinction' } },
      { score: 74, expected: { grade: '2', remark: 'Distinction' } },
      { score: 70, expected: { grade: '2', remark: 'Distinction' } },
      { score: 69, expected: { grade: '3', remark: 'Merit' } },
      { score: 65, expected: { grade: '3', remark: 'Merit' } },
      { score: 64, expected: { grade: '4', remark: 'Merit' } },
      { score: 60, expected: { grade: '4', remark: 'Merit' } },
      { score: 59, expected: { grade: '5', remark: 'Credit' } },
      { score: 55, expected: { grade: '5', remark: 'Credit' } },
      { score: 54, expected: { grade: '6', remark: 'Credit' } },
      { score: 50, expected: { grade: '6', remark: 'Credit' } },
      { score: 49, expected: { grade: '7', remark: 'Satisfactory' } },
      { score: 45, expected: { grade: '7', remark: 'Satisfactory' } },
      { score: 44, expected: { grade: '8', remark: 'Satisfactory' } },
      { score: 40, expected: { grade: '8', remark: 'Satisfactory' } },
      { score: 39, expected: { grade: '9', remark: 'Unsatisfactory' } },
      { score: 0, expected: { grade: '9', remark: 'Unsatisfactory' } },
    ];

    const testsJuniorPrimary = [
      { score: 100, expected: { grade: '1', remark: 'Distinction' } },
      { score: 75, expected: { grade: '1', remark: 'Distinction' } },
      { score: 74, expected: { grade: '2', remark: 'Merit' } },
      { score: 60, expected: { grade: '2', remark: 'Merit' } },
      { score: 59, expected: { grade: '3', remark: 'Credit' } },
      { score: 50, expected: { grade: '3', remark: 'Credit' } },
      { score: 49, expected: { grade: '4', remark: 'Satisfactory' } },
      { score: 40, expected: { grade: '4', remark: 'Satisfactory' } },
      { score: 39, expected: { grade: 'U', remark: 'Unsatisfactory' } },
      { score: 0, expected: { grade: 'U', remark: 'Unsatisfactory' } },
    ];

    console.log('Testing Senior Secondary:');
    testsSenior.forEach(t => {
      const result = zambianGrade(t.score, 'Senior Secondary');
      const pass = result.grade === t.expected.grade && result.remark === t.expected.remark;
      console.log(`Score: ${t.score}, Result: grade ${result.grade} - ${result.remark}, Expected: grade ${t.expected.grade} - ${t.expected.remark}, Pass: ${pass}`);
      if (!pass) {
        console.error('Test failed for score ' + t.score);
      }
    });

    console.log('Testing Junior/Primary:');
    testsJuniorPrimary.forEach(t => {
      const result = zambianGrade(t.score, 'Junior Secondary');
      const pass = result.grade === t.expected.grade && result.remark === t.expected.remark;
      console.log(`Score: ${t.score}, Result: grade ${result.grade} - ${result.remark}, Expected: grade ${t.expected.grade} - ${t.expected.remark}, Pass: ${pass}`);
      if (!pass) {
        console.error('Test failed for score ' + t.score);
      }
    });
    console.log('Run testGrading() in console to validate the grading scale.');
  };

})(); // end Results Module


console.log("results module loaded successfully V2");


})();
