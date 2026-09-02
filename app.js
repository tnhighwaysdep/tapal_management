// TAPAL CHASE Application Logic

function cleanCurrNo(val) {
  if (val === null || val === undefined || val === '') return '';
  let str = String(val).replace(/\.0+$/, '').replace(/\..*$/, '').replace(/[^0-9]/g, '').trim();
  if (!str) return '';
  // Max 5 digits allowed
  if (str.length > 5) {
    str = str.substring(0, 5);
  }
  // If 1, 2, or 3 digits (less than 4 digits), pad with leading zeros to 4 digits
  if (str.length < 4) {
    str = str.padStart(4, '0');
  }
  return str;
}

function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNextCurrNo() {
  if (!tapalState || tapalState.length === 0) return '0001';

  // Gather all existing numeric inward numbers into a Set
  const existingSet = new Set();
  tapalState.forEach(r => {
    if (r.currNo) {
      const num = parseInt(String(r.currNo).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num) && num > 0) {
        existingSet.add(num);
      }
    }
  });

  // Find the first missing gap number starting from 1, skipping all already entered numbers
  let candidate = 1;
  while (existingSet.has(candidate)) {
    candidate++;
  }

  return cleanCurrNo(candidate);
}

function saveTapalStateToLocalStorage() {
  try {
    localStorage.setItem('tapal_register_records_v3', JSON.stringify(tapalState));
  } catch (e) {
    console.error('Error saving tapalState to localStorage:', e);
  }
}
window.saveTapalStateToLocalStorage = saveTapalStateToLocalStorage;

function saveComplaintsStateToLocalStorage() {
  try {
    localStorage.setItem('tapal_complaints_v2', JSON.stringify(complaintsState));
  } catch (e) {
    console.error('Error saving complaintsState to localStorage:', e);
  }
}
window.saveComplaintsStateToLocalStorage = saveComplaintsStateToLocalStorage;

function saveRemindersStateToLocalStorage() {
  try {
    localStorage.setItem('tapal_reminders_v1', JSON.stringify(remindersState));
  } catch (e) {
    console.error('Error saving remindersState to localStorage:', e);
  }
}
window.saveRemindersStateToLocalStorage = saveRemindersStateToLocalStorage;

function clearAllData() {
  tapalState = [];
  complaintsState = [];
  remindersState = [];
  try {
    localStorage.removeItem('tapal_register_records_v1');
    localStorage.removeItem('tapal_register_records_v2');
    localStorage.removeItem('tapal_register_records_v3');
    localStorage.removeItem('tapal_complaints_v1');
    localStorage.removeItem('tapal_complaints_v2');
    localStorage.removeItem('tapal_reminders_v1');
    localStorage.setItem('tapal_register_records_v3', JSON.stringify([]));
    localStorage.setItem('tapal_complaints_v2', JSON.stringify([]));
    localStorage.setItem('tapal_reminders_v1', JSON.stringify([]));
  } catch (e) {}
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderRegisterTable === 'function') renderRegisterTable();
  if (typeof renderFollowUpModule === 'function') renderFollowUpModule();
  if (typeof renderAdminInbox === 'function') renderAdminInbox();
  if (typeof updateInboxBadgeCount === 'function') updateInboxBadgeCount();
  if (typeof updateFollowUpBadgeCount === 'function') updateFollowUpBadgeCount();
}
window.clearAllData = clearAllData;

function loadComplaintsStateFromLocalStorage() {
  try {
    const saved = localStorage.getItem('tapal_complaints_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error loading complaintsState from localStorage:', e);
  }
  return [];
}

let complaintsState = loadComplaintsStateFromLocalStorage();

function loadRemindersStateFromLocalStorage() {
  try {
    const saved = localStorage.getItem('tapal_reminders_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error loading remindersState from localStorage:', e);
  }
  return [];
}

let remindersState = loadRemindersStateFromLocalStorage();

function loadTapalStateFromLocalStorage() {
  let records = [];
  try {
    const saved = localStorage.getItem('tapal_register_records_v3');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map(r => ({
          ...r,
          currNo: cleanCurrNo(r.currNo)
        }));
      }
    }
  } catch (e) {
    console.error('Error loading tapalState from localStorage:', e);
  }

  if (typeof INITIAL_TAPAL_DATA !== 'undefined' && Array.isArray(INITIAL_TAPAL_DATA) && INITIAL_TAPAL_DATA.length > 0) {
    records = INITIAL_TAPAL_DATA.map(r => ({
      ...r,
      currNo: cleanCurrNo(r.currNo)
    }));
  }

  try {
    localStorage.setItem('tapal_register_records_v3', JSON.stringify(records));
  } catch (e) {}
  return records;
}

let tapalState = loadTapalStateFromLocalStorage();
let currentPage = 1;
let itemsPerPage = 12;

// Chart instances
let monthlyChartInst = null;
let statusChartInst = null;
let officerChartInst = null;
let officeChartInst = null;
let turnaroundChartInst = null;

// -------------------------------------------------------------
// OFFICIAL USER CREDENTIALS & AUTHENTICATION STATE
// -------------------------------------------------------------
let officialUsersState = [
  { id: 1, name: 'Executive Chief Engineer', username: 'admin', password: 'admin123', designation: 'Chief Engineer', role: 'Super Admin', wing: 'EXECUTIVE', status: 'Active' },
  { id: 2, name: 'Superintending Engineer', username: 'se_slm', password: 'se123', designation: 'SE Salem', role: 'SE Officer', wing: 'PLANNING / BUDGET', status: 'Active' },
  { id: 3, name: 'Divisional Engineer', username: 'de_cbe', password: 'de123', designation: 'DE Coimbatore', role: 'DE Officer', wing: 'ROADS', status: 'Active' },
  { id: 4, name: 'Planning Officer', username: 'planning', password: 'plan123', designation: 'Assistant Engineer', role: 'Section Officer', wing: 'PLANNING / BUDGET', status: 'Active' }
];

let activeUserSession = null;

function checkAuthSession() {
  let sessionData = sessionStorage.getItem('tapal_logged_user');
  if (!sessionData) {
    sessionData = localStorage.getItem('tapal_logged_user_backup');
  }

  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.querySelector('.app-container');

  if (sessionData) {
    try {
      activeUserSession = JSON.parse(sessionData);
    } catch (e) {
      activeUserSession = null;
    }
  }

  if (activeUserSession) {
    if (loginScreen) {
      loginScreen.style.display = 'none';
      loginScreen.style.visibility = 'hidden';
      loginScreen.style.opacity = '0';
      loginScreen.style.pointerEvents = 'none';
    }
    if (appContainer) {
      appContainer.style.display = 'flex';
      appContainer.style.visibility = 'visible';
      appContainer.style.opacity = '1';
    }
    updateLoggedInUI();
  } else {
    activeUserSession = null;
    if (loginScreen) {
      loginScreen.style.display = 'flex';
      loginScreen.style.visibility = 'visible';
      loginScreen.style.opacity = '1';
      loginScreen.style.pointerEvents = 'auto';
    }
    if (appContainer) {
      appContainer.style.display = 'none';
    }
  }
}
window.checkAuthSession = checkAuthSession;

function updateLoggedInUI() {
  if (!activeUserSession) return;
  const userDisplay = document.getElementById('logged-user-display');
  const wingDisplay = document.getElementById('sidebar-wing-title');
  if (userDisplay) userDisplay.innerText = `${activeUserSession.name} (${activeUserSession.designation})`;
  if (wingDisplay) wingDisplay.innerText = activeUserSession.wing || 'PLANNING / BUDGET';

  const isAdmin = ['super admin', 'admin', 'super_admin', 'chief engineer'].includes((activeUserSession.role || activeUserSession.designation || '').toLowerCase());
  const adminDateLockCont = document.getElementById('admin-date-lock-container');
  if (adminDateLockCont) {
    adminDateLockCont.style.display = isAdmin ? 'flex' : 'none';
  }
  fetchDateLockSetting();
}

// =============================================================
// GLOBAL TOAST NOTIFICATION ENGINE
// =============================================================
function showToast(message, type = 'success') {
  try {
    if (type === 'error' && typeof message === 'string' && message.toLowerCase().includes('getcontext')) {
      console.warn('Suppressed getContext error toast:', message);
      return;
    }
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      if (document.body) document.body.appendChild(container);
      else if (document.documentElement) document.documentElement.appendChild(container);
    }
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    const icon = type === 'success' ? 'ri-checkbox-circle-fill' : (type === 'error' ? 'ri-error-warning-fill' : 'ri-information-fill');
    toast.innerHTML = `<i class="${icon}" style="font-size: 18px;"></i> <span>${message || ''}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      try {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px) scale(0.95)';
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
      } catch (e) {}
    }, 3500);
  } catch (err) {
    console.warn('showToast error:', err);
  }
}
window.showToast = showToast;

// =============================================================
// ADMIN DATE LOCK & RELEASE SYSTEM STATE
// =============================================================
let globalDateLockState = true;

async function fetchDateLockSetting() {
  try {
    const res = await fetch('/api/settings/date-lock');
    if (res.ok) {
      const data = await res.json();
      globalDateLockState = data.date_lock_enabled !== false;
    } else {
      globalDateLockState = localStorage.getItem('system_date_lock_enabled') !== 'false';
    }
  } catch (e) {
    globalDateLockState = localStorage.getItem('system_date_lock_enabled') !== 'false';
  }
  updateDateLockUI();
}
window.fetchDateLockSetting = fetchDateLockSetting;

async function toggleAdminDateLock() {
  const sessionData = sessionStorage.getItem('tapal_logged_user');
  const user = sessionData ? JSON.parse(sessionData) : { role: 'User', id: 1 };

  const newState = !globalDateLockState;
  try {
    const res = await fetch('/api/settings/date-lock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': user.role || 'Admin'
      },
      body: JSON.stringify({ enabled: newState, userId: user.id, role: user.role })
    });
    if (res.ok) {
      const data = await res.json();
      globalDateLockState = data.date_lock_enabled;
    } else {
      globalDateLockState = newState;
    }
  } catch (e) {
    globalDateLockState = newState;
  }

  localStorage.setItem('system_date_lock_enabled', globalDateLockState ? 'true' : 'false');
  updateDateLockUI();
  showToast(
    globalDateLockState ? '🔒 System Date Lock enabled: Restricted to today & past dates.' : '🔓 System Date Lock released: All dates are now permitted.',
    globalDateLockState ? 'info' : 'success'
  );
}
window.toggleAdminDateLock = toggleAdminDateLock;

function updateDateLockUI() {
  const badge = document.getElementById('date-lock-status-badge');
  const text = document.getElementById('text-date-lock');
  const icon = document.getElementById('icon-date-lock');
  const btn = document.getElementById('btn-toggle-date-lock');

  if (badge && text && icon) {
    if (globalDateLockState) {
      badge.className = 'date-lock-locked';
      badge.style.color = '#f87171';
      text.innerText = 'Date Locked';
      icon.className = 'ri-lock-2-line';
      if (btn) btn.innerText = 'Release Dates';
    } else {
      badge.className = 'date-lock-unlocked';
      badge.style.color = '#34d399';
      text.innerText = 'Dates Unlocked';
      icon.className = 'ri-lock-unlock-line';
      if (btn) btn.innerText = 'Lock Dates';
    }
  }

  // Update date picker max limits across all modals & filters
  document.querySelectorAll('.custom-native-date-picker').forEach(dp => {
    if (globalDateLockState) {
      dp.max = getTodayISO();
    } else {
      dp.removeAttribute('max');
      dp.removeAttribute('min');
    }
  });
}
window.updateDateLockUI = updateDateLockUI;

// =============================================================
// MASTER CASCADING DROPDOWNS & DYNAMIC EVENT LOGIC
// =============================================================

function updateOfficerModalDropdown(mode, preselectOfficer = null) {
  const isEdit = mode === 'edit';
  const officeEl = document.getElementById(isEdit ? 'edit-main-office' : 'form-main-office');
  const officerEl = document.getElementById(isEdit ? 'edit-officer' : 'form-officer');

  if (!officeEl || !officerEl) return;

  const selectedOffice = officeEl.value || 'SE';
  const officerList = typeof getOfficerDesignations === 'function' 
    ? getOfficerDesignations(selectedOffice) 
    : ['AG', 'IR', 'PS', 'DP', 'Others'];

  if (preselectOfficer && !officerList.includes(preselectOfficer)) {
    officerList.unshift(preselectOfficer);
  }

  let officerHtml = '<option value="">-- Select Officer Designation --</option>';
  officerList.forEach(off => {
    officerHtml += `<option value="${off}">${off}</option>`;
  });
  officerHtml += `<option value="__ADD_NEW__" style="color: #38bdf8; font-weight: bold;">➕ Add Custom Option...</option>`;
  officerHtml += `<option value="__MANAGE_OPTIONS__" style="color: #f87171; font-weight: bold;">🗑️ Manage / Delete Options...</option>`;
  officerEl.innerHTML = officerHtml;

  if (preselectOfficer && officerList.includes(preselectOfficer)) {
    officerEl.value = preselectOfficer;
  } else if (officerList.length > 0) {
    officerEl.value = officerList[0];
  }

  if (typeof window.refreshSearchableSelect === 'function') {
    window.refreshSearchableSelect(officerEl);
  }
}
window.updateOfficerModalDropdown = updateOfficerModalDropdown;

function updateShortSubModalDropdown(mode, preselectShortSub = null) {
  const isEdit = mode === 'edit';
  const secEl = document.getElementById(isEdit ? 'edit-tech-sec-ref' : 'form-tech-sec-ref');
  const shortSubEl = document.getElementById(isEdit ? 'edit-short-sub' : 'form-short-sub');

  if (!secEl || !shortSubEl) return;

  const selectedSec = secEl.value || 'ACCT';
  const subList = typeof getSubjectInBrief === 'function'
    ? getSubjectInBrief(selectedSec)
    : ['Leave Application', 'Audit Para', 'Others'];

  if (preselectShortSub && !subList.includes(preselectShortSub)) {
    subList.unshift(preselectShortSub);
  }

  let subHtml = '<option value="">-- Select Subject in Brief --</option>';
  subList.forEach(sub => {
    subHtml += `<option value="${sub}">${sub}</option>`;
  });
  subHtml += `<option value="__ADD_NEW__" style="color: #38bdf8; font-weight: bold;">➕ Add Custom Option...</option>`;
  subHtml += `<option value="__MANAGE_OPTIONS__" style="color: #f87171; font-weight: bold;">🗑️ Manage / Delete Options...</option>`;
  shortSubEl.innerHTML = subHtml;

  if (preselectShortSub && subList.includes(preselectShortSub)) {
    shortSubEl.value = preselectShortSub;
  } else if (subList.length > 0) {
    shortSubEl.value = subList[0];
  }

  if (typeof window.refreshSearchableSelect === 'function') {
    window.refreshSearchableSelect(shortSubEl);
  }
}
window.updateShortSubModalDropdown = updateShortSubModalDropdown;

function updateShortSubDropdowns() {
  if (typeof updateShortSubModalDropdown === 'function') {
    updateShortSubModalDropdown('register');
    updateShortSubModalDropdown('edit');
  }
  if (typeof updateShortSubFilterDropdown === 'function') {
    updateShortSubFilterDropdown();
  }
}
window.updateShortSubDropdowns = updateShortSubDropdowns;

function updateOfficerAndShortSubDropdowns(mode, preselectOfficer = null, preselectShortSub = null) {
  updateOfficerModalDropdown(mode, preselectOfficer);
  updateShortSubModalDropdown(mode, preselectShortSub);
}
window.updateOfficerAndShortSubDropdowns = updateOfficerAndShortSubDropdowns;
window.updateOfficerAndShortSubDropdowns = updateOfficerAndShortSubDropdowns;

// =============================================================
// FIELD VISIBILITY PRIORITY & FORM EVENT HANDLING
// =============================================================
function handleFormStatusAndSectionVisibility(mode) {
  const isEdit = mode === 'edit';
  const prefix = isEdit ? 'edit-' : 'form-';
  const statusEl = document.getElementById(`${prefix}status`);
  const secEl = document.getElementById(`${prefix}tech-sec-ref`);
  const actInitEl = document.getElementById(`${prefix}action-initiated`);
  const actInitDateEl = document.getElementById(`${prefix}action-init-date`);
  const actInitDateTextEl = document.getElementById(`${prefix}action-init-date-text`);
  const actInitStar = document.getElementById(`${prefix}action-init-star`);
  const apprStar = document.getElementById(`${prefix}appr-fc-star`);
  const apprInput = document.getElementById(`${prefix}appr-fc-date-text`);
  const step3Tab = document.getElementById(isEdit ? 'edit-step-tab-3' : 'reg-step-tab-3');
  const step2NextBtn = document.getElementById(isEdit ? 'btn-edit-step2-next' : 'btn-reg-step2-next');
  const accountsGroup = document.getElementById(`${prefix}accounts-ref-group`);

  const status = statusEl ? statusEl.value : 'Pending';
  const rawSection = secEl ? secEl.value : '';
  const canonicalSec = (typeof getCanonicalSectionCode === 'function') ? getCanonicalSectionCode(rawSection) : rawSection;
  const isFiled = status === 'Filed';

  if (isFiled) {
    // Auto-populate Action Initiated / Action Taken and Action Date with current date
    if (actInitEl && (!actInitEl.value || actInitEl.value.trim() === '')) {
      actInitEl.value = 'Filed';
    }
    if (actInitDateEl && (!actInitDateEl.value || actInitDateEl.value.trim() === '')) {
      const todayISO = getTodayISO();
      actInitDateEl.value = todayISO;
      if (actInitDateTextEl) actInitDateTextEl.value = formatISOToDDMMYYYY(todayISO);
    }

    // 1. Status === 'Filed': Hide Dispatch Step 3, Exclude Approval Date requirement
    if (apprStar) apprStar.style.display = 'none';
    if (apprInput) apprInput.removeAttribute('required');
    if (step3Tab) step3Tab.style.display = 'none';
    if (accountsGroup) accountsGroup.style.display = 'none';

    // Clear dispatch form fields
    const sentLetterEl = document.getElementById(`${prefix}sent-letter-no`);
    const dispDateEl = document.getElementById(`${prefix}dispatch-date`);
    const dispDateTextEl = document.getElementById(`${prefix}dispatch-date-text`);
    const sentToEl = document.getElementById(`${prefix}sent-to`);
    const accRefEl = document.getElementById(`${prefix}accounts-ref-no`);
    if (sentLetterEl) sentLetterEl.value = '';
    if (dispDateEl) dispDateEl.value = '';
    if (dispDateTextEl) dispDateTextEl.value = '';
    if (sentToEl) sentToEl.value = '';
    if (accRefEl) accRefEl.value = '';

    if (step2NextBtn) {
      step2NextBtn.className = 'btn btn-footer-save';
      step2NextBtn.innerHTML = '<i class="ri-checkbox-circle-fill"></i> Save & Close (Filed Tapal)';
      step2NextBtn.onclick = (e) => {
        e.preventDefault();
        saveTapalEntryRecord(mode);
      };
    }
  } else {
    // 2. Status !== 'Filed': Show Dispatch Step 3, Mandate Approval Date for letter/memo/proceeding/order
    const isApprovalRequired = ['Letter', 'Memo', 'Proceedings', 'Proceeding', 'DO Letter', 'Office Order'].includes(status);
    if (apprStar) apprStar.style.display = isApprovalRequired ? 'inline' : 'none';
    if (step3Tab) step3Tab.style.display = 'flex';

    // Mandate Action Initiated Date on any changes or non-Pending status
    const isActionMandatory = isEdit || (status !== 'Pending') || (actInitEl && actInitEl.value.trim() !== '');
    if (actInitStar) actInitStar.style.display = isActionMandatory ? 'inline' : 'none';

    // Auto-default Action Date if status changed from Pending or when updating
    if (status !== 'Pending' && actInitDateEl && (!actInitDateEl.value || actInitDateEl.value.trim() === '')) {
      const todayISO = getTodayISO();
      actInitDateEl.value = todayISO;
      if (actInitDateTextEl) actInitDateTextEl.value = formatISOToDDMMYYYY(todayISO);
    }
    if (step2NextBtn) {
      step2NextBtn.className = 'btn btn-step-next';
      step2NextBtn.innerHTML = 'Next: Dispatch Details <i class="ri-arrow-right-line"></i>';
      step2NextBtn.onclick = () => isEdit ? proceedEditStep(2, 3) : proceedRegisterStep(2, 3);
    }

    // 3. Accounts Section check (ACCT or Accounts)
    if (canonicalSec === 'ACCT') {
      if (accountsGroup) accountsGroup.style.display = 'block';
    } else {
      if (accountsGroup) accountsGroup.style.display = 'none';
    }
  }

  syncDispatchBadgeSummary(mode);
}
window.handleFormStatusAndSectionVisibility = handleFormStatusAndSectionVisibility;

function syncDispatchBadgeSummary(mode) {
  const isEdit = mode === 'edit';
  const currNoEl = document.getElementById(isEdit ? 'edit-curr-no' : 'form-curr-no');
  const fileNoEl = document.getElementById(isEdit ? 'edit-file-no' : 'form-file-no');
  const currBadge = document.getElementById(isEdit ? 'edit-dispatch-curr-no-badge' : 'form-dispatch-curr-no-badge');
  const fileBadge = document.getElementById(isEdit ? 'edit-dispatch-fileno-badge' : 'form-dispatch-fileno-badge');

  if (currBadge && currNoEl) currBadge.innerText = currNoEl.value || '--';
  if (fileBadge && fileNoEl) fileBadge.innerText = fileNoEl.value || '--';
}
window.syncDispatchBadgeSummary = syncDispatchBadgeSummary;

// =============================================================
// TABLE SORTING ON SECTION RECEIPT DATE
// =============================================================
let currentSortColumn = 'recSecDate';
let currentSortOrder = 'desc';

function toggleSortSectionDate() {
  if (currentSortColumn === 'recSecDate') {
    currentSortOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';
  } else {
    currentSortColumn = 'recSecDate';
    currentSortOrder = 'desc';
  }
  const icon = document.getElementById('sort-icon-rec-sec');
  if (icon) {
    icon.innerText = currentSortOrder === 'desc' ? '▼' : '▲';
  }
  renderRegisterTable();
}
window.toggleSortSectionDate = toggleSortSectionDate;

// =============================================================
// TAPAL REMINDERS MANAGEMENT & SORTING
// =============================================================
function toggleSortReminders() {
  if (currentSortColumn === 'reminders') {
    currentSortOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';
  } else {
    currentSortColumn = 'reminders';
    currentSortOrder = 'desc';
  }
  const thEl = document.getElementById('th-reminders-col');
  if (thEl) {
    thEl.innerHTML = `Reminders ${currentSortOrder === 'desc' ? '▼' : '▲'}`;
  }
  renderRegisterTable();
}
window.toggleSortReminders = toggleSortReminders;

function toggleSortLatestReminderDate() {
  if (currentSortColumn === 'latestReminderDate') {
    currentSortOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';
  } else {
    currentSortColumn = 'latestReminderDate';
    currentSortOrder = 'desc';
  }
  const thEl = document.getElementById('th-latest-reminder-col');
  if (thEl) {
    thEl.innerHTML = `Latest Reminder Date ${currentSortOrder === 'desc' ? '▼' : '▲'}`;
  }
  renderRegisterTable();
}
window.toggleSortLatestReminderDate = toggleSortLatestReminderDate;

function getTapalReminders(tapalId) {
  const numericId = parseInt(tapalId, 10);
  return remindersState
    .filter(r => r.tapalId === numericId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id || 0) - (a.id || 0));
}
window.getTapalReminders = getTapalReminders;

function getTapalReminderCount(item) {
  if (!item) return 0;
  if (item.reminderCount !== undefined && item.reminderCount !== null && item.reminderCount > 0) {
    return item.reminderCount;
  }
  const rems = getTapalReminders(item.id);
  return rems.length;
}
window.getTapalReminderCount = getTapalReminderCount;

function renderEditReminderList(tapalId) {
  const container = document.getElementById('edit-reminder-history-list');
  if (!container) return;

  const reminders = getTapalReminders(tapalId);
  if (reminders.length === 0) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; color: #94a3b8; font-size: 12px; padding: 4px 0;">
        <span><i class="ri-information-line" style="color: #64748b; margin-right: 4px;"></i> No reminder history recorded yet.</span>
        <span class="badge" style="background: rgba(148,163,184,0.1); color: #94a3b8; font-size: 11px;">0 Reminders</span>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 6px;">
      ${reminders.map((r, idx) => `
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; background: rgba(30,41,59,0.7); border: 1px solid rgba(251,191,36,0.2); border-radius: 6px; padding: 6px 10px; font-size: 12px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="badge" style="background: rgba(245,158,11,0.2); color: #fbbf24; font-weight: 700; font-size: 10px;">#${reminders.length - idx}</span>
            <span style="color: #f8fafc; font-weight: 600;">${r.text || 'Reminder sent'}</span>
          </div>
          <span style="color: #38bdf8; font-weight: 700; font-size: 11px; white-space: nowrap;">
            <i class="ri-calendar-event-line"></i> ${formatISOToDDMMYYYY(r.date)}
          </span>
        </div>
      `).join('')}
    </div>`;
}
window.renderEditReminderList = renderEditReminderList;

let activeReminderTapalId = null;

function openRemindersModal(tapalId) {
  if (tapalId === undefined || tapalId === null || tapalId === '') return;
  const idStr = String(tapalId).trim();
  const item = tapalState.find(r => String(r.id) === idStr || String(r.sNo) === idStr || String(r.currNo) === idStr);
  if (!item) return;
  const numericId = item.id;
  activeReminderTapalId = numericId;

  const modal = document.getElementById('modal-tapal-reminders');
  const snoBadge = document.getElementById('reminders-modal-sno-badge');
  const summaryEl = document.getElementById('reminders-modal-record-summary');
  const inputEl = document.getElementById('new-reminder-text-input');

  if (snoBadge) snoBadge.innerText = `(Entry #${item.sNo} | Inward No: ${item.currNo || '-'})`;
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
        <span><strong>Subject:</strong> ${item.subject ? truncate(item.subject, 35) : '-'}</span>
        <span><strong>Section:</strong> <span style="color: #38bdf8; font-weight: 700;">${item.techSecRef || '-'}</span></span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 12px; color: #94a3b8;">
        <span><strong>Officer:</strong> ${item.officerDesig || '-'}</span>
        <span><strong>Follow Up / Alert:</strong> ${item.followUpDate ? formatISOToDDMMYYYY(item.followUpDate) : '-'}</span>
      </div>`;
  }
  if (inputEl) inputEl.value = '';

  renderRemindersModalList(numericId);
  if (modal) modal.classList.add('active');
}
window.openRemindersModal = openRemindersModal;

function renderRemindersModalList(tapalId) {
  const container = document.getElementById('reminders-modal-history-list');
  if (!container) return;

  const reminders = getTapalReminders(tapalId);
  if (reminders.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: #64748b; font-size: 13px; padding: 14px 0;"><i class="ri-notification-off-line" style="font-size: 20px; display: block; margin-bottom: 4px;"></i> No reminders recorded yet. Add the first reminder above.</div>`;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${reminders.map((r, idx) => `
        <div style="background: rgba(30,41,59,0.8); border: 1px solid rgba(251,191,36,0.25); border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <div>
            <div style="color: #f8fafc; font-weight: 600; font-size: 13px;">${r.text || 'Reminder sent'}</div>
            <div style="color: #94a3b8; font-size: 11px; margin-top: 2px;">
              <span class="badge" style="background: rgba(245,158,11,0.2); color: #fbbf24; font-size: 10px; font-weight: 700;">Reminder #${reminders.length - idx}</span>
              ${r.createdAt ? `<span style="margin-left: 6px; color: #64748b;">Logged: ${new Date(r.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>` : ''}
            </div>
          </div>
          <span style="color: #38bdf8; font-weight: 700; font-size: 12px; white-space: nowrap;">
            <i class="ri-calendar-check-line"></i> ${formatISOToDDMMYYYY(r.date)}
          </span>
        </div>
      `).join('')}
    </div>`;
}

async function addTapalReminder(tapalId, text, date) {
  const numericId = parseInt(tapalId, 10);
  const remDate = date || getTodayISO();
  const remText = (text || '').trim() || 'Reminder issued';

  const newReminder = {
    id: Date.now(),
    tapalId: numericId,
    date: remDate,
    text: remText,
    createdAt: new Date().toISOString()
  };

  remindersState.unshift(newReminder);
  saveRemindersStateToLocalStorage();

  // Update item in tapalState
  const item = tapalState.find(r => r.id === numericId);
  if (item) {
    const existingReminders = getTapalReminders(numericId);
    item.reminderCount = existingReminders.length;
    item.latestReminderDate = remDate;
    saveTapalStateToLocalStorage();
  }

  // Attempt backend async sync
  try {
    fetch(`/api/tapal/${numericId}/reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminder_date: remDate, reminder_text: remText })
    }).catch(e => console.warn('Reminder backend sync notice:', e));
  } catch (e) {}

  showToast(`Reminder logged successfully for Tapal #${item ? item.sNo : numericId}`, 'success');
  renderRegisterTable();
  renderEditReminderList(numericId);
  renderRemindersModalList(numericId);
}
window.addTapalReminder = addTapalReminder;

function promptAddReminder(mode) {
  let recId = null;
  if (mode === 'edit') {
    const editIdEl = document.getElementById('edit-record-id');
    recId = editIdEl ? parseInt(editIdEl.value, 10) : null;
  } else if (activeReminderTapalId) {
    recId = activeReminderTapalId;
  }
  if (!recId) {
    return alert('Please select an existing saved record first.');
  }

  const promptText = prompt('Enter reminder note / details (e.g. 1st Reminder sent to DE via phone / memo):', '1st Reminder sent');
  if (promptText && promptText.trim()) {
    addTapalReminder(recId, promptText.trim(), getTodayISO());
  }
}
window.promptAddReminder = promptAddReminder;

function initRemindersModalEvents() {
  const modal = document.getElementById('modal-tapal-reminders');
  const closeBtn = document.getElementById('btn-close-reminders-modal');
  const doneBtn = document.getElementById('btn-done-reminders-modal');
  const submitBtn = document.getElementById('btn-submit-new-reminder');
  const inputEl = document.getElementById('new-reminder-text-input');

  if (closeBtn && modal) closeBtn.onclick = () => modal.classList.remove('active');
  if (doneBtn && modal) doneBtn.onclick = () => modal.classList.remove('active');

  const doSubmit = () => {
    if (!activeReminderTapalId) return;
    const text = inputEl ? inputEl.value.trim() : '';
    if (!text) {
      if (inputEl) inputEl.focus();
      return;
    }
    addTapalReminder(activeReminderTapalId, text, getTodayISO());
    if (inputEl) inputEl.value = '';
  };

  if (submitBtn) submitBtn.onclick = doSubmit;
  if (inputEl) {
    inputEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSubmit();
      }
    };
  }
}
window.initRemindersModalEvents = initRemindersModalEvents;


function loginOfficialUser(user, wing = null) {
  if (!user) return;
  const sessionObj = { 
    ...user, 
    wing: wing || user.wing || (document.getElementById('login-wing') ? document.getElementById('login-wing').value : 'PLANNING / BUDGET') 
  };
  
  try {
    sessionStorage.setItem('tapal_logged_user', JSON.stringify(sessionObj));
    localStorage.setItem('tapal_logged_user_backup', JSON.stringify(sessionObj));
  } catch (e) {
    console.error('Storage error in loginOfficialUser:', e);
  }
  activeUserSession = sessionObj;

  // Immediately hide login screen with maximum specificity
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.querySelector('.app-container');

  if (loginScreen) {
    loginScreen.style.setProperty('display', 'none', 'important');
    loginScreen.style.setProperty('visibility', 'hidden', 'important');
    loginScreen.style.setProperty('opacity', '0', 'important');
    loginScreen.style.setProperty('pointer-events', 'none', 'important');
  }

  if (appContainer) {
    appContainer.style.setProperty('display', 'flex', 'important');
    appContainer.style.setProperty('visibility', 'visible', 'important');
    appContainer.style.setProperty('opacity', '1', 'important');
  }

  // Close any open floating dropdowns
  try {
    const openDropdowns = document.querySelectorAll('.searchable-select-dropdown');
    openDropdowns.forEach(d => d.style.display = 'none');
    const openContainers = document.querySelectorAll('.searchable-select-container.is-open');
    openContainers.forEach(c => c.classList.remove('is-open'));
  } catch (e) {
    console.error('Error closing dropdowns:', e);
  }

  // Update navbar and sidebar credentials
  try {
    updateLoggedInUI();
  } catch (e) {
    console.error('updateLoggedInUI error:', e);
  }

  // Ensure default active dashboard tab
  try {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(n => {
      if (n.dataset.tab === 'dashboard-pane') n.classList.add('active');
      else n.classList.remove('active');
    });
    const contentPanes = document.querySelectorAll('.tab-pane');
    contentPanes.forEach(p => {
      if (p.id === 'dashboard-pane') p.classList.add('active');
      else p.classList.remove('active');
    });
  } catch (e) {
    console.error('Error activating dashboard tab:', e);
  }

  try {
    if (typeof renderDashboard === 'function') renderDashboard();
  } catch (e) {
    console.error('renderDashboard error:', e);
  }

  try {
    if (typeof renderRegisterTable === 'function') renderRegisterTable();
  } catch (e) {
    console.error('renderRegisterTable error:', e);
  }

  try {
    if (typeof showToast === 'function') {
      showToast(`Welcome, ${sessionObj.name}! Logged in as ${sessionObj.role}`, 'success');
    }
  } catch (e) {
    console.error('showToast error:', e);
  }
}
window.loginOfficialUser = loginOfficialUser;

function handleLoginSubmit(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const usernameEl = document.getElementById('login-username');
  const passwordEl = document.getElementById('login-password');
  const wingEl = document.getElementById('login-wing');

  const usernameInput = (usernameEl ? usernameEl.value : '').trim();
  const passwordInput = (passwordEl ? passwordEl.value : '').trim();
  const wingInput = (wingEl ? wingEl.value : '') || 'PLANNING / BUDGET';

  if (!usernameInput) {
    loginOfficialUser(officialUsersState[0], wingInput);
    return;
  }

  const uLower = usernameInput.toLowerCase();
  const pLower = passwordInput.toLowerCase();

  let foundUser = officialUsersState.find(u => {
    const dbUserLower = (u.username || '').toLowerCase();
    const dbDesigLower = (u.designation || '').toLowerCase();
    const dbNameLower = (u.name || '').toLowerCase();

    return dbUserLower === uLower || 
           dbDesigLower === uLower || 
           dbDesigLower.includes(uLower) || 
           dbNameLower.includes(uLower);
  });

  if (!foundUser) {
    if (uLower.includes('admin') || uLower.includes('chief') || uLower === 'ce') foundUser = officialUsersState[0];
    else if (uLower.includes('se') || uLower.includes('salem') || uLower === 'se_slm') foundUser = officialUsersState[1];
    else if (uLower.includes('de') || uLower.includes('coimbatore') || uLower.includes('cbe') || uLower === 'de_cbe') foundUser = officialUsersState[2];
    else if (uLower.includes('plan') || uLower.includes('ae') || uLower === 'planning') foundUser = officialUsersState[3];
    else foundUser = officialUsersState[0];
  }

  loginOfficialUser(foundUser, wingInput);
}
window.handleLoginSubmit = handleLoginSubmit;

function quickLogin(username, password = null, wing = null) {
  try {
    const uLower = String(username || '').toLowerCase();
    let user = officialUsersState.find(u => 
      u.username.toLowerCase() === uLower || 
      (u.designation && u.designation.toLowerCase().includes(uLower)) ||
      (u.role && u.role.toLowerCase().includes(uLower))
    );

    if (!user) {
      if (uLower.includes('admin') || uLower.includes('chief') || uLower === 'ce') user = officialUsersState[0];
      else if (uLower.includes('se') || uLower.includes('salem') || uLower === 'se_slm') user = officialUsersState[1];
      else if (uLower.includes('de') || uLower.includes('coimbatore') || uLower.includes('cbe') || uLower === 'de_cbe') user = officialUsersState[2];
      else if (uLower.includes('plan') || uLower.includes('ae') || uLower === 'planning') user = officialUsersState[3];
      else user = officialUsersState[0];
    }

    if (!user) {
      user = { id: 1, name: 'Executive Chief Engineer', username: 'admin', password: 'admin123', designation: 'Chief Engineer', role: 'Super Admin', wing: 'EXECUTIVE', status: 'Active' };
    }

    const userEl = document.getElementById('login-username');
    const passEl = document.getElementById('login-password');
    const wingEl = document.getElementById('login-wing');

    if (userEl) userEl.value = user.username;
    if (passEl) passEl.value = password || user.password;
    if (wing && wingEl) {
      wingEl.value = wing;
      if (typeof window.refreshSearchableSelect === 'function') {
        window.refreshSearchableSelect(wingEl);
      }
    }

    const chosenWing = wing || user.wing || (wingEl ? wingEl.value : 'PLANNING / BUDGET');
    loginOfficialUser(user, chosenWing);
  } catch (err) {
    console.error('quickLogin error:', err);
    const fallbackUser = officialUsersState[0] || { id: 1, name: 'Executive Chief Engineer', username: 'admin', password: 'admin123', designation: 'Chief Engineer', role: 'Super Admin', wing: 'EXECUTIVE', status: 'Active' };
    loginOfficialUser(fallbackUser, 'EXECUTIVE');
  }
}
window.quickLogin = quickLogin;

function handleLogout() {
  if (confirm('Are you sure you want to log out of the official portal?')) {
    sessionStorage.removeItem('tapal_logged_user');
    localStorage.removeItem('tapal_logged_user_backup');
    activeUserSession = null;
    checkAuthSession();
  }
}
window.handleLogout = handleLogout;

function renderCredentialsTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  tbody.innerHTML = officialUsersState.map(user => `
    <tr>
      <td><strong>#${user.id}</strong></td>
      <td><strong>${user.name}</strong></td>
      <td><span class="badge" style="background: rgba(56,189,248,0.15); color: #38bdf8; font-weight:700;">${user.username}</span></td>
      <td><code style="background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #ff79c6;">${'•'.repeat(user.password.length)}</code></td>
      <td>${user.designation}</td>
      <td><span class="badge" style="background: rgba(52,211,153,0.15); color: #34d399;">${user.role}</span></td>
      <td><span class="badge badge-filed">${user.status}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="deleteOfficialUser(${user.id})" title="Delete Account">
          <i class="ri-delete-bin-line" style="color: var(--danger);"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function addOfficialUser() {
  const name = document.getElementById('user-new-name').value.trim();
  const username = document.getElementById('user-new-username').value.trim();
  const password = document.getElementById('user-new-password').value.trim();
  const desig = document.getElementById('user-new-desig').value.trim();
  const role = document.getElementById('user-new-role').value;

  if (!name || !username || !password || !desig) {
    return alert('Please fill in all official user details (Name, Username, Password, Designation).');
  }

  const newUser = {
    id: Date.now(),
    name,
    username,
    password,
    designation: desig,
    role,
    wing: 'PLANNING / BUDGET',
    status: 'Active'
  };

  officialUsersState.push(newUser);
  renderCredentialsTable();

  document.getElementById('user-new-name').value = '';
  document.getElementById('user-new-username').value = '';
  document.getElementById('user-new-password').value = '';
  document.getElementById('user-new-desig').value = '';
  alert(`Official account '${username}' created successfully!`);
}

function deleteOfficialUser(id) {
  if (confirm('Are you sure you want to delete this official account?')) {
    officialUsersState = officialUsersState.filter(u => String(u.id) !== String(id));
    renderCredentialsTable();
  }
}
window.deleteOfficialUser = deleteOfficialUser;

function updateOfficerFilterDropdown() {
  const thFilterOffice = document.getElementById('th-filter-office');
  const thFilterOfficer = document.getElementById('th-filter-officer');
  if (!thFilterOfficer) return;

  const selectedOffice = thFilterOffice ? thFilterOffice.value : 'ALL';
  const currentVal = thFilterOfficer.value || 'ALL';

  let officerOptions = [];
  if (selectedOffice && selectedOffice !== 'ALL') {
    officerOptions = typeof getOfficerDesignations === 'function' ? getOfficerDesignations(selectedOffice) : [];
  } else {
    const allSet = new Set();
    const offices = (typeof MAIN_OFFICES !== 'undefined') ? MAIN_OFFICES : ['GOVT', 'MORTH', 'SE', 'DE', 'CE', 'AG', 'NHAI', 'Others'];
    offices.forEach(off => {
      const list = typeof getOfficerDesignations === 'function' ? getOfficerDesignations(off) : [];
      list.forEach(item => allSet.add(item));
    });
    officerOptions = Array.from(allSet);
  }

  if (customDropdownOptions && customDropdownOptions.officerDesig && Array.isArray(customDropdownOptions.officerDesig)) {
    customDropdownOptions.officerDesig.forEach(opt => {
      if (!officerOptions.includes(opt)) officerOptions.push(opt);
    });
  }

  let html = '<option value="ALL">Officer Designation ▾</option>';
  officerOptions.forEach(opt => {
    html += `<option value="${opt}">${opt}</option>`;
  });
  html += '<option value="__ADD_NEW__" style="color: #38bdf8; font-weight: bold;">➕ Add Custom Option...</option>';
  html += '<option value="__MANAGE_OPTIONS__" style="color: #f87171; font-weight: bold;">🗑️ Manage / Delete Options...</option>';

  thFilterOfficer.innerHTML = html;
  if (currentVal && Array.from(thFilterOfficer.options).some(o => o.value === currentVal)) {
    thFilterOfficer.value = currentVal;
  } else {
    thFilterOfficer.value = 'ALL';
  }
  if (typeof window.refreshSearchableSelect === 'function') {
    window.refreshSearchableSelect(thFilterOfficer);
  }
}
window.updateOfficerFilterDropdown = updateOfficerFilterDropdown;

function updateShortSubFilterDropdown() {
  const thFilterSection = document.getElementById('th-filter-section');
  const thFilterShortSub = document.getElementById('th-filter-short-sub');
  if (!thFilterShortSub) return;

  const selectedSec = thFilterSection ? thFilterSection.value : 'ALL';
  const currentVal = thFilterShortSub.value || 'ALL';

  let subOptions = [];
  if (selectedSec && selectedSec !== 'ALL') {
    subOptions = typeof getSubjectInBrief === 'function' ? getSubjectInBrief(selectedSec) : [];
  } else {
    const allSet = new Set();
    const sections = (typeof SECTIONS !== 'undefined') ? SECTIONS : ['ACCT', 'DB', 'ESTT', 'R&B', 'PLG', 'CRIF', 'CONT', 'CMGT', 'RSQC'];
    sections.forEach(sec => {
      const list = typeof getSubjectInBrief === 'function' ? getSubjectInBrief(sec) : [];
      list.forEach(item => allSet.add(item));
    });
    subOptions = Array.from(allSet);
  }

  if (customDropdownOptions && customDropdownOptions.shortSub && Array.isArray(customDropdownOptions.shortSub)) {
    customDropdownOptions.shortSub.forEach(opt => {
      if (!subOptions.includes(opt)) subOptions.push(opt);
    });
  }

  let html = '<option value="ALL">SUBJECT IN BRIEF ▾</option>';
  subOptions.forEach(opt => {
    html += `<option value="${opt}">${opt}</option>`;
  });
  html += '<option value="__ADD_NEW__" style="color: #38bdf8; font-weight: bold;">➕ Add Custom Option...</option>';
  html += '<option value="__MANAGE_OPTIONS__" style="color: #f87171; font-weight: bold;">🗑️ Manage / Delete Options...</option>';

  thFilterShortSub.innerHTML = html;
  if (currentVal && Array.from(thFilterShortSub.options).some(o => o.value === currentVal)) {
    thFilterShortSub.value = currentVal;
  } else {
    thFilterShortSub.value = 'ALL';
  }
  if (typeof window.refreshSearchableSelect === 'function') {
    window.refreshSearchableSelect(thFilterShortSub);
  }
}
window.updateShortSubFilterDropdown = updateShortSubFilterDropdown;

function initDynamicDropdowns() {
  const formMainOffice = document.getElementById('form-main-office');
  if (formMainOffice) {
    formMainOffice.addEventListener('change', () => {
      updateOfficerModalDropdown('register');
    });
  }

  const formSection = document.getElementById('form-tech-sec-ref');
  if (formSection) {
    formSection.addEventListener('change', () => {
      updateEmpDesigModalDropdown('register');
      updateShortSubModalDropdown('register');
      handleFormStatusAndSectionVisibility('register');
    });
  }

  const formStatus = document.getElementById('form-status');
  if (formStatus) {
    formStatus.addEventListener('change', () => {
      handleFormStatusAndSectionVisibility('register');
    });
  }

  const formActionInit = document.getElementById('form-action-initiated');
  if (formActionInit) {
    formActionInit.addEventListener('input', () => {
      if (formActionInit.value.trim().toLowerCase() === 'filed') {
        const st = document.getElementById('form-status');
        if (st) st.value = 'Filed';
        handleFormStatusAndSectionVisibility('register');
      }
    });
  }

  const editMainOffice = document.getElementById('edit-main-office');
  if (editMainOffice) {
    editMainOffice.addEventListener('change', () => {
      updateOfficerModalDropdown('edit');
    });
  }

  const editSection = document.getElementById('edit-tech-sec-ref');
  if (editSection) {
    editSection.addEventListener('change', () => {
      updateEmpDesigModalDropdown('edit');
      updateShortSubModalDropdown('edit');
      handleFormStatusAndSectionVisibility('edit');
    });
  }

  const editStatus = document.getElementById('edit-status');
  if (editStatus) {
    editStatus.addEventListener('change', () => {
      handleFormStatusAndSectionVisibility('edit');
    });
  }

  const editActionInit = document.getElementById('edit-action-initiated');
  if (editActionInit) {
    editActionInit.addEventListener('input', () => {
      if (editActionInit.value.trim().toLowerCase() === 'filed') {
        const st = document.getElementById('edit-status');
        if (st) st.value = 'Filed';
        handleFormStatusAndSectionVisibility('edit');
      }
    });
  }

  const thFilterOffice = document.getElementById('th-filter-office');
  if (thFilterOffice) {
    thFilterOffice.addEventListener('change', () => {
      updateOfficerFilterDropdown();
      currentPage = 1;
      renderRegisterTable();
    });
  }

  const thFilterSection = document.getElementById('th-filter-section');
  if (thFilterSection) {
    thFilterSection.addEventListener('change', () => {
      updateEmpDesigFilterDropdown();
      updateShortSubFilterDropdown();
      currentPage = 1;
      renderRegisterTable();
    });
  }

  // Initial population of filter dropdowns
  updateOfficerFilterDropdown();
  updateShortSubFilterDropdown();
  updateEmpDesigFilterDropdown();

  const dashSecEl = document.getElementById('dashboard-section-filter');
  if (dashSecEl && !dashSecEl.dataset.bound) {
    dashSecEl.dataset.bound = 'true';
    dashSecEl.addEventListener('change', (e) => {
      if (e.target.value === '__ADD_NEW__' || e.target.value === '__MANAGE_OPTIONS__') {
        handleCustomAddOn(e.target);
        return;
      }
      renderDashboard();
    });
  }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  checkAuthSession();
  initNavigation();
  initSidebarSlideEvents();
  initDynamicDropdowns();
  bindAllDateInputsInDOM();
  loadPostgreSQLData(); // Fetch in background, do not block synchronous UI initialization
  renderDashboard();
  renderExcelSheetTabs();
  renderRegisterTable();
  initRegisterDateFilterEvents();
  initFileRefSearchEvents();
  renderKanbanPipeline();
  initModalEvents();
  initEditModalEvents();
  initSentToTagEvents();

  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.onsubmit = handleLoginSubmit;

  const demoAdminBtn = document.getElementById('btn-demo-admin');
  if (demoAdminBtn) demoAdminBtn.addEventListener('click', (e) => { e.preventDefault(); quickLogin('admin', 'admin123', 'EXECUTIVE'); });

  const demoSeBtn = document.getElementById('btn-demo-se');
  if (demoSeBtn) demoSeBtn.addEventListener('click', (e) => { e.preventDefault(); quickLogin('se_slm', 'se123', 'PLANNING / BUDGET'); });

  const demoDeBtn = document.getElementById('btn-demo-de');
  if (demoDeBtn) demoDeBtn.addEventListener('click', (e) => { e.preventDefault(); quickLogin('de_cbe', 'de123', 'ROADS'); });

  const demoPlanBtn = document.getElementById('btn-demo-planning');
  if (demoPlanBtn) demoPlanBtn.addEventListener('click', (e) => { e.preventDefault(); quickLogin('planning', 'plan123', 'PLANNING / BUDGET'); });

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.onclick = handleLogout;

  const addUserBtn = document.getElementById('btn-add-official-user');
  if (addUserBtn) addUserBtn.onclick = addOfficialUser;

  const exportBtn = document.getElementById('btn-export-excel');
  if (exportBtn) exportBtn.onclick = exportToMultiSheetExcel;

  const importInput = document.getElementById('input-import-excel');
  if (importInput) importInput.onchange = importFromExcelWorkbook;
});

// Load live records from PostgreSQL REST API if available
async function loadPostgreSQLData() {
  try {
    const res = await fetch('/api/tapal?limit=500');
    if (res.ok) {
      const json = await res.json();
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        tapalState = json.data;
        saveTapalStateToLocalStorage();
        renderDashboard();
        renderRegisterTable();
        if (typeof renderFollowUpModule === 'function') renderFollowUpModule();
        if (typeof renderKanbanPipeline === 'function') renderKanbanPipeline();
        if (typeof renderSLAAnalytics === 'function') renderSLAAnalytics();
        if (typeof updateHomeKPICounters === 'function') updateHomeKPICounters();
        console.log(`Loaded ${json.data.length} records from PostgreSQL database API.`);
      }
    }
  } catch (err) {
    console.log('PostgreSQL API server not detected, running with local dataset.');
  }
}

// Automatic Reset of Inward Tapal Module to Default View on Navigation
function resetRegisterModuleDefaultView() {
  // 1. Reset Search Input Box
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';

  // 2. Reset Table Header & Banner Filter Dropdowns
  const thFilterType = document.getElementById('th-filter-type');
  const thFilterOffice = document.getElementById('th-filter-office');
  const thFilterOfficer = document.getElementById('th-filter-officer');
  const thFilterStatus = document.getElementById('th-filter-status');
  const thFilterShortSub = document.getElementById('th-filter-short-sub');
  const thFilterLetterRef = document.getElementById('th-filter-letter-ref');
  const thFilterSection = document.getElementById('th-filter-section');
  const thFilterEmpDesig = document.getElementById('th-filter-emp-desig');
  const filterLetterWhom = document.getElementById('filter-letter-whom');

  if (thFilterType) thFilterType.value = 'ALL';
  if (thFilterOffice) thFilterOffice.value = 'ALL';
  if (thFilterOfficer) thFilterOfficer.value = 'ALL';
  if (thFilterStatus) thFilterStatus.value = 'ALL';
  if (thFilterShortSub) thFilterShortSub.value = 'ALL';
  if (thFilterLetterRef) thFilterLetterRef.value = 'ALL';
  if (thFilterSection) thFilterSection.value = 'ALL';
  if (thFilterEmpDesig) thFilterEmpDesig.value = 'ALL';
  if (filterLetterWhom) filterLetterWhom.value = 'ALL';

  // 3. Reset Active Excel Sheet Pill Tab
  activeSheetTab = 'ALL';
  if (typeof renderExcelSheetTabs === 'function') renderExcelSheetTabs();

  // 4. Reset Date Filters
  activeDateFilter = null;
  const regRangeStartText = document.getElementById('reg-range-start-text');
  const regRangeStartPicker = document.getElementById('reg-range-start-picker');
  const regRangeEndText = document.getElementById('reg-range-end-text');
  const regRangeEndPicker = document.getElementById('reg-range-end-picker');
  const regSingleText = document.getElementById('reg-single-date-text');
  const regSinglePicker = document.getElementById('reg-single-date-picker');

  if (regRangeStartText) regRangeStartText.value = '';
  if (regRangeStartPicker) regRangeStartPicker.value = '';
  if (regRangeEndText) regRangeEndText.value = '';
  if (regRangeEndPicker) regRangeEndPicker.value = '';
  if (regSingleText) regSingleText.value = '';
  if (regSinglePicker) regSinglePicker.value = '';

  const quickMonthSelect = document.getElementById('quick-month-select');
  if (quickMonthSelect) quickMonthSelect.value = 'ALL';

  // 5. Exit Fullscreen Table Mode if Active
  const appContainer = document.querySelector('.app-container');
  const btnToggleFullscreenTable = document.getElementById('btn-toggle-fullscreen-table');
  if (appContainer) {
    appContainer.classList.remove('table-fullscreen-mode');
  }
  if (btnToggleFullscreenTable) {
    btnToggleFullscreenTable.innerHTML = '<i class="ri-fullscreen-line"></i> Fullscreen Table';
  }

  // 6. Reset Pagination
  currentPage = 1;

  // 7. Refresh Dependent Dropdowns & Re-render Register Table
  if (thFilterOffice) {
    thFilterOffice.dispatchEvent(new Event('change'));
  } else if (typeof renderRegisterTable === 'function') {
    renderRegisterTable();
  }
  if (typeof updateFilterBadgeUI === 'function') updateFilterBadgeUI();
}

// Navigation Tab Router
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const panes = document.querySelectorAll('.tab-pane');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  const appContainer = document.querySelector('.app-container');

  const titles = {
    'dashboard-pane': { title: 'Executive Dashboard', subtitle: 'Real-time tracking of incoming mail, officers, and stage turnaround performance' },
    'register-pane': { title: 'Inward Tapal Register', subtitle: 'Search, filter, edit, and track all registered office correspondence' },
    'pipeline-pane': { title: 'Role Workflow Pipeline', subtitle: 'Multi-tier kanban stage tracking across inward clerks, officers, and dispatch' },
    'followup-pane': { title: 'Follow Up Cases & Reminder Alerts', subtitle: 'Real-time alert tracking, 1-day reminder notifications, and closure auditing' },
    'inbox-pane': { title: 'Admin Inbox & Issue Management', subtitle: 'Review, track, and resolve grievances and complaints raised on Tapal records' }
  };

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = item.getAttribute('data-tab');

      if (targetTab === 'inbox-pane') {
        renderAdminInbox();
      } else if (targetTab === 'followup-pane') {
        renderFollowUpModule();
      } else if (targetTab === 'dashboard-pane') {
        renderDashboardFollowUpAlerts();
      }

      // Always reset Inward Tapal module back to clean default view upon tab switching
      resetRegisterModuleDefaultView();

      navItems.forEach(nav => nav.classList.remove('active'));
      panes.forEach(pane => pane.classList.remove('active'));

      item.classList.add('active');
      const targetEl = document.getElementById(targetTab);
      if (targetEl) targetEl.classList.add('active');

      if (titles[targetTab]) {
        pageTitle.innerText = titles[targetTab].title;
        pageSubtitle.innerText = titles[targetTab].subtitle;
      }

      // Auto-slide sidebar to collapsed mode for full screen width when clicking Inward Tapal Register
      if (targetTab === 'register-pane') {
        if (appContainer) {
          appContainer.classList.add('sidebar-collapsed');
          const iconToggle = document.getElementById('icon-toggle-sidebar');
          if (iconToggle) iconToggle.className = 'ri-menu-unfold-line';
        }
      } else if (targetTab === 'dashboard-pane') {
        if (appContainer) {
          appContainer.classList.remove('sidebar-collapsed');
          const iconToggle = document.getElementById('icon-toggle-sidebar');
          if (iconToggle) iconToggle.className = 'ri-menu-fold-line';
        }
      }
    });
  });
}

function initSidebarSlideEvents() {
  const appContainer = document.querySelector('.app-container');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const iconToggleSidebar = document.getElementById('icon-toggle-sidebar');
  const btnToggleFullscreenTable = document.getElementById('btn-toggle-fullscreen-table');
  const iconFullscreenTable = document.getElementById('icon-fullscreen-table');

  if (btnToggleSidebar) {
    btnToggleSidebar.onclick = () => {
      if (appContainer) {
        appContainer.classList.toggle('sidebar-collapsed');
        const isCollapsed = appContainer.classList.contains('sidebar-collapsed');
        if (iconToggleSidebar) {
          iconToggleSidebar.className = isCollapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line';
        }
      }
    };
  }

  if (btnToggleFullscreenTable) {
    btnToggleFullscreenTable.onclick = () => {
      if (appContainer) {
        appContainer.classList.toggle('table-fullscreen-mode');
        const isFullscreen = appContainer.classList.contains('table-fullscreen-mode');
        btnToggleFullscreenTable.innerHTML = isFullscreen
          ? '<i class="ri-fullscreen-exit-line"></i> Exit Fullscreen'
          : '<i class="ri-fullscreen-line"></i> Fullscreen Table';
      }
    };
  }
}

/// -------------------------------------------------------------
// 1. AUTHENTIC EXCEL MONITORING DASHBOARD & METRICS
// -------------------------------------------------------------
const monthNamesList = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Helper to parse 0-indexed month from recSecDate (YYYY-MM-DD) or month property ("JAN-2023") cleanly without timezone shifts
function getItemMonthIndex(item) {
  if (item.recSecDate && typeof item.recSecDate === 'string') {
    const parts = item.recSecDate.split('T')[0].split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const m = parseInt(parts[1], 10) - 1;
      if (!isNaN(m) && m >= 0 && m < 12) return m;
    }
  }
  if (item.month && typeof item.month === 'string') {
    const mStr = item.month.split('-')[0].toUpperCase();
    const idx = monthNamesList.indexOf(mStr);
    if (idx !== -1) return idx;
  }
  return -1;
}

// Interactive Navigation Helper triggered when clicking KPI subtext pills or Matrix cells
function filterAndNavigateToRegister(params = {}) {
  const navItems = document.querySelectorAll('.nav-item');
  const panes = document.querySelectorAll('.tab-pane');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  const appContainer = document.querySelector('.app-container');

  navItems.forEach(nav => nav.classList.remove('active'));
  panes.forEach(pane => pane.classList.remove('active'));

  const registerNavItem = document.querySelector('.nav-item[data-tab="register-pane"]');
  if (registerNavItem) registerNavItem.classList.add('active');

  const registerPane = document.getElementById('register-pane');
  if (registerPane) registerPane.classList.add('active');

  if (pageTitle) pageTitle.innerText = 'Inward Tapal Register';
  if (pageSubtitle) pageSubtitle.innerText = 'Search, filter, edit, and track all registered office correspondence';

  if (appContainer) {
    appContainer.classList.add('sidebar-collapsed');
    const iconToggle = document.getElementById('icon-toggle-sidebar');
    if (iconToggle) iconToggle.className = 'ri-menu-unfold-line';
  }

  // Clear search input so exact status filter is active
  const searchInput = document.getElementById('search-input');
  if (searchInput && params.keepSearch !== true) {
    searchInput.value = '';
  }

  // Set Type Filter
  const thTypeEl = document.getElementById('th-filter-type');
  if (thTypeEl) thTypeEl.value = params.type || 'ALL';

  // Set Month Filter
  const filterMonthEl = document.getElementById('filter-month');
  if (filterMonthEl) filterMonthEl.value = params.month || 'ALL';
  if (params.month) {
    activeSheetTab = params.month;
    renderExcelSheetTabs();
  }

  // Set Status Filter
  const thStatusEl = document.getElementById('th-filter-status');
  const filterStatusEl = document.getElementById('filter-status');
  const statusVal = params.status || 'ALL';
  if (thStatusEl) thStatusEl.value = statusVal;
  if (filterStatusEl) filterStatusEl.value = statusVal;

  // Set Section Filter
  const thSectionEl = document.getElementById('th-filter-section');
  if (thSectionEl && params.section && params.section !== 'ALL') {
    thSectionEl.value = params.section;
    if (typeof updateEmpDesigFilterDropdown === 'function') updateEmpDesigFilterDropdown();
  }

  currentPage = 1;
  renderRegisterTable();
}

function populateDashboardSectionDropdown() {
  const dashSecEl = document.getElementById('dashboard-section-filter');
  if (!dashSecEl) return;

  const currentVal = dashSecEl.value || 'ALL';
  const allSections = typeof getAllSections === 'function' ? getAllSections() : [];

  let html = '<option value="ALL">SECTION ▾ (All Sections)</option>';
  allSections.forEach(s => {
    html += `<option value="${s.code}">${s.display}</option>`;
  });
  html += '<option value="__ADD_NEW__" style="color: #38bdf8; font-weight: bold;">➕ Add Custom Option...</option>';
  html += '<option value="__MANAGE_OPTIONS__" style="color: #f87171; font-weight: bold;">🗑️ Manage / Delete Options...</option>';

  dashSecEl.innerHTML = html;
  if (allSections.some(s => s.code === currentVal) || currentVal === 'ALL') {
    dashSecEl.value = currentVal;
  } else {
    dashSecEl.value = 'ALL';
  }
}
window.populateDashboardSectionDropdown = populateDashboardSectionDropdown;

function renderDashboard() {
  try {
    populateDashboardSectionDropdown();

    const dashSecEl = document.getElementById('dashboard-section-filter');
  const selectedSec = (dashSecEl && dashSecEl.value && dashSecEl.value !== 'ALL' && !dashSecEl.value.startsWith('__')) ? dashSecEl.value : 'ALL';

  // Filter tapal records by selected section
  const activeTapalData = (selectedSec === 'ALL')
    ? tapalState
    : tapalState.filter(r => r.techSecRef && r.techSecRef.trim().toLowerCase() === selectedSec.trim().toLowerCase());

  const totalReceived = activeTapalData.length;
  const pendingCount = activeTapalData.filter(r => r.status === 'Pending').length;
  const actionTakenCount = totalReceived - pendingCount;

  // Dynamic Received Types (Tapal, Email + any custom added types like Speed Post, Courier, etc.)
  const defaultReceivedTypes = [
    { key: 'Tapal', label: 'Tapal', color: '#38bdf8' },
    { key: 'Email', label: 'Email', color: '#c084fc' }
  ];

  const customTypePalette = ['#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c', '#2dd4bf', '#818cf8', '#e879f9'];
  let customTypeColorIdx = 0;

  const receivedTypeMap = new Map();
  defaultReceivedTypes.forEach(t => {
    receivedTypeMap.set(t.key.toLowerCase(), t);
  });

  // Check custom dropdown options for tapalType
  const customTypes = (customDropdownOptions && customDropdownOptions.tapalType) ? customDropdownOptions.tapalType : [];
  customTypes.forEach(t => {
    if (t && !t.startsWith('__')) {
      const lower = t.toLowerCase();
      if (!receivedTypeMap.has(lower)) {
        const color = customTypePalette[customTypeColorIdx % customTypePalette.length];
        customTypeColorIdx++;
        receivedTypeMap.set(lower, { key: t, label: t, color });
      }
    }
  });

  // Check tapal records for any additional types
  if (Array.isArray(activeTapalData)) {
    activeTapalData.forEach(r => {
      if (r.tapalType && r.tapalType !== '-' && !r.tapalType.startsWith('__')) {
        const lower = r.tapalType.toLowerCase();
        if (!receivedTypeMap.has(lower)) {
          const color = customTypePalette[customTypeColorIdx % customTypePalette.length];
          customTypeColorIdx++;
          receivedTypeMap.set(lower, { key: r.tapalType, label: r.tapalType, color });
        }
      }
    });
  }

  // Check options present in #form-tapal-type select in DOM
  const formTypeEl = document.getElementById('form-tapal-type');
  if (formTypeEl && formTypeEl.options) {
    Array.from(formTypeEl.options).forEach(opt => {
      const v = opt.value;
      if (v && !v.startsWith('__') && v !== 'ALL') {
        const lower = v.toLowerCase();
        if (!receivedTypeMap.has(lower)) {
          const color = customTypePalette[customTypeColorIdx % customTypePalette.length];
          customTypeColorIdx++;
          receivedTypeMap.set(lower, { key: v, label: v, color });
        }
      }
    });
  }

  // Generate received type pills (shows count for all, including 0)
  const receivedTypePills = Array.from(receivedTypeMap.values()).map(t => {
    const count = activeTapalData.filter(r => {
      if (t.key.toLowerCase() === 'tapal') {
        return !r.tapalType || r.tapalType === 'Tapal' || r.tapalType === '-';
      }
      return r.tapalType && r.tapalType.toLowerCase() === t.key.toLowerCase();
    }).length;

    return `<button class="kpi-pill-btn" onclick="filterAndNavigateToRegister({ type: '${t.key}', section: '${selectedSec}' })" style="color: ${t.color};" title="Click to view all ${t.label} items in ${selectedSec === 'ALL' ? 'all sections' : selectedSec}">${t.label}: <strong>${count}</strong></button>`;
  }).join('');

  // Dynamic Action Taken Statuses (Defaults + any custom added statuses + any in records or dropdowns)
  const defaultActionStatuses = [
    { key: 'Memo', label: 'Memo', color: '#ff79c6' },
    { key: 'Proceeding', label: 'Proceedings', color: '#34d399' },
    { key: 'Filed', label: 'Filed', color: '#38bdf8' },
    { key: 'Letter', label: 'Letters', color: '#fbbf24' }
  ];

  const customStatusPalette = ['#a78bfa', '#f472b6', '#2dd4bf', '#fb923c', '#818cf8', '#ec4899', '#4ade80', '#38bdf8', '#e879f9'];
  let customColorIdx = 0;

  const actionStatusMap = new Map();
  defaultActionStatuses.forEach(item => {
    actionStatusMap.set(item.key.toLowerCase(), item);
  });

  // Check custom dropdown options for status
  const customStatuses = (customDropdownOptions && customDropdownOptions.status) ? customDropdownOptions.status : [];
  customStatuses.forEach(s => {
    if (s && s !== 'Pending' && !s.startsWith('__')) {
      const lower = s.toLowerCase();
      if (!actionStatusMap.has(lower)) {
        const color = customStatusPalette[customColorIdx % customStatusPalette.length];
        customColorIdx++;
        actionStatusMap.set(lower, { key: s, label: s, color });
      }
    }
  });

  // Check dictionaryState for statuses
  if (typeof dictionaryState !== 'undefined' && dictionaryState.statuses) {
    dictionaryState.statuses.forEach(s => {
      if (s && s !== 'Pending' && !s.startsWith('__')) {
        const lower = s.toLowerCase();
        if (!actionStatusMap.has(lower)) {
          const color = customStatusPalette[customColorIdx % customStatusPalette.length];
          customColorIdx++;
          actionStatusMap.set(lower, { key: s, label: s, color });
        }
      }
    });
  }

  // Check tapalState records for any additional statuses
  if (Array.isArray(activeTapalData)) {
    activeTapalData.forEach(r => {
      if (r.status && r.status !== 'Pending' && !r.status.startsWith('__')) {
        const lower = r.status.toLowerCase();
        if (!actionStatusMap.has(lower)) {
          const color = customStatusPalette[customColorIdx % customStatusPalette.length];
          customColorIdx++;
          actionStatusMap.set(lower, { key: r.status, label: r.status, color });
        }
      }
    });
  }

  // Check options present in #form-status select in DOM
  const formStatusEl = document.getElementById('form-status');
  if (formStatusEl && formStatusEl.options) {
    Array.from(formStatusEl.options).forEach(opt => {
      const v = opt.value;
      if (v && v !== 'Pending' && !v.startsWith('__') && v !== 'ALL') {
        const lower = v.toLowerCase();
        if (!actionStatusMap.has(lower)) {
          const color = customStatusPalette[customColorIdx % customStatusPalette.length];
          customColorIdx++;
          actionStatusMap.set(lower, { key: v, label: v, color });
        }
      }
    });
  }

  // Generate action status pills (shows count for all, including 0)
  const actionStatusPills = Array.from(actionStatusMap.values()).map(st => {
    const count = activeTapalData.filter(r => {
      if (!r.status) return false;
      if (st.key.toLowerCase() === 'proceeding') return r.status.toLowerCase() === 'proceeding' || r.status.toLowerCase() === 'proceedings';
      if (st.key.toLowerCase() === 'letter') return r.status.toLowerCase() === 'letter' || r.status.toLowerCase() === 'letters';
      return r.status.toLowerCase() === st.key.toLowerCase();
    }).length;

    return `<button class="kpi-pill-btn" onclick="filterAndNavigateToRegister({ status: '${st.key}', section: '${selectedSec}' })" style="color: ${st.color};" title="Click to view ${st.label} items in ${selectedSec === 'ALL' ? 'all sections' : selectedSec}">${st.label}: <strong>${count}</strong></button>`;
  }).join('');

  // Breakdown counts for Pendings by Standard Offices
  const pendingItems = activeTapalData.filter(r => r.status === 'Pending');
  const standardOffices = ['SE', 'DE', 'MORTH', 'GOVT', 'CE', 'OTHERS'];
  const pendOfficeCounts = { 'SE': 0, 'DE': 0, 'MORTH': 0, 'GOVT': 0, 'CE': 0, 'OTHERS': 0 };

  pendingItems.forEach(r => {
    let off = (r.mainOffice || '').trim().toUpperCase();
    if (!off || off === '-' || off === 'NONE' || off === 'NULL') {
      pendOfficeCounts['OTHERS']++;
    } else if (standardOffices.includes(off)) {
      pendOfficeCounts[off]++;
    } else {
      pendOfficeCounts['OTHERS']++;
    }
  });

  // KPI UI
  const kpiRec = document.getElementById('kpi-received');
  const kpiRecSub = document.getElementById('kpi-received-subtext');
  const kpiProc = document.getElementById('kpi-processed');
  const kpiComp = document.getElementById('kpi-completion-rate');
  const kpiPend = document.getElementById('kpi-pending');
  const kpiPendSub = document.getElementById('kpi-pending-subtext');
  const kpiAvg = document.getElementById('kpi-avg-turnaround');

  if (kpiRec) kpiRec.innerText = totalReceived;
    if (kpiRecSub) {
      kpiRecSub.innerHTML = `
        <span style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
          ${receivedTypePills}
        </span>
      `;
    }

    if (kpiProc) kpiProc.innerText = actionTakenCount;
    if (kpiComp) {
      kpiComp.innerHTML = `
        <span style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
          ${actionStatusPills}
        </span>
      `;
    }

    if (kpiPend) kpiPend.innerText = pendingCount;
    if (kpiPendSub) {
      const officePills = standardOffices.map(off =>
        `<button class="kpi-pill-btn" onclick="filterAndNavigateToRegister({ status: 'Pending', office: '${off}', section: '${selectedSec}' })" style="color: #fbbf24;" title="Click to view pending items for ${off} in ${selectedSec === 'ALL' ? 'all sections' : selectedSec}">${off}: <strong>${pendOfficeCounts[off]}</strong></button>`
      ).join('');
      kpiPendSub.innerHTML = `
        <span style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
          ${officePills}
        </span>
      `;
    }

    // Calculate Avg Turnaround
    let sumDays = 0, countVal = 0;
    activeTapalData.forEach(r => {
      if (r.diffSecToInit && !isNaN(r.diffSecToInit)) {
        sumDays += Number(r.diffSecToInit);
        countVal++;
      }
    });
    const avgDays = countVal > 0 ? (sumDays / countVal).toFixed(1) : (totalReceived === 0 ? '0.0' : '4.2');
    if (kpiAvg) kpiAvg.innerText = `${avgDays} Days`;

    // Render Charts & Matrix Table filtered by selected section
    renderMonthlyChart(activeTapalData, selectedSec);
    renderStatusChart(activeTapalData);
    render12MonthMatrixTable(activeTapalData, selectedSec);
    renderDashboardFollowUpAlerts();
    updateFollowUpBadgeCount();
  } catch (err) {
    console.warn('renderDashboard error:', err);
  }
}

function renderMonthlyChart(activeData, selectedSec) {
  try {
    const canvas = document.getElementById('monthlyChart');
    if (!canvas || typeof Chart === 'undefined') return;

    // If canvas is hidden in an inactive tab, don't attempt Chart.js layout calculations
    const dashPane = document.getElementById('dashboard-pane');
    if (dashPane && !dashPane.classList.contains('active') && canvas.offsetParent === null) {
      return;
    }

    const dataset = activeData || tapalState;

    // Calculate counts for all 12 months (JAN-DEC)
    const receivedData = [];
    const actionData = [];
    const pendingData = [];

    monthNamesList.forEach((m, idx) => {
      const monthItems = dataset.filter(r => getItemMonthIndex(r) === idx);
      const recCount = monthItems.length;
      const pendCount = monthItems.filter(r => r.status === 'Pending').length;
      const actCount = recCount - pendCount;

      receivedData.push(recCount);
      actionData.push(actCount);
      pendingData.push(pendCount);
    });

    if (monthlyChartInst) {
      try {
        monthlyChartInst.destroy();
      } catch (e) {}
      monthlyChartInst = null;
    }

    try {
      monthlyChartInst = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: monthNamesList,
          datasets: [
            { label: 'Total Received', data: receivedData, backgroundColor: '#2563eb', borderRadius: 4 },
            { label: 'Total Action Taken', data: actionData, backgroundColor: '#16a34a', borderRadius: 4 },
            { label: 'Total Pendings', data: pendingData, backgroundColor: '#dc2626', borderRadius: 4 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#f8fafc', font: { weight: 'bold' } } }
          },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { weight: 'bold' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: '#94a3b8', font: { weight: 'bold' } }, grid: { color: 'rgba(255,255,255,0.05)' } }
          }
        }
      });
    } catch (chartErr) {
      console.warn('monthlyChart creation error:', chartErr);
      monthlyChartInst = null;
    }
  } catch (err) {
    console.warn('renderMonthlyChart error:', err);
  }
}

function renderStatusChart(activeData) {
  try {
    const canvas = document.getElementById('statusChart');
    if (!canvas || typeof Chart === 'undefined') return;

    // If canvas is hidden in an inactive tab, don't attempt Chart.js layout calculations
    const dashPane = document.getElementById('dashboard-pane');
    if (dashPane && !dashPane.classList.contains('active') && canvas.offsetParent === null) {
      return;
    }

    const dataset = activeData || tapalState;
    const totalReceived = dataset.length;
    const pendingCount = dataset.filter(r => r.status === 'Pending').length;
    const actionTakenCount = totalReceived - pendingCount;

    if (statusChartInst) {
      try {
        statusChartInst.destroy();
      } catch (e) {}
      statusChartInst = null;
    }

    try {
      statusChartInst = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: [`ACTION TAKEN (${actionTakenCount})`, `PENDING (${pendingCount})`],
          datasets: [{
            data: [actionTakenCount, pendingCount],
            backgroundColor: ['#2563eb', '#dc2626'],
            borderWidth: 2,
            borderColor: '#0f172a'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#f8fafc', font: { weight: 'bold', size: 12 } } }
          }
        }
      });
    } catch (chartErr) {
      console.warn('statusChart creation error:', chartErr);
      statusChartInst = null;
    }
  } catch (err) {
    console.warn('renderStatusChart error:', err);
  }
}

function render12MonthMatrixTable(activeData, selectedSec) {
  const tbody = document.getElementById('matrix-summary-tbody');
  if (!tbody) return;

  const dataset = activeData || tapalState;
  const secParam = (selectedSec && selectedSec !== 'ALL') ? selectedSec : '';

  const receivedRow = [];
  const actionRow = [];
  const pendingRow = [];

  let totRecAll = 0;
  let totActAll = 0;
  let totPendAll = 0;

  let prevMonthPending = 0;

  monthNamesList.forEach((m, idx) => {
    const monthKey = `${m}-2023`;
    const monthItems = dataset.filter(r => getItemMonthIndex(r) === idx);

    const recCount = monthItems.length;
    const pendCount = monthItems.filter(r => r.status === 'Pending').length;
    const actCount = recCount - pendCount;

    // Previous month pending carry-over
    const carryOver = idx > 0 ? prevMonthPending : 0;
    const totalWithCarry = recCount + carryOver;

    receivedRow.push({ 
      monthKey, 
      val: recCount, 
      carryOver: carryOver,
      totalWithCarry: totalWithCarry
    });
    actionRow.push({ monthKey, val: actCount });
    pendingRow.push({ monthKey, val: pendCount });

    totRecAll += recCount;
    totActAll += actCount;
    totPendAll += pendCount;

    // Update prevMonthPending for the next month
    if (recCount > 0 || pendCount > 0) {
      prevMonthPending = pendCount;
    }
  });

  tbody.innerHTML = `
    <tr>
      <td style="text-align: left; font-weight: 800; color: #38bdf8;">Total Received</td>
      ${receivedRow.map(item => {
        const carryHtml = item.carryOver > 0 
          ? `<span style="font-size: 11px; color: #fbbf24; font-weight: 700; margin-left: 2px;" title="Carry over from previous month pending: +${item.carryOver} (Total available: ${item.totalWithCarry})">(+${item.carryOver})</span>` 
          : '';
        const titleText = item.carryOver > 0 
          ? `Fresh Received: ${item.val} | Previous Month Pending Carry-Over: +${item.carryOver} | Total to Process: ${item.totalWithCarry}` 
          : `Click to view received items for ${item.monthKey}`;
        return `<td onclick="filterAndNavigateToRegister({ month: '${item.monthKey}', section: '${secParam}' })" style="font-weight: 700; color: ${item.val > 0 ? '#38bdf8' : '#64748b'}; cursor: pointer; white-space: nowrap;" title="${titleText}">${item.val}${carryHtml}</td>`;
      }).join('')}
      <td onclick="filterAndNavigateToRegister({ section: '${secParam}' })" style="font-weight: 800; color: #38bdf8; background: rgba(56,189,248,0.1); cursor: pointer;" title="Click to view all received items">${totRecAll}</td>
    </tr>
    <tr>
      <td style="text-align: left; font-weight: 800; color: #34d399;">Total Action Taken</td>
      ${actionRow.map(item => `<td onclick="filterAndNavigateToRegister({ month: '${item.monthKey}', section: '${secParam}' })" style="font-weight: 700; color: ${item.val > 0 ? '#34d399' : '#64748b'}; cursor: pointer;" title="Click to view action taken items for ${item.monthKey}">${item.val}</td>`).join('')}
      <td onclick="filterAndNavigateToRegister({ section: '${secParam}' })" style="font-weight: 800; color: #34d399; background: rgba(52,211,153,0.1); cursor: pointer;" title="Click to view all action taken items">${totActAll}</td>
    </tr>
    <tr>
      <td style="text-align: left; font-weight: 800; color: #ef4444;">Total Pendings</td>
      ${pendingRow.map(item => `<td onclick="filterAndNavigateToRegister({ month: '${item.monthKey}', status: 'Pending', section: '${secParam}' })" style="font-weight: 700; color: ${item.val > 0 ? '#ef4444' : '#64748b'}; cursor: pointer;" title="Click to view pending items for ${item.monthKey}">${item.val}</td>`).join('')}
      <td onclick="filterAndNavigateToRegister({ status: 'Pending', section: '${secParam}' })" style="font-weight: 800; color: #ef4444; background: rgba(239,68,68,0.1); cursor: pointer;" title="Click to view all pending items">${totPendAll}</td>
    </tr>
  `;
}

// // -------------------------------------------------------------
// SLA STAGE DAY CALCULATOR HELPER FUNCTIONS
// -------------------------------------------------------------
function parseDateToObj(dateStr) {
  if (!dateStr || dateStr === '-') return null;
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  }
  if (dateStr.includes('-')) return new Date(dateStr);
  return null;
}

function calculateDaysBetween(startStr, endStr) {
  const d1 = parseDateToObj(startStr);
  const d2 = parseDateToObj(endStr);
  if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return '-';
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : '-';
}

function calculateStageDurations(item) {
  const s1 = calculateDaysBetween(item.letterDate, item.sealDate);
  const s2 = calculateDaysBetween(item.sealDate, item.recSecDate);
  const s3 = calculateDaysBetween(item.recSecDate, item.fileInitDate);
  const s4 = calculateDaysBetween(item.fileInitDate, item.fileApprDate);
  return { stage1: s1, stage2: s2, stage3: s3, stage4: s4 };
}

function formatSLABadge(daysVal) {
  if (daysVal === '-') return '<span class="badge" style="background: rgba(255,255,255,0.05); color: #64748b; font-size: 10px;">-</span>';
  const val = parseInt(daysVal);
  if (isNaN(val)) return '<span class="badge" style="background: rgba(255,255,255,0.05); color: #64748b; font-size: 10px;">-</span>';
  if (val <= 2) return `<span class="badge" style="background: rgba(16,185,129,0.15); border: 1px solid #10b981; color: #34d399; font-weight: 700;">${val}d</span>`;
  if (val <= 5) return `<span class="badge" style="background: rgba(245,158,11,0.15); border: 1px solid #f59e0b; color: #fbbf24; font-weight: 700;">${val}d</span>`;
  return `<span class="badge" style="background: rgba(239,68,68,0.15); border: 1px solid #ef4444; color: #f87171; font-weight: 700;">${val}d</span>`;
}

// -------------------------------------------------------------
// EXCEL SHEET TABS & DICTIONARY STATE
// -------------------------------------------------------------
let activeSheetTab = 'ALL';
let dictionaryState = {
  mainOffices: ['SE', 'DE', 'MORTH', 'GOVT', 'CE', 'OTHERS'],
  officers: ['SLM', 'CBE', 'DS', 'CHN', 'TNV', 'GOBI', 'MDU', 'Ganeshkumar', 'QC-TNV'],
  statuses: ['Pending', 'Filed', 'Proceeding', 'Letter', 'Memo']
};

function renderExcelSheetTabs() {
  const container = document.getElementById('excel-sheet-pills');
  const yearSelect = document.getElementById('sheet-year-select');
  if (!container) return;

  const year = yearSelect ? yearSelect.value : '2023';
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  
  let tabsHtml = `<button class="btn-preset ${activeSheetTab === 'ALL' ? 'active' : ''}" onclick="selectSheetTab('ALL')">All Sheets</button>`;

  if (year === 'ALL') {
    ['2023', '2024'].forEach(y => {
      monthNames.slice(0, 3).forEach(m => {
        const tabKey = `${m}-${y}`;
        const count = tapalState.filter(r => r.month === tabKey).length;
        tabsHtml += `<button class="btn-preset ${activeSheetTab === tabKey ? 'active' : ''}" onclick="selectSheetTab('${tabKey}')">Tapal_${tabKey} (${count})</button>`;
      });
    });
  } else {
    monthNames.forEach(m => {
      const tabKey = `${m}-${year}`;
      const count = tapalState.filter(r => r.month === tabKey).length;
      tabsHtml += `<button class="btn-preset ${activeSheetTab === tabKey ? 'active' : ''}" onclick="selectSheetTab('${tabKey}')">Tapal_${tabKey} (${count})</button>`;
    });
  }
  container.innerHTML = tabsHtml;
}

function selectSheetTab(tabKey) {
  activeSheetTab = tabKey;
  renderExcelSheetTabs();
  renderRegisterTable();
}

function renderDictionaryManager() {
  const officeContainer = document.getElementById('dict-office-list');
  const officerContainer = document.getElementById('dict-officer-list');
  const statusContainer = document.getElementById('dict-status-list');

  if (officeContainer) {
    officeContainer.innerHTML = dictionaryState.mainOffices.map(o => 
      `<span class="badge" style="background: rgba(56,189,248,0.15); border: 1px solid #38bdf8; color: #38bdf8; padding: 6px 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">${o} <button onclick="removeDictItem('mainOffices', '${o}')" style="background:none; border:none; color:#f87171; cursor:pointer; font-weight:700;">&times;</button></span>`
    ).join('');
  }
  if (officerContainer) {
    officerContainer.innerHTML = dictionaryState.officers.map(o => 
      `<span class="badge" style="background: rgba(52,211,153,0.15); border: 1px solid #34d399; color: #34d399; padding: 6px 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">${o} <button onclick="removeDictItem('officers', '${o}')" style="background:none; border:none; color:#f87171; cursor:pointer; font-weight:700;">&times;</button></span>`
    ).join('');
  }
  if (statusContainer) {
    statusContainer.innerHTML = dictionaryState.statuses.map(s => 
      `<span class="badge" style="background: rgba(255,121,198,0.15); border: 1px solid #ff79c6; color: #ff79c6; padding: 6px 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">${s} <button onclick="removeDictItem('statuses', '${s}')" style="background:none; border:none; color:#f87171; cursor:pointer; font-weight:700;">&times;</button></span>`
    ).join('');
  }
}

function removeDictItem(category, val) {
  dictionaryState[category] = dictionaryState[category].filter(i => i !== val);
  renderDictionaryManager();
}

function initDictionaryEvents() {
  const addOfficeBtn = document.getElementById('btn-add-office');
  const addOfficerBtn = document.getElementById('btn-add-officer');
  const addStatusBtn = document.getElementById('btn-add-status');

  if (addOfficeBtn) {
    addOfficeBtn.onclick = () => {
      const input = document.getElementById('dict-new-office');
      if (input && input.value.trim()) {
        dictionaryState.mainOffices.push(input.value.trim().toUpperCase());
        input.value = '';
        renderDictionaryManager();
      }
    };
  }
  if (addOfficerBtn) {
    addOfficerBtn.onclick = () => {
      const input = document.getElementById('dict-new-officer');
      if (input && input.value.trim()) {
        dictionaryState.officers.push(input.value.trim().toUpperCase());
        input.value = '';
        renderDictionaryManager();
      }
    };
  }
  if (addStatusBtn) {
    addStatusBtn.onclick = () => {
      const input = document.getElementById('dict-new-status');
      if (input && input.value.trim()) {
        dictionaryState.statuses.push(input.value.trim());
        input.value = '';
        renderDictionaryManager();
      }
    };
  }
}

// -------------------------------------------------------------
// NATIVE EXCEL IMPORT & EXPORT ENGINE (xlsx.full.min.js)
// -------------------------------------------------------------
function exportToMultiSheetExcel() {
  if (typeof XLSX === 'undefined') return alert('XLSX library is loading, please try again in a moment.');

  const wb = XLSX.utils.book_new();

  // 1. MONITORING DASH BOARD Sheet
  const dashData = [
    ['TAPAL CHASE - MONITORING DASHBOARD (ANNUAL SUMMARY)'],
    ['Month Sheet', 'Total Received', 'Action Taken (Processed)', 'Total Pendings'],
    ['Tapal_JAN-2023', tapalState.filter(r=>r.month==='JAN-2023').length, tapalState.filter(r=>r.month==='JAN-2023'&&r.status!=='Pending').length, tapalState.filter(r=>r.month==='JAN-2023'&&r.status==='Pending').length],
    ['Tapal_FEB-2023', tapalState.filter(r=>r.month==='FEB-2023'||!r.month).length, tapalState.filter(r=>(r.month==='FEB-2023'||!r.month)&&r.status!=='Pending').length, tapalState.filter(r=>(r.month==='FEB-2023'||!r.month)&&r.status==='Pending').length],
    ['Tapal_MAR-2023', tapalState.filter(r=>r.month==='MAR-2023').length, tapalState.filter(r=>r.month==='MAR-2023'&&r.status!=='Pending').length, tapalState.filter(r=>r.month==='MAR-2023'&&r.status==='Pending').length],
    ['TOTAL MASTER RECORDS', tapalState.length, tapalState.filter(r=>r.status!=='Pending').length, tapalState.filter(r=>r.status==='Pending').length]
  ];
  const dashWs = XLSX.utils.aoa_to_sheet(dashData);
  XLSX.utils.book_append_sheet(wb, dashWs, 'MONITORING DASH BOARD');

  // 2. ENTRY for Pull down menus Sheet
  const maxLen = Math.max(dictionaryState.mainOffices.length, dictionaryState.officers.length, dictionaryState.statuses.length);
  const dictRows = [['Main Offices', 'Officer Designations', 'Statuses']];
  for (let i = 0; i < maxLen; i++) {
    dictRows.push([
      dictionaryState.mainOffices[i] || '',
      dictionaryState.officers[i] || '',
      dictionaryState.statuses[i] || ''
    ]);
  }
  const dictWs = XLSX.utils.aoa_to_sheet(dictRows);
  XLSX.utils.book_append_sheet(wb, dictWs, 'ENTRY for Pull down menus');

  // 3. Individual Monthly Sheets (Tapal_FEB-2023, Tapal_JAN-2023, etc.)
  const sheetKeys = ['FEB-2023', 'JAN-2023', 'MAR-2023'];
  sheetKeys.forEach(mKey => {
    const monthItems = tapalState.filter(r => r.month === mKey || (!r.month && mKey === 'FEB-2023'));
    const rows = [
      ['  S.No.', 'Tapal / mail', 'Current number', 'Office seal Date', 'Received in section- Date', 'Subject', 'Letter ref.', 'Dated', 'SUBJECT IN BRIEF', 'Main office', 'Officer Designation', 'Status', 'Action initiated ', 'File No. Ref', 'File Initiated Date', 'File Approval Date', 'Stage 1 (Letter->Seal)', 'Stage 2 (Seal->Sec)', 'Stage 3 (Sec->Init)', 'Stage 4 (Init->Appr)']
    ];
    monthItems.forEach(r => {
      const { stage1, stage2, stage3, stage4 } = calculateStageDurations(r);
      rows.push([
        r.sNo, r.tapalType || 'Tapal', r.currNo || '', r.sealDate ? formatISOToDDMMYYYY(r.sealDate) : '', r.recSecDate ? formatISOToDDMMYYYY(r.recSecDate) : '', r.subject || '', r.letterRef || '', r.letterDate ? formatISOToDDMMYYYY(r.letterDate) : '', r.shortSub || '', r.mainOffice || '', r.officerDesig || '', r.status || 'Pending', r.actionInitiated || '', r.fileNoRef || '', r.fileInitDate ? formatISOToDDMMYYYY(r.fileInitDate) : '', r.fileApprDate ? formatISOToDDMMYYYY(r.fileApprDate) : '', stage1, stage2, stage3, stage4
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, `Tapal_${mKey}`);
  });

  XLSX.writeFile(wb, `TAPAL_CHASE_MASTER_EXPORT_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function importFromExcelWorkbook(e) {
  const file = e.target.files[0];
  if (!file || typeof XLSX === 'undefined') return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      let importedItems = [];
      let idCounter = Date.now();

      workbook.SheetNames.forEach(sheetName => {
        if (sheetName.startsWith('Tapal_') || sheetName.includes('JAN') || sheetName.includes('FEB') || sheetName.includes('MAR')) {
          const ws = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
          
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(10, json.length); i++) {
            if (json[i] && json[i].some(cell => String(cell).includes('S.No') || String(cell).includes('Tapal'))) {
              headerRowIndex = i;
              break;
            }
          }
          if (headerRowIndex !== -1) {
            for (let i = headerRowIndex + 1; i < json.length; i++) {
              const row = json[i];
              if (row && (row[0] || row[1] || row[2])) {
                importedItems.push({
                  id: idCounter++,
                  sNo: row[0] || (importedItems.length + 1),
                  tapalType: row[1] || 'Tapal',
                  currNo: row[2] || '',
                  sealDate: row[3] || '',
                  recSecDate: row[4] || '',
                  subject: row[5] || '',
                  letterRef: row[6] || '',
                  letterDate: row[7] || '',
                  shortSub: row[8] || '',
                  mainOffice: row[9] || 'SE',
                  officerDesig: row[10] || 'SLM',
                  status: row[11] || 'Pending',
                  actionInitiated: row[12] || '',
                  fileNoRef: row[13] || '',
                  fileInitDate: row[14] || '',
                  fileApprDate: row[15] || '',
                  month: sheetName.replace('Tapal_', '') || 'FEB-2023'
                });
              }
            }
          }
        }
      });

      if (importedItems.length > 0) {
        tapalState = [...importedItems, ...tapalState];
        renderRegisterTable();
        renderDashboard();
        renderExcelSheetTabs();
        alert(`Successfully imported ${importedItems.length} correspondence records from ${file.name}!`);
      } else {
        alert('Parsed workbook, but could not locate Tapal table rows. Please check sheet formatting.');
      }
    } catch (err) {
      alert('Error parsing Excel file: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function populateLetterRefDropdown() {
  const thLetterRefEl = document.getElementById('th-filter-letter-ref');
  if (!thLetterRefEl) return;

  const currentVal = thLetterRefEl.value || 'ALL';
  const suffixesSet = new Set();

  tapalState.forEach(item => {
    if (item.letterRef) {
      const str = String(item.letterRef).trim();
      if (str.includes('/')) {
        const parts = str.split('/');
        const lastPart = parts[parts.length - 1].trim();
        if (lastPart) {
          suffixesSet.add(lastPart);
        }
      }
    }
  });

  const sortedSuffixes = Array.from(suffixesSet).sort((a, b) => 
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  let optionsHtml = '<option value="ALL">Letter ref. ▾</option>';
  sortedSuffixes.forEach(suf => {
    optionsHtml += `<option value="${suf}">${suf}</option>`;
  });

  if (thLetterRefEl.innerHTML !== optionsHtml) {
    thLetterRefEl.innerHTML = optionsHtml;
    if (sortedSuffixes.includes(currentVal)) {
      thLetterRefEl.value = currentVal;
    } else {
      thLetterRefEl.value = 'ALL';
    }
  }
}

const monthNamesFullList = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function getYearMonthFromKey(key) {
  if (!key || !key.includes('-')) return '';
  const parts = key.split('-');
  const monthName = parts[0].toUpperCase();
  const year = parts[1];
  const idx = monthNamesFullList.indexOf(monthName);
  if (idx !== -1 && year) {
    const monthNum = String(idx + 1).padStart(2, '0');
    return `${year}-${monthNum}`;
  }
  return '';
}

function getManuallyEnteredYear() {
  const dateInputs = [
    'reg-single-date-text', 'reg-range-start-text', 'reg-range-end-text',
    'cal-filter-start-text', 'cal-filter-end-text', 'page-manual-date-text',
    'page-range-start-text', 'page-range-end-text'
  ];

  for (const id of dateInputs) {
    const el = document.getElementById(id);
    if (el && el.value) {
      const parts = el.value.trim().split(/[\/\-\.]/);
      if (parts.length === 3 && parts[2].length === 4 && /^\d{4}$/.test(parts[2])) {
        return parts[2];
      }
    }
  }
  return null;
}

function populateQuickMonthDropdown(explicitYear) {
  const selectEl = document.getElementById('quick-month-select');
  if (!selectEl) return;

  const currentVal = selectEl.value || (typeof activeDateFilter === 'string' ? activeDateFilter : 'ALL');
  const totalCount = tapalState.length;

  const manualYear = explicitYear || getManuallyEnteredYear();

  let targetYears = [];
  if (manualYear) {
    // Show ONLY months for the manually entered year
    targetYears = [String(manualYear)];
  } else {
    // Default: show ONLY years present in active dataset
    const activeYearsSet = new Set();
    tapalState.forEach(item => {
      if (item.month && item.month.includes('-')) {
        const y = item.month.split('-')[1];
        if (y && /^\d{4}$/.test(y)) activeYearsSet.add(y);
      }
      if (item.recSecDate && item.recSecDate.includes('-')) {
        const y = item.recSecDate.split('-')[0];
        if (y && /^\d{4}$/.test(y)) activeYearsSet.add(y);
      }
      if (item.letterDate && item.letterDate.includes('-')) {
        const y = item.letterDate.split('-')[0];
        if (y && /^\d{4}$/.test(y)) activeYearsSet.add(y);
      }
    });
    targetYears = Array.from(activeYearsSet);
    if (targetYears.length === 0) targetYears = ['2023'];
    targetYears.sort((a, b) => b - a);
  }

  let optionsHtml = `<option value="ALL">ALL DATES (${totalCount} records)</option>`;

  targetYears.forEach(year => {
    optionsHtml += `<optgroup label="Months for Year ${year}">`;
    monthNamesFullList.forEach(m => {
      const mKey = `${m}-${year}`;
      const ymPrefix = `${year}-${String(monthNamesFullList.indexOf(m) + 1).padStart(2, '0')}`;

      const count = tapalState.filter(item => {
        if (item.month === mKey) return true;
        if (item.recSecDate && item.recSecDate.startsWith(ymPrefix)) return true;
        if (item.letterDate && item.letterDate.startsWith(ymPrefix)) return true;
        return false;
      }).length;

      optionsHtml += `<option value="${mKey}">${m} ${year} (${count} ${count === 1 ? 'record' : 'records'})</option>`;
    });
    optionsHtml += `</optgroup>`;
  });

  if (selectEl.innerHTML !== optionsHtml) {
    selectEl.innerHTML = optionsHtml;
    if (currentVal && selectEl.querySelector(`option[value="${currentVal}"]`)) {
      selectEl.value = currentVal;
    } else {
      selectEl.value = 'ALL';
    }
  }
}

// =============================================================================
// DYNAMIC DROPDOWN & CUSTOM OPTIONS MANAGEMENT (ADD, EDIT, DELETE)
// =============================================================================

const DEFAULT_SECTIONS_MASTER = [
  { code: 'ACCT', name: 'Accounts' },
  { code: 'DB', name: 'Drawing Branch' },
  { code: 'ESTT', name: 'Establishment' },
  { code: 'R&B', name: 'Roads & Bridges' },
  { code: 'PLG', name: 'Planning' },
  { code: 'CRIF', name: 'Budget & CRIF' },
  { code: 'CONT', name: 'Contract' },
  { code: 'CMGT', name: 'Contract Management' },
  { code: 'RSQC', name: 'Road Safety & QC' }
];

const DEFAULT_EMPLOYEE_DESIGNATIONS = {
  'ACCT': ['CAO', 'AO 1', 'AO 2', 'Suptd 1', 'Suptd 2', 'Asst 1', 'Asst 2', 'Asst 3'],
  'DB': ['HDO', 'SDO I', 'SDO II', 'JDO 1', 'JDO 2', 'JDO 3', 'JDO 4', 'JDO 5', 'JDO 6'],
  'ESTT': ['AO', 'Suptd (Establishment)', 'Asst (Estt) 1', 'Asst (Estt) 2', 'Jr. Asst (Estt)'],
  'R&B': ['AE-RB1', 'AE-RB2'],
  'PLG': ['AE-PLG1', 'AE-PLG2'],
  'CRIF': ['AE-CRIF', 'AE-BUD'],
  'CONT': ['AE-OPP1', 'AE-OPP2'],
  'CMGT': ['AE-CM1', 'AE-CM2'],
  'RSQC': ['AE-RS', 'AE-QC']
};

const DEFAULT_MAIN_OFFICES = ['GOVT', 'SE', 'MORTH', 'DE', 'CE', 'AG', 'NHAI', 'Others'];

const DEFAULT_OFFICER_DESIGNATIONS = ['AG', 'IR', 'PS', 'DP', 'CAG Report', 'ATR', 'Others'];

const OFFICER_DESIGNATIONS_RAW = {
  'GOVT': ['ACS', 'Pr. Secy', 'Secy', 'JS', 'DS', 'US', 'HV1', 'HV2', 'HN', 'HK', 'HM', 'HR', 'HQ', 'STF', 'FIN-Infra', 'FIN-BG', 'DS(CB)'],
  'MORTH': ['Secy', 'DGRD & SS', 'ADG', 'CE-South Zone', 'CE-HQ', 'SE-HQ', 'CE-RO-CNI', 'RO-CNI'],
  'SE': ['CNI-NH', 'SLM-NH', 'MDU-NH', 'C&M'],
  'DE': ['CNI-NH', 'VLR-NH', 'VPM-NH', 'SLM-NH', 'GOB-NH', 'MDU-NH', 'TRY-NH', 'TNV-NH', 'CNI-QC', 'SLM-QC', 'MDU-QC', 'C&M'],
  'CE': ['CE-NH', 'RCE-CNI', 'RCE-TRY', 'RCE-CBE', 'RCE-MDU', 'CE-PDI', 'CE-TNRSP', 'CE-CKICP', 'DRS-HRS', 'DG-HD'],
  'AG': ['PEN', 'GPF', 'FS'],
  'NHAI': ['RO-CNI', 'RO-MDU', 'PD-PIU', 'PD-TNRSP', 'PD-CKICP', 'TANSHA', 'TNRDC', 'JD-Training'],
  'Others': ['AG', 'IR', 'PS', 'DP', 'CAG Report', 'ATR', 'Others']
};

const DEFAULT_SUBJECT_IN_BRIEF = ['Audit Para', 'Others'];

const SUBJECT_IN_BRIEF_RAW = {
  'R&B': ['Estimate', 'COS', 'Toll Notification', 'Shifting of Utilities-AP', 'RCE-COS'],
  'CMGT': ['EOT', 'Bonus/Dispute', 'Court Case', 'Arbitration/CCIE', 'Pleader Fees', 'Ratification/LA'],
  'CONT': ['Tender', 'COT', 'Re-validation', 'RCE-Escalation'],
  'RSQC': ['Road Safety', 'QC', 'Blackspot', 'Hotspot'],
  'CRIF': ['RAS', 'AS Proposal', 'CRIF', 'Utility-CRIF', 'Setu Bandhan', 'Proposal', 'Inspection Report', 'Class III', 'Class II', 'BE/Training', 'RE', 'FMA', 'Reconciliation'],
  'PLG': ['Meeting', 'MOM', 'Status Report', 'Circular'],
  'ACCT': ['Leave Application', 'Audit Para/IR', 'UC', 'Expr/BN', 'Compilation', 'Reconciliation', 'Leave (Establishment)'],
  'DB': ['Petition', 'RTI', 'RSQ', 'LSQ', 'Cut Motion', 'LR', 'Assurance', 'Call Attn', 'CPGRAMS', 'Media', 'Rent', 'SDR'],
  'ESTT': ['Leave Application', 'Application-Surrender', 'App. Permission', 'App. GPF', 'App-Transfer', 'TA Bill', 'Sel./Spl. Gr.', 'PDL', 'FS', 'Transfer Order', 'Cir.', 'CCA', 'ER', 'Reports', 'App-Loans & Adv.']
};

const DEFAULT_STATUSES = ['Pending', 'Memo', 'Letter', 'Proceedings', 'DO Letter', 'Office Order', 'Others', 'Filed'];

const DEFAULT_TAPAL_TYPES = ['Tapal', 'Email', 'DO-Letter', 'Confidential'];

let customDropdownOptions = {
  sections: JSON.parse(localStorage.getItem('custom_sections') || '[]'),
  empDesigMapping: JSON.parse(localStorage.getItem('custom_emp_desig_mapping') || '{}'),
  mainOffice: JSON.parse(localStorage.getItem('custom_main_offices') || '[]'),
  officerDesig: JSON.parse(localStorage.getItem('custom_officer_desig') || '{}'),
  shortSub: JSON.parse(localStorage.getItem('custom_short_sub') || '{}'),
  letterRef: JSON.parse(localStorage.getItem('custom_letter_ref') || '[]'),
  tapalType: JSON.parse(localStorage.getItem('custom_tapal_type') || '[]'),
  status: JSON.parse(localStorage.getItem('custom_status') || '[]')
};
window.customDropdownOptions = customDropdownOptions;

function saveCustomDropdownOptions() {
  localStorage.setItem('custom_sections', JSON.stringify(customDropdownOptions.sections || []));
  localStorage.setItem('custom_emp_desig_mapping', JSON.stringify(customDropdownOptions.empDesigMapping || {}));
  localStorage.setItem('custom_main_offices', JSON.stringify(customDropdownOptions.mainOffice || []));
  localStorage.setItem('custom_officer_desig', JSON.stringify(customDropdownOptions.officerDesig || {}));
  localStorage.setItem('custom_short_sub', JSON.stringify(customDropdownOptions.shortSub || {}));
  localStorage.setItem('custom_letter_ref', JSON.stringify(customDropdownOptions.letterRef || []));
  localStorage.setItem('custom_tapal_type', JSON.stringify(customDropdownOptions.tapalType || []));
  localStorage.setItem('custom_status', JSON.stringify(customDropdownOptions.status || []));
}

function getAllSections() {
  const map = new Map();
  DEFAULT_SECTIONS_MASTER.forEach(s => {
    map.set(s.code.toUpperCase(), { code: s.code.toUpperCase(), name: s.name });
  });

  if (Array.isArray(customDropdownOptions.sections)) {
    customDropdownOptions.sections.forEach(s => {
      if (typeof s === 'string') {
        const parts = s.split('(');
        const code = parts[0].trim().toUpperCase();
        const name = parts[1] ? parts[1].replace(')', '').trim() : code;
        map.set(code, { code, name });
      } else if (s && s.code) {
        map.set(s.code.toUpperCase(), { code: s.code.toUpperCase(), name: s.name || s.code });
      }
    });
  }

  return Array.from(map.values()).map(s => ({
    code: s.code,
    name: s.name,
    display: `${s.code} (${s.name})`
  }));
}
window.getAllSections = getAllSections;

function getCanonicalSectionCode(sec) {
  if (!sec) return '';
  const str = String(sec).trim();
  const all = getAllSections();
  const match = all.find(s => s.code.toLowerCase() === str.toLowerCase() || s.name.toLowerCase() === str.toLowerCase() || s.display.toLowerCase() === str.toLowerCase());
  return match ? match.code : str;
}
window.getCanonicalSectionCode = getCanonicalSectionCode;

function getSectionFullName(sec) {
  if (!sec) return '';
  const str = String(sec).trim();
  const all = getAllSections();
  const match = all.find(s => s.code.toLowerCase() === str.toLowerCase() || s.name.toLowerCase() === str.toLowerCase());
  return match ? match.name : str;
}
window.getSectionFullName = getSectionFullName;

function getEmployeeDesignations(sectionCode) {
  const code = getCanonicalSectionCode(sectionCode) || 'ACCT';
  const defaultList = (DEFAULT_EMPLOYEE_DESIGNATIONS[code])
    ? [...DEFAULT_EMPLOYEE_DESIGNATIONS[code]]
    : ((window.DROPDOWN_DATA && window.DROPDOWN_DATA.EMPLOYEE_DESIGNATIONS && window.DROPDOWN_DATA.EMPLOYEE_DESIGNATIONS[code]) ? [...window.DROPDOWN_DATA.EMPLOYEE_DESIGNATIONS[code]] : ['CAO', 'AO 1', 'AO 2']);
  
  const merged = [...defaultList];
  if (customDropdownOptions.empDesigMapping) {
    if (Array.isArray(customDropdownOptions.empDesigMapping[code])) {
      customDropdownOptions.empDesigMapping[code].forEach(d => {
        if (d && !merged.includes(d)) merged.push(d);
      });
    }
    if (Array.isArray(customDropdownOptions.empDesigMapping['ALL'])) {
      customDropdownOptions.empDesigMapping['ALL'].forEach(d => {
        if (d && !merged.includes(d)) merged.push(d);
      });
    }
  }
  return Array.from(new Set(merged));
}
window.getEmployeeDesignations = getEmployeeDesignations;

function getOfficerDesignations(mainOffice) {
  const officeKey = mainOffice || 'SE';
  const rawList = (OFFICER_DESIGNATIONS_RAW[officeKey])
    ? [...OFFICER_DESIGNATIONS_RAW[officeKey]]
    : ((window.DROPDOWN_DATA && window.DROPDOWN_DATA.OFFICER_DESIGNATIONS_RAW && window.DROPDOWN_DATA.OFFICER_DESIGNATIONS_RAW[officeKey]) ? [...window.DROPDOWN_DATA.OFFICER_DESIGNATIONS_RAW[officeKey]] : []);
  const defaultList = [...DEFAULT_OFFICER_DESIGNATIONS];
  const merged = Array.from(new Set([...rawList, ...defaultList]));

  if (customDropdownOptions.officerDesig) {
    if (Array.isArray(customDropdownOptions.officerDesig)) {
      customDropdownOptions.officerDesig.forEach(o => {
        if (o && !merged.includes(o)) merged.push(o);
      });
    } else if (typeof customDropdownOptions.officerDesig === 'object') {
      if (Array.isArray(customDropdownOptions.officerDesig[officeKey])) {
        customDropdownOptions.officerDesig[officeKey].forEach(o => {
          if (o && !merged.includes(o)) merged.push(o);
        });
      }
      if (Array.isArray(customDropdownOptions.officerDesig['ALL'])) {
        customDropdownOptions.officerDesig['ALL'].forEach(o => {
          if (o && !merged.includes(o)) merged.push(o);
        });
      }
    }
  }
  return Array.from(new Set(merged));
}
window.getOfficerDesignations = getOfficerDesignations;

function getSubjectInBrief(sectionCode) {
  const code = getCanonicalSectionCode(sectionCode) || 'ACCT';
  const rawList = (SUBJECT_IN_BRIEF_RAW[code])
    ? [...SUBJECT_IN_BRIEF_RAW[code]]
    : ((window.DROPDOWN_DATA && window.DROPDOWN_DATA.SUBJECT_IN_BRIEF_RAW && window.DROPDOWN_DATA.SUBJECT_IN_BRIEF_RAW[code]) ? [...window.DROPDOWN_DATA.SUBJECT_IN_BRIEF_RAW[code]] : []);
  const defaultList = [...DEFAULT_SUBJECT_IN_BRIEF];
  const merged = Array.from(new Set([...rawList, ...defaultList]));

  if (customDropdownOptions.shortSub) {
    if (Array.isArray(customDropdownOptions.shortSub)) {
      customDropdownOptions.shortSub.forEach(s => {
        if (s && !merged.includes(s)) merged.push(s);
      });
    } else if (typeof customDropdownOptions.shortSub === 'object') {
      if (Array.isArray(customDropdownOptions.shortSub[code])) {
        customDropdownOptions.shortSub[code].forEach(s => {
          if (s && !merged.includes(s)) merged.push(s);
        });
      }
      if (Array.isArray(customDropdownOptions.shortSub['ALL'])) {
        customDropdownOptions.shortSub['ALL'].forEach(s => {
          if (s && !merged.includes(s)) merged.push(s);
        });
      }
    }
  }
  return Array.from(new Set(merged));
}
window.getSubjectInBrief = getSubjectInBrief;

function getMainOffices() {
  const customList = Array.isArray(customDropdownOptions.mainOffice) ? customDropdownOptions.mainOffice : [];
  return Array.from(new Set([...DEFAULT_MAIN_OFFICES, ...customList]));
}
window.getMainOffices = getMainOffices;

function getStatuses() {
  const customList = Array.isArray(customDropdownOptions.status) ? customDropdownOptions.status : [];
  return Array.from(new Set([...DEFAULT_STATUSES, ...customList]));
}
window.getStatuses = getStatuses;

function getTapalTypes() {
  const customList = Array.isArray(customDropdownOptions.tapalType) ? customDropdownOptions.tapalType : [];
  return Array.from(new Set([...DEFAULT_TAPAL_TYPES, ...customList]));
}
window.getTapalTypes = getTapalTypes;

function getCategoryKeyFromId(id) {
  if (!id) return 'general';
  if (id.includes('emp-desig')) return 'empDesig';
  if (id.includes('officer')) return 'officerDesig';
  if (id.includes('office') || id.includes('whom')) return 'mainOffice';
  if (id.includes('section') || id.includes('sec-ref')) return 'section';
  if (id.includes('short-sub')) return 'shortSub';
  if (id.includes('letter-ref')) return 'letterRef';
  if (id.includes('type') || id.includes('tapal-type')) return 'tapalType';
  if (id.includes('status')) return 'status';
  return 'general';
}

function populateAllSectionDropdowns() {
  const allSections = getAllSections();
  const dropdownConfigs = [
    { id: 'form-tech-sec-ref', placeholder: '-- Select Section --', isFilter: false },
    { id: 'edit-tech-sec-ref', placeholder: '-- Select Section --', isFilter: false },
    { id: 'th-filter-section', placeholder: 'SECTION ▾ (All Sections)', isFilter: true },
    { id: 'dashboard-section-filter', placeholder: 'SECTION ▾ (All Sections)', isFilter: true },
    { id: 'custom-modal-assign-section', placeholder: 'All Sections', isFilter: true, allowAll: true },
    { id: 'manage-modal-section-select', placeholder: 'All Sections', isFilter: true, allowAll: true },
    { id: 'edit-modal-assign-section', placeholder: '-- Select Section --', isFilter: false }
  ];

  dropdownConfigs.forEach(cfg => {
    const el = document.getElementById(cfg.id);
    if (!el) return;
    const currentVal = el.value;

    let html = '';
    if (cfg.allowAll || (cfg.isFilter && cfg.id.includes('filter'))) {
      html += `<option value="ALL">${cfg.placeholder}</option>`;
    } else {
      html += `<option value="">${cfg.placeholder}</option>`;
    }

    allSections.forEach(s => {
      html += `<option value="${s.code}">${s.display}</option>`;
    });

    if (!cfg.id.includes('modal')) {
      html += `<option value="__ADD_NEW__" style="color: #38bdf8; font-weight: bold;">➕ Add Custom Option...</option>`;
      html += `<option value="__MANAGE_OPTIONS__" style="color: #f87171; font-weight: bold;">🗑️ Manage / Delete Options...</option>`;
    }

    el.innerHTML = html;
    if (currentVal && (allSections.some(s => s.code === currentVal) || currentVal === 'ALL' || currentVal === '')) {
      el.value = currentVal;
    } else if (cfg.isFilter) {
      el.value = 'ALL';
    }
  });
}
window.populateAllSectionDropdowns = populateAllSectionDropdowns;

function populateManageFilterDropdowns() {
  const targetSelect = document.getElementById('manage-modal-target-field');
  const cat = targetSelect ? targetSelect.value : 'section';
  const sectionGroup = document.getElementById('manage-modal-section-group');
  const officeGroup = document.getElementById('manage-modal-office-group');
  const sectionSelectEl = document.getElementById('manage-modal-section-select');
  const officeSelectEl = document.getElementById('manage-modal-office-select');

  if (sectionGroup) sectionGroup.style.display = (cat === 'empDesig' || cat === 'shortSub') ? 'block' : 'none';
  if (officeGroup) officeGroup.style.display = (cat === 'officerDesig') ? 'block' : 'none';

  if (sectionSelectEl) {
    const prevSec = sectionSelectEl.value || 'ALL';
    const allSections = getAllSections();
    let secHtml = '<option value="ALL">All Sections</option>';
    allSections.forEach(s => {
      secHtml += `<option value="${s.code}">${s.display}</option>`;
    });
    sectionSelectEl.innerHTML = secHtml;
    if (prevSec && (allSections.some(s => s.code === prevSec) || prevSec === 'ALL')) {
      sectionSelectEl.value = prevSec;
    } else {
      sectionSelectEl.value = 'ALL';
    }
  }

  if (officeSelectEl) {
    const prevOff = officeSelectEl.value || 'ALL';
    const offices = getMainOffices();
    let offHtml = '<option value="ALL">All Main Offices</option>';
    offices.forEach(o => {
      offHtml += `<option value="${o}">${o}</option>`;
    });
    officeSelectEl.innerHTML = offHtml;
    if (prevOff && (offices.includes(prevOff) || prevOff === 'ALL')) {
      officeSelectEl.value = prevOff;
    } else {
      officeSelectEl.value = 'ALL';
    }
  }
}
window.populateManageFilterDropdowns = populateManageFilterDropdowns;

function onManageCategoryChange() {
  populateManageFilterDropdowns();
  renderManageOptionsList();
}
window.onManageCategoryChange = onManageCategoryChange;

function populateTapalTypeDropdowns() {
  const defaultTypes = ['Tapal', 'Email', 'DO-Letter', 'Confidential'];
  const customTypes = customDropdownOptions.tapalType || [];
  const allTypes = Array.from(new Set([...defaultTypes, ...customTypes]));

  const selects = [
    { id: 'th-filter-type', isFilter: true },
    { id: 'form-tapal-type', isFilter: false },
    { id: 'edit-tapal-type', isFilter: false }
  ];

  selects.forEach(({ id, isFilter }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const currentVal = el.value || (isFilter ? 'ALL' : 'Tapal');

    let html = '';
    if (isFilter) {
      html += `<option value="ALL">Tapal / mail ▾</option>`;
    }
    allTypes.forEach(t => {
      html += `<option value="${t}">${t}</option>`;
    });
    html += `<option value="__ADD_NEW__" style="color: #38bdf8; font-weight: bold;">➕ Add Custom Option...</option>`;
    html += `<option value="__MANAGE_OPTIONS__" style="color: #f87171; font-weight: bold;">🗑️ Manage / Delete Options...</option>`;

    el.innerHTML = html;
    if (allTypes.includes(currentVal) || (isFilter && currentVal === 'ALL')) {
      el.value = currentVal;
    } else {
      el.value = isFilter ? 'ALL' : allTypes[0];
    }
  });
}
window.populateTapalTypeDropdowns = populateTapalTypeDropdowns;

let activeTriggeringSelectEl = null;

function handleCustomAddOn(selectEl) {
  if (!selectEl) return false;

  if (selectEl.value === '__MANAGE_OPTIONS__') {
    activeTriggeringSelectEl = selectEl;
    const catKey = getCategoryKeyFromId(selectEl.id);
    openManageOptionsModal(catKey);
    return true;
  }

  if (selectEl.value === '__ADD_NEW__') {
    activeTriggeringSelectEl = selectEl;
    const catKey = getCategoryKeyFromId(selectEl.id);
    openAddCustomOptionModal(catKey);
    return true;
  }

  selectEl.dataset.lastVal = selectEl.value;
  return false;
}

function openAddCustomOptionModal(catKey) {
  const modal = document.getElementById('modal-add-custom-option');
  const targetFieldSelect = document.getElementById('custom-modal-target-field');
  const sectionGroup = document.getElementById('custom-modal-section-group');
  const officeGroup = document.getElementById('custom-modal-office-group');
  const sectionFields = document.getElementById('custom-modal-add-section-fields');
  const generalNameGroup = document.getElementById('custom-modal-general-name-group');
  const optionNameInput = document.getElementById('custom-modal-option-name');
  const assignSecEl = document.getElementById('custom-modal-assign-section');
  const assignOfficeEl = document.getElementById('custom-modal-assign-office');

  populateAllSectionDropdowns();

  const chosenCat = catKey || (targetFieldSelect ? targetFieldSelect.value : 'section');
  if (targetFieldSelect) targetFieldSelect.value = chosenCat;
  if (optionNameInput) optionNameInput.value = '';

  const isSec = (chosenCat === 'section');
  const isEmp = (chosenCat === 'empDesig');
  const isOff = (chosenCat === 'officerDesig');
  const isSub = (chosenCat === 'shortSub');

  if (sectionFields) sectionFields.style.display = isSec ? 'block' : 'none';
  if (generalNameGroup) generalNameGroup.style.display = isSec ? 'none' : 'block';
  if (sectionGroup) sectionGroup.style.display = (isEmp || isSub) ? 'block' : 'none';
  if (officeGroup) officeGroup.style.display = isOff ? 'block' : 'none';

  if (assignSecEl && (isEmp || isSub)) {
    const manageSec = (document.getElementById('manage-modal-section-select') ? document.getElementById('manage-modal-section-select').value : '') || '';
    const activeSec = (manageSec && manageSec !== 'ALL') ? manageSec :
                     ((document.getElementById('form-tech-sec-ref') ? document.getElementById('form-tech-sec-ref').value : '') ||
                     (document.getElementById('th-filter-section') ? document.getElementById('th-filter-section').value : 'ALL'));
    if (activeSec && activeSec !== 'ALL') {
      assignSecEl.value = activeSec;
    } else {
      assignSecEl.value = assignSecEl.options[1] ? assignSecEl.options[1].value : 'ALL';
    }
  }

  if (assignOfficeEl && isOff) {
    const offices = getMainOffices();
    let html = '<option value="ALL">All Main Offices</option>';
    offices.forEach(o => html += `<option value="${o}">${o}</option>`);
    assignOfficeEl.innerHTML = html;
    const manageOff = (document.getElementById('manage-modal-office-select') ? document.getElementById('manage-modal-office-select').value : '') || '';
    if (manageOff && manageOff !== 'ALL') {
      assignOfficeEl.value = manageOff;
    }
  }

  if (modal) {
    modal.classList.add('active');
    setTimeout(() => {
      if (isSec) {
        const secCodeInp = document.getElementById('custom-modal-section-code');
        if (secCodeInp) secCodeInp.focus();
      } else if (optionNameInput) {
        optionNameInput.focus();
      }
    }, 100);
  }
}
window.openAddCustomOptionModal = openAddCustomOptionModal;

function openAddCustomOptionModalFromManage() {
  const manageTargetSelect = document.getElementById('manage-modal-target-field');
  const cat = manageTargetSelect ? manageTargetSelect.value : 'section';
  openAddCustomOptionModal(cat);
}
window.openAddCustomOptionModalFromManage = openAddCustomOptionModalFromManage;

function closeCustomModal() {
  const modal = document.getElementById('modal-add-custom-option');
  if (modal) modal.classList.remove('active');
  if (activeTriggeringSelectEl) {
    activeTriggeringSelectEl.value = activeTriggeringSelectEl.dataset.lastVal || (activeTriggeringSelectEl.options[0] ? activeTriggeringSelectEl.options[0].value : 'ALL');
    activeTriggeringSelectEl = null;
  }
}

function openManageOptionsModal(catKey) {
  const modal = document.getElementById('modal-manage-custom-options');
  const targetSelect = document.getElementById('manage-modal-target-field');

  populateAllSectionDropdowns();

  if (targetSelect && catKey) targetSelect.value = catKey;

  populateManageFilterDropdowns();
  renderManageOptionsList();
  if (modal) modal.classList.add('active');
}
window.openManageOptionsModal = openManageOptionsModal;

function closeManageModal() {
  const modal = document.getElementById('modal-manage-custom-options');
  if (modal) modal.classList.remove('active');
  if (activeTriggeringSelectEl) {
    activeTriggeringSelectEl.value = activeTriggeringSelectEl.dataset.lastVal || (activeTriggeringSelectEl.options[0] ? activeTriggeringSelectEl.options[0].value : 'ALL');
    activeTriggeringSelectEl = null;
  }
}

function renderManageOptionsList() {
  const targetSelect = document.getElementById('manage-modal-target-field');
  const container = document.getElementById('manage-modal-options-list');
  const countBadge = document.getElementById('manage-options-count-badge');
  if (!targetSelect || !container) return;

  const catKey = targetSelect.value;
  let items = [];

  if (catKey === 'section') {
    const sections = getAllSections();
    items = sections.map(s => ({
      val: s.code,
      title: `${s.code} - ${s.name}`,
      badge: 'Section',
      badgeColor: '#38bdf8',
      sec: s.code,
      name: s.name
    }));
  } else if (catKey === 'empDesig') {
    const secSelect = document.getElementById('manage-modal-section-select');
    const chosenSec = secSelect ? secSelect.value : 'ALL';

    if (chosenSec && chosenSec !== 'ALL') {
      const desigs = getEmployeeDesignations(chosenSec);
      const secName = getSectionFullName(chosenSec);
      items = desigs.map(d => ({
        val: d,
        title: d,
        badge: `${chosenSec} (${secName})`,
        badgeColor: '#fbbf24',
        sec: chosenSec
      }));
    } else {
      const allSecs = getAllSections();
      allSecs.forEach(s => {
        const desigs = getEmployeeDesignations(s.code);
        desigs.forEach(d => {
          items.push({
            val: d,
            title: d,
            badge: s.code,
            badgeColor: '#fbbf24',
            sec: s.code
          });
        });
      });
    }
  } else if (catKey === 'officerDesig') {
    const offSelect = document.getElementById('manage-modal-office-select');
    const chosenOff = offSelect ? offSelect.value : 'ALL';
    const offices = (chosenOff && chosenOff !== 'ALL') ? [chosenOff] : ((typeof MAIN_OFFICES !== 'undefined') ? MAIN_OFFICES : ['GOVT', 'SE', 'MORTH', 'DE', 'CE', 'AG', 'NHAI', 'Others']);
    offices.forEach(o => {
      const list = typeof getOfficerDesignations === 'function' ? getOfficerDesignations(o) : [];
      list.forEach(d => {
        if (!items.some(i => i.val === d && i.sec === o)) {
          items.push({
            val: d,
            title: d,
            badge: o,
            badgeColor: '#34d399',
            sec: o
          });
        }
      });
    });
  } else if (catKey === 'shortSub') {
    const secSelect = document.getElementById('manage-modal-section-select');
    const chosenSec = secSelect ? secSelect.value : 'ALL';
    const sections = (chosenSec && chosenSec !== 'ALL') ? [chosenSec] : getAllSections().map(s => s.code);
    sections.forEach(s => {
      const subs = typeof getSubjectInBrief === 'function' ? getSubjectInBrief(s) : [];
      subs.forEach(sub => {
        if (!items.some(i => i.val === sub && i.sec === s)) {
          items.push({
            val: sub,
            title: sub,
            badge: s,
            badgeColor: '#a78bfa',
            sec: s
          });
        }
      });
    });
  } else if (catKey === 'tapalType') {
    const defaultTypes = ['Tapal', 'Email', 'DO-Letter', 'Confidential'];
    const customTypes = customDropdownOptions.tapalType || [];
    const all = Array.from(new Set([...defaultTypes, ...customTypes]));
    items = all.map(t => ({ val: t, title: t, badge: 'Type', badgeColor: '#38bdf8' }));
  } else if (catKey === 'status') {
    const defaultStatuses = (typeof STATUSES !== 'undefined') ? STATUSES : ['Pending', 'Memo', 'Letter', 'Proceedings', 'DO Letter', 'Office Order', 'Others', 'Filed'];
    const customStatuses = customDropdownOptions.status || [];
    const all = Array.from(new Set([...defaultStatuses, ...customStatuses]));
    items = all.map(st => ({ val: st, title: st, badge: 'Status', badgeColor: '#fbbf24' }));
  } else {
    const list = customDropdownOptions[catKey] || [];
    items = list.map(x => ({ val: x, title: x, badge: catKey, badgeColor: '#94a3b8' }));
  }

  if (countBadge) countBadge.innerText = `Active Options (${items.length}):`;
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px; font-size: 13px;">No options found in this category / section. Click 'Add New Option' to create one!</div>`;
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(30,41,59,0.75); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); transition: all 0.2s ease;';

    const left = document.createElement('div');
    left.style.cssText = 'display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;';

    const badge = document.createElement('span');
    badge.style.cssText = `font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 5px; background: rgba(56,189,248,0.15); color: ${item.badgeColor || '#38bdf8'}; border: 1px solid rgba(255,255,255,0.1); white-space: nowrap;`;
    badge.innerText = item.badge || catKey;

    const span = document.createElement('span');
    span.style.cssText = 'color: #f8fafc; font-weight: 700; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    span.innerText = item.title;

    left.appendChild(badge);
    left.appendChild(span);

    const right = document.createElement('div');
    right.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-shrink: 0;';

    // Edit Button
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.style.cssText = 'background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; font-weight: 700; display: flex; align-items: center; gap: 4px; transition: all 0.2s ease;';
    editBtn.innerHTML = '<i class="ri-edit-line"></i> Edit';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      openEditOptionModal(catKey, item.val, item.sec, item.name);
    };

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.style.cssText = 'background: rgba(239, 68, 68, 0.18); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; font-weight: 700; display: flex; align-items: center; gap: 4px; transition: all 0.2s ease;';
    delBtn.innerHTML = '<i class="ri-delete-bin-line"></i> Delete';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteDropdownOption(catKey, item.val, item.sec);
    };

    right.appendChild(editBtn);
    right.appendChild(delBtn);

    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });
}
window.renderManageOptionsList = renderManageOptionsList;

function openEditOptionModal(catKey, optVal, secVal, nameVal) {
  const modal = document.getElementById('modal-edit-custom-option');
  const targetCatInput = document.getElementById('edit-modal-target-cat');
  const oldValInput = document.getElementById('edit-modal-old-val');
  const oldSecInput = document.getElementById('edit-modal-old-sec');
  const catBadge = document.getElementById('edit-modal-cat-badge');

  const secFields = document.getElementById('edit-modal-section-fields');
  const secAssignmentGroup = document.getElementById('edit-modal-section-assignment-group');
  const generalGroup = document.getElementById('edit-modal-general-value-group');

  const secCodeInput = document.getElementById('edit-modal-section-code');
  const secFullnameInput = document.getElementById('edit-modal-section-fullname');
  const assignSecSelect = document.getElementById('edit-modal-assign-section');
  const newValInput = document.getElementById('edit-modal-new-val');

  if (!modal) return;

  targetCatInput.value = catKey;
  oldValInput.value = optVal;
  oldSecInput.value = secVal || '';

  const isSec = (catKey === 'section');
  const isEmp = (catKey === 'empDesig');

  if (catBadge) {
    catBadge.innerText = isSec ? 'Editing Section' : (isEmp ? `Editing Employee Designation (${secVal || 'General'})` : `Editing ${catKey}`);
  }

  if (secFields) secFields.style.display = isSec ? 'block' : 'none';
  if (secAssignmentGroup) secAssignmentGroup.style.display = isEmp ? 'block' : 'none';
  if (generalGroup) generalGroup.style.display = isSec ? 'none' : 'block';

  if (isSec) {
    if (secCodeInput) secCodeInput.value = optVal;
    if (secFullnameInput) secFullnameInput.value = nameVal || getSectionFullName(optVal) || optVal;
  } else {
    if (newValInput) newValInput.value = optVal;
    if (isEmp && assignSecSelect) {
      populateAllSectionDropdowns();
      assignSecSelect.value = secVal || 'ALL';
    }
  }

  modal.classList.add('active');
  setTimeout(() => {
    if (isSec && secFullnameInput) secFullnameInput.focus();
    else if (newValInput) newValInput.focus();
  }, 100);
}
window.openEditOptionModal = openEditOptionModal;

function closeEditCustomModal() {
  const modal = document.getElementById('modal-edit-custom-option');
  if (modal) modal.classList.remove('active');
}

function handleSaveEditCustomOption(e) {
  if (e && e.preventDefault) e.preventDefault();
  const catKey = (document.getElementById('edit-modal-target-cat') ? document.getElementById('edit-modal-target-cat').value : '') || '';
  const oldVal = (document.getElementById('edit-modal-old-val') ? document.getElementById('edit-modal-old-val').value : '') || '';
  const oldSec = (document.getElementById('edit-modal-old-sec') ? document.getElementById('edit-modal-old-sec').value : '') || '';

  if (!catKey) return;

  if (catKey === 'section') {
    const newCode = (document.getElementById('edit-modal-section-code') ? document.getElementById('edit-modal-section-code').value : '').trim().toUpperCase();
    const newName = (document.getElementById('edit-modal-section-fullname') ? document.getElementById('edit-modal-section-fullname').value : '').trim();
    if (!newCode || !newName) return alert('Please enter both Section Code and Full Name.');

    if (!Array.isArray(customDropdownOptions.sections)) customDropdownOptions.sections = [];
    
    // Remove old section entry if present
    customDropdownOptions.sections = customDropdownOptions.sections.filter(s => {
      const code = typeof s === 'string' ? s.split('(')[0].trim().toUpperCase() : (s.code ? s.code.toUpperCase() : '');
      return code !== oldVal.toUpperCase();
    });

    customDropdownOptions.sections.push({ code: newCode, name: newName });

    // Migrate designations mapping if code changed
    if (oldVal.toUpperCase() !== newCode) {
      if (customDropdownOptions.empDesigMapping && customDropdownOptions.empDesigMapping[oldVal]) {
        customDropdownOptions.empDesigMapping[newCode] = customDropdownOptions.empDesigMapping[oldVal];
        delete customDropdownOptions.empDesigMapping[oldVal];
      }
      if (typeof DEFAULT_EMPLOYEE_DESIGNATIONS[oldVal] !== 'undefined') {
        DEFAULT_EMPLOYEE_DESIGNATIONS[newCode] = DEFAULT_EMPLOYEE_DESIGNATIONS[oldVal];
      }
      // Update existing records in tapalState
      if (Array.isArray(tapalState)) {
        tapalState.forEach(r => {
          if (r.techSecRef && r.techSecRef.toUpperCase() === oldVal.toUpperCase()) {
            r.techSecRef = newCode;
          }
        });
      }
    }
    if (typeof showToast === 'function') showToast(`Section "${newCode}" updated successfully!`, 'success');
  } else if (catKey === 'empDesig') {
    const newVal = (document.getElementById('edit-modal-new-val') ? document.getElementById('edit-modal-new-val').value : '').trim();
    const newSec = (document.getElementById('edit-modal-assign-section') ? document.getElementById('edit-modal-assign-section').value : oldSec).trim();
    if (!newVal) return alert('Please enter a valid designation name.');

    if (!customDropdownOptions.empDesigMapping) customDropdownOptions.empDesigMapping = {};

    // Remove from old section mapping
    if (oldSec && oldSec !== 'ALL') {
      const oldCanonical = getCanonicalSectionCode(oldSec);
      if (!customDropdownOptions.empDesigMapping[oldCanonical]) {
        customDropdownOptions.empDesigMapping[oldCanonical] = [...(DEFAULT_EMPLOYEE_DESIGNATIONS[oldCanonical] || [])];
      }
      customDropdownOptions.empDesigMapping[oldCanonical] = customDropdownOptions.empDesigMapping[oldCanonical].filter(d => d !== oldVal);
      if (DEFAULT_EMPLOYEE_DESIGNATIONS[oldCanonical]) {
        DEFAULT_EMPLOYEE_DESIGNATIONS[oldCanonical] = DEFAULT_EMPLOYEE_DESIGNATIONS[oldCanonical].filter(d => d !== oldVal);
      }
    }

    // Add to new section mapping
    const targetCanonical = (newSec && newSec !== 'ALL') ? getCanonicalSectionCode(newSec) : 'ACCT';
    if (!customDropdownOptions.empDesigMapping[targetCanonical]) {
      customDropdownOptions.empDesigMapping[targetCanonical] = [...(DEFAULT_EMPLOYEE_DESIGNATIONS[targetCanonical] || [])];
    }
    if (!customDropdownOptions.empDesigMapping[targetCanonical].includes(newVal)) {
      customDropdownOptions.empDesigMapping[targetCanonical].push(newVal);
    }

    // Update existing records in tapalState with this designation
    if (Array.isArray(tapalState)) {
      tapalState.forEach(r => {
        if (r.empDesig === oldVal) {
          r.empDesig = newVal;
        }
      });
    }
    if (typeof showToast === 'function') showToast(`Designation "${newVal}" updated successfully!`, 'success');
  } else if (catKey === 'officerDesig') {
    const newVal = (document.getElementById('edit-modal-new-val') ? document.getElementById('edit-modal-new-val').value : '').trim();
    if (!newVal) return alert('Please enter a valid officer designation.');
    if (!customDropdownOptions.officerDesig) customDropdownOptions.officerDesig = {};
    if (oldSec && customDropdownOptions.officerDesig[oldSec]) {
      customDropdownOptions.officerDesig[oldSec] = customDropdownOptions.officerDesig[oldSec].filter(d => d !== oldVal);
      customDropdownOptions.officerDesig[oldSec].push(newVal);
    }
    if (typeof OFFICER_DESIGNATIONS_RAW !== 'undefined' && oldSec && OFFICER_DESIGNATIONS_RAW[oldSec]) {
      OFFICER_DESIGNATIONS_RAW[oldSec] = OFFICER_DESIGNATIONS_RAW[oldSec].filter(d => d !== oldVal);
      OFFICER_DESIGNATIONS_RAW[oldSec].push(newVal);
    }
    if (Array.isArray(tapalState)) {
      tapalState.forEach(r => {
        if (r.officerDesig === oldVal) r.officerDesig = newVal;
      });
    }
    if (typeof showToast === 'function') showToast(`Officer Designation updated successfully!`, 'success');
  } else if (catKey === 'shortSub') {
    const newVal = (document.getElementById('edit-modal-new-val') ? document.getElementById('edit-modal-new-val').value : '').trim();
    if (!newVal) return alert('Please enter a valid subject.');
    if (!customDropdownOptions.shortSub) customDropdownOptions.shortSub = {};
    if (oldSec && customDropdownOptions.shortSub[oldSec]) {
      customDropdownOptions.shortSub[oldSec] = customDropdownOptions.shortSub[oldSec].filter(s => s !== oldVal);
      customDropdownOptions.shortSub[oldSec].push(newVal);
    }
    if (typeof SUBJECT_IN_BRIEF_RAW !== 'undefined' && oldSec && SUBJECT_IN_BRIEF_RAW[oldSec]) {
      SUBJECT_IN_BRIEF_RAW[oldSec] = SUBJECT_IN_BRIEF_RAW[oldSec].filter(s => s !== oldVal);
      SUBJECT_IN_BRIEF_RAW[oldSec].push(newVal);
    }
    if (Array.isArray(tapalState)) {
      tapalState.forEach(r => {
        if (r.shortSub === oldVal) r.shortSub = newVal;
      });
    }
    if (typeof showToast === 'function') showToast(`Subject updated successfully!`, 'success');
  } else {
    const newVal = (document.getElementById('edit-modal-new-val') ? document.getElementById('edit-modal-new-val').value : '').trim();
    if (!newVal) return alert('Please enter a valid option title.');
    if (!Array.isArray(customDropdownOptions[catKey])) customDropdownOptions[catKey] = [];
    customDropdownOptions[catKey] = customDropdownOptions[catKey].filter(x => x !== oldVal);
    customDropdownOptions[catKey].push(newVal);
    if (catKey === 'status' && Array.isArray(tapalState)) {
      tapalState.forEach(r => {
        if (r.status === oldVal) r.status = newVal;
      });
    }
    if (typeof showToast === 'function') showToast(`Option updated successfully!`, 'success');
  }

  saveCustomDropdownOptions();
  closeEditCustomModal();

  populateAllSectionDropdowns();
  if (typeof updateEmpDesigModalDropdown === 'function') updateEmpDesigModalDropdown('register');
  if (typeof updateEmpDesigFilterDropdown === 'function') updateEmpDesigFilterDropdown();
  if (typeof updateShortSubDropdowns === 'function') updateShortSubDropdowns();
  if (typeof populateTapalTypeDropdowns === 'function') populateTapalTypeDropdowns();

  renderManageOptionsList();
  renderDashboard();
  currentPage = 1;
  renderRegisterTable();
}

function handleSaveCustomOption(e) {
  if (e && e.preventDefault) e.preventDefault();
  const targetCategory = (document.getElementById('custom-modal-target-field') ? document.getElementById('custom-modal-target-field').value : '') || 'section';
  let addedLabel = '';

  if (targetCategory === 'section') {
    const code = (document.getElementById('custom-modal-section-code') ? document.getElementById('custom-modal-section-code').value : '').trim().toUpperCase();
    const name = (document.getElementById('custom-modal-section-fullname') ? document.getElementById('custom-modal-section-fullname').value : '').trim();
    if (!code || !name) return alert('Please enter both Section Code and Full Name.');

    if (!Array.isArray(customDropdownOptions.sections)) customDropdownOptions.sections = [];
    customDropdownOptions.sections = customDropdownOptions.sections.filter(s => {
      const c = typeof s === 'string' ? s.split('(')[0].trim().toUpperCase() : (s.code ? s.code.toUpperCase() : '');
      return c !== code;
    });
    customDropdownOptions.sections.push({ code, name });

    if (!customDropdownOptions.empDesigMapping) customDropdownOptions.empDesigMapping = {};
    if (!customDropdownOptions.empDesigMapping[code]) customDropdownOptions.empDesigMapping[code] = ['CAO', 'AO 1', 'AO 2'];

    addedLabel = code;
    if (activeTriggeringSelectEl) {
      activeTriggeringSelectEl.dataset.lastVal = code;
    }
  } else if (targetCategory === 'empDesig') {
    const optionName = (document.getElementById('custom-modal-option-name') ? document.getElementById('custom-modal-option-name').value : '').trim();
    const assignedSec = (document.getElementById('custom-modal-assign-section') ? document.getElementById('custom-modal-assign-section').value : 'ALL') || 'ALL';
    if (!optionName) return alert('Please enter a valid Employee Designation.');

    if (!customDropdownOptions.empDesigMapping) customDropdownOptions.empDesigMapping = {};

    if (assignedSec && assignedSec !== 'ALL') {
      const canonical = getCanonicalSectionCode(assignedSec);
      if (!customDropdownOptions.empDesigMapping[canonical]) {
        customDropdownOptions.empDesigMapping[canonical] = [...(DEFAULT_EMPLOYEE_DESIGNATIONS[canonical] || [])];
      }
      if (!customDropdownOptions.empDesigMapping[canonical].includes(optionName)) {
        customDropdownOptions.empDesigMapping[canonical].push(optionName);
      }
      if (DEFAULT_EMPLOYEE_DESIGNATIONS[canonical] && !DEFAULT_EMPLOYEE_DESIGNATIONS[canonical].includes(optionName)) {
        DEFAULT_EMPLOYEE_DESIGNATIONS[canonical].push(optionName);
      }
    } else {
      const allSecs = getAllSections();
      allSecs.forEach(s => {
        if (!customDropdownOptions.empDesigMapping[s.code]) {
          customDropdownOptions.empDesigMapping[s.code] = [...(DEFAULT_EMPLOYEE_DESIGNATIONS[s.code] || [])];
        }
        if (!customDropdownOptions.empDesigMapping[s.code].includes(optionName)) {
          customDropdownOptions.empDesigMapping[s.code].push(optionName);
        }
      });
    }

    addedLabel = optionName;
    if (activeTriggeringSelectEl) {
      activeTriggeringSelectEl.dataset.lastVal = optionName;
    }
  } else if (targetCategory === 'officerDesig') {
    const optionName = (document.getElementById('custom-modal-option-name') ? document.getElementById('custom-modal-option-name').value : '').trim();
    const assignedOffice = (document.getElementById('custom-modal-assign-office') ? document.getElementById('custom-modal-assign-office').value : 'ALL') || 'ALL';
    if (!optionName) return alert('Please enter a valid Officer Designation.');

    if (!customDropdownOptions.officerDesig) customDropdownOptions.officerDesig = {};
    if (assignedOffice && assignedOffice !== 'ALL') {
      if (!customDropdownOptions.officerDesig[assignedOffice]) customDropdownOptions.officerDesig[assignedOffice] = [];
      if (!customDropdownOptions.officerDesig[assignedOffice].includes(optionName)) {
        customDropdownOptions.officerDesig[assignedOffice].push(optionName);
      }
    } else {
      const offices = (typeof MAIN_OFFICES !== 'undefined') ? MAIN_OFFICES : ['GOVT', 'SE', 'MORTH', 'DE', 'CE', 'AG', 'NHAI', 'Others'];
      offices.forEach(o => {
        if (!customDropdownOptions.officerDesig[o]) customDropdownOptions.officerDesig[o] = [];
        if (!customDropdownOptions.officerDesig[o].includes(optionName)) {
          customDropdownOptions.officerDesig[o].push(optionName);
        }
      });
    }
    addedLabel = optionName;
    if (activeTriggeringSelectEl) activeTriggeringSelectEl.dataset.lastVal = optionName;
  } else if (targetCategory === 'shortSub') {
    const optionName = (document.getElementById('custom-modal-option-name') ? document.getElementById('custom-modal-option-name').value : '').trim();
    const assignedSec = (document.getElementById('custom-modal-assign-section') ? document.getElementById('custom-modal-assign-section').value : 'ALL') || 'ALL';
    if (!optionName) return alert('Please enter a valid Subject in Brief.');

    if (!customDropdownOptions.shortSub) customDropdownOptions.shortSub = {};
    if (assignedSec && assignedSec !== 'ALL') {
      const canonical = getCanonicalSectionCode(assignedSec);
      if (!customDropdownOptions.shortSub[canonical]) customDropdownOptions.shortSub[canonical] = [];
      if (!customDropdownOptions.shortSub[canonical].includes(optionName)) {
        customDropdownOptions.shortSub[canonical].push(optionName);
      }
    } else {
      const allSecs = getAllSections();
      allSecs.forEach(s => {
        const canonical = getCanonicalSectionCode(s.code);
        if (!customDropdownOptions.shortSub[canonical]) customDropdownOptions.shortSub[canonical] = [];
        if (!customDropdownOptions.shortSub[canonical].includes(optionName)) {
          customDropdownOptions.shortSub[canonical].push(optionName);
        }
      });
      if (!customDropdownOptions.shortSub['ALL']) customDropdownOptions.shortSub['ALL'] = [];
      if (!customDropdownOptions.shortSub['ALL'].includes(optionName)) {
        customDropdownOptions.shortSub['ALL'].push(optionName);
      }
    }
    addedLabel = optionName;
    if (activeTriggeringSelectEl) activeTriggeringSelectEl.dataset.lastVal = optionName;
  } else {
    const optionName = (document.getElementById('custom-modal-option-name') ? document.getElementById('custom-modal-option-name').value : '').trim();
    if (!optionName) return alert('Please enter a valid option title.');
    if (!Array.isArray(customDropdownOptions[targetCategory])) customDropdownOptions[targetCategory] = [];
    if (!customDropdownOptions[targetCategory].includes(optionName)) {
      customDropdownOptions[targetCategory].push(optionName);
    }
    addedLabel = optionName;
    if (activeTriggeringSelectEl) activeTriggeringSelectEl.dataset.lastVal = optionName;
  }

  saveCustomDropdownOptions();
  closeCustomModal();

  populateAllSectionDropdowns();
  if (typeof updateEmpDesigModalDropdown === 'function') {
    updateEmpDesigModalDropdown('register');
    updateEmpDesigModalDropdown('edit');
  }
  if (typeof updateEmpDesigFilterDropdown === 'function') updateEmpDesigFilterDropdown();
  if (typeof updateOfficerModalDropdown === 'function') {
    updateOfficerModalDropdown('register');
    updateOfficerModalDropdown('edit');
  }
  if (typeof updateShortSubDropdowns === 'function') updateShortSubDropdowns();
  if (typeof populateTapalTypeDropdowns === 'function') populateTapalTypeDropdowns();

  if (activeTriggeringSelectEl) {
    const lastVal = activeTriggeringSelectEl.dataset.lastVal || addedLabel;
    if (activeTriggeringSelectEl.id && activeTriggeringSelectEl.id.includes('short-sub')) {
      const mode = activeTriggeringSelectEl.id.startsWith('edit-') ? 'edit' : 'register';
      updateShortSubModalDropdown(mode, lastVal);
    } else if (activeTriggeringSelectEl.id && activeTriggeringSelectEl.id.includes('officer')) {
      const mode = activeTriggeringSelectEl.id.startsWith('edit-') ? 'edit' : 'register';
      updateOfficerModalDropdown(mode, lastVal);
    } else if (activeTriggeringSelectEl.id && activeTriggeringSelectEl.id.includes('emp-desig')) {
      const mode = activeTriggeringSelectEl.id.startsWith('edit-') ? 'edit' : 'register';
      updateEmpDesigModalDropdown(mode, lastVal);
    } else {
      activeTriggeringSelectEl.value = lastVal;
    }
    if (typeof window.refreshSearchableSelect === 'function') {
      window.refreshSearchableSelect(activeTriggeringSelectEl);
    }
    activeTriggeringSelectEl = null;
  }

  if (typeof renderManageOptionsList === 'function') renderManageOptionsList();
  if (typeof showToast === 'function') showToast(`Option "${addedLabel}" added successfully!`, 'success');

  renderDashboard();
  currentPage = 1;
  renderRegisterTable();
}

function deleteDropdownOption(catKey, optVal, secVal) {
  if (!confirm(`Are you sure you want to delete "${optVal}"?`)) return;

  if (catKey === 'section') {
    const code = optVal.toUpperCase();
    if (!Array.isArray(customDropdownOptions.sections)) {
      customDropdownOptions.sections = getAllSections().map(s => ({ code: s.code, name: s.name }));
    }
    customDropdownOptions.sections = customDropdownOptions.sections.filter(s => {
      const c = typeof s === 'string' ? s.split('(')[0].trim().toUpperCase() : (s.code ? s.code.toUpperCase() : '');
      return c !== code;
    });
    if (customDropdownOptions.empDesigMapping) {
      delete customDropdownOptions.empDesigMapping[code];
    }
    const idx = DEFAULT_SECTIONS_MASTER.findIndex(s => s.code === code);
    if (idx !== -1) DEFAULT_SECTIONS_MASTER.splice(idx, 1);
  } else if (catKey === 'empDesig') {
    if (!customDropdownOptions.empDesigMapping) customDropdownOptions.empDesigMapping = {};
    if (secVal && secVal !== 'ALL') {
      const canonical = getCanonicalSectionCode(secVal);
      const currentList = getEmployeeDesignations(canonical);
      customDropdownOptions.empDesigMapping[canonical] = currentList.filter(d => d !== optVal);
      if (DEFAULT_EMPLOYEE_DESIGNATIONS[canonical]) {
        DEFAULT_EMPLOYEE_DESIGNATIONS[canonical] = DEFAULT_EMPLOYEE_DESIGNATIONS[canonical].filter(d => d !== optVal);
      }
    } else {
      const allSecs = getAllSections();
      allSecs.forEach(s => {
        const currentList = getEmployeeDesignations(s.code);
        customDropdownOptions.empDesigMapping[s.code] = currentList.filter(d => d !== optVal);
        if (DEFAULT_EMPLOYEE_DESIGNATIONS[s.code]) {
          DEFAULT_EMPLOYEE_DESIGNATIONS[s.code] = DEFAULT_EMPLOYEE_DESIGNATIONS[s.code].filter(d => d !== optVal);
        }
      });
    }
  } else if (catKey === 'officerDesig') {
    if (!customDropdownOptions.officerDesig) customDropdownOptions.officerDesig = {};
    if (secVal && secVal !== 'ALL') {
      const currentList = getOfficerDesignations(secVal);
      customDropdownOptions.officerDesig[secVal] = currentList.filter(d => d !== optVal);
    } else {
      const offices = getMainOffices();
      offices.forEach(o => {
        const currentList = getOfficerDesignations(o);
        customDropdownOptions.officerDesig[o] = currentList.filter(d => d !== optVal);
      });
    }
  } else if (catKey === 'shortSub') {
    if (!customDropdownOptions.shortSub) customDropdownOptions.shortSub = {};
    if (secVal && secVal !== 'ALL') {
      const canonical = getCanonicalSectionCode(secVal);
      const currentList = getSubjectInBrief(canonical);
      customDropdownOptions.shortSub[canonical] = currentList.filter(s => s !== optVal);
    } else {
      const allSecs = getAllSections();
      allSecs.forEach(s => {
        const currentList = getSubjectInBrief(s.code);
        customDropdownOptions.shortSub[s.code] = currentList.filter(s => s !== optVal);
      });
    }
  } else if (catKey === 'mainOffice') {
    const currentList = getMainOffices();
    customDropdownOptions.mainOffice = currentList.filter(o => o !== optVal);
  } else if (catKey === 'tapalType') {
    const currentList = getTapalTypes();
    customDropdownOptions.tapalType = currentList.filter(t => t !== optVal);
  } else if (catKey === 'status') {
    const currentList = getStatuses();
    customDropdownOptions.status = currentList.filter(st => st !== optVal);
  } else {
    if (!Array.isArray(customDropdownOptions[catKey])) customDropdownOptions[catKey] = [];
    customDropdownOptions[catKey] = customDropdownOptions[catKey].filter(x => x !== optVal);
  }

  saveCustomDropdownOptions();

  populateAllSectionDropdowns();
  populateManageFilterDropdowns();
  if (typeof updateEmpDesigModalDropdown === 'function') updateEmpDesigModalDropdown('register');
  if (typeof updateEmpDesigModalDropdown === 'function') updateEmpDesigModalDropdown('edit');
  if (typeof updateEmpDesigFilterDropdown === 'function') updateEmpDesigFilterDropdown();
  if (typeof updateOfficerFilterDropdown === 'function') updateOfficerFilterDropdown();
  if (typeof updateOfficerModalDropdown === 'function') updateOfficerModalDropdown('register');
  if (typeof updateOfficerModalDropdown === 'function') updateOfficerModalDropdown('edit');
  if (typeof updateShortSubFilterDropdown === 'function') updateShortSubFilterDropdown();
  if (typeof updateShortSubModalDropdown === 'function') updateShortSubModalDropdown('register');
  if (typeof updateShortSubModalDropdown === 'function') updateShortSubModalDropdown('edit');
  if (typeof updateShortSubDropdowns === 'function') updateShortSubDropdowns();
  if (typeof populateTapalTypeDropdowns === 'function') populateTapalTypeDropdowns();

  if (typeof initSearchableSelects === 'function') {
    initSearchableSelects();
  }

  renderManageOptionsList();
  if (typeof showToast === 'function') showToast(`Option "${optVal}" deleted successfully!`, 'info');
  renderDashboard();
  currentPage = 1;
  renderRegisterTable();
}
window.deleteDropdownOption = deleteDropdownOption;

function initCustomModalEvents() {
  const closeBtn = document.getElementById('btn-close-custom-modal');
  const cancelBtn = document.getElementById('btn-cancel-custom-modal');
  const formAdd = document.getElementById('form-add-custom-option');
  const targetFieldSelect = document.getElementById('custom-modal-target-field');

  const closeManageBtn = document.getElementById('btn-close-manage-modal');
  const doneManageBtn = document.getElementById('btn-done-manage-modal');
  const manageTargetSelect = document.getElementById('manage-modal-target-field');
  const quickAddBtn = document.getElementById('btn-manage-add-quick');

  const closeEditBtn = document.getElementById('btn-close-edit-custom-modal');
  const cancelEditBtn = document.getElementById('btn-cancel-edit-custom-modal');
  const formEdit = document.getElementById('form-edit-custom-option');

  if (closeBtn) closeBtn.onclick = closeCustomModal;
  if (cancelBtn) cancelBtn.onclick = closeCustomModal;
  if (closeManageBtn) closeManageBtn.onclick = closeManageModal;
  if (doneManageBtn) doneManageBtn.onclick = closeManageModal;
  if (closeEditBtn) closeEditBtn.onclick = closeEditCustomModal;
  if (cancelEditBtn) cancelEditBtn.onclick = closeEditCustomModal;

  if (quickAddBtn) {
    quickAddBtn.onclick = () => {
      const currentCat = manageTargetSelect ? manageTargetSelect.value : 'section';
      openAddCustomOptionModal(currentCat);
    };
  }

  if (targetFieldSelect) {
    targetFieldSelect.onchange = () => {
      openAddCustomOptionModal(targetFieldSelect.value);
    };
  }

  if (manageTargetSelect) {
    manageTargetSelect.onchange = () => {
      const cat = manageTargetSelect.value;
      const sectionGroup = document.getElementById('manage-modal-section-group');
      const officeGroup = document.getElementById('manage-modal-office-group');
      if (sectionGroup) sectionGroup.style.display = (cat === 'empDesig' || cat === 'shortSub') ? 'block' : 'none';
      if (officeGroup) officeGroup.style.display = (cat === 'officerDesig') ? 'block' : 'none';
      renderManageOptionsList();
    };
  }

  const btnSubmitEdit = document.getElementById('btn-submit-edit-custom-option');
  const btnSubmitAdd = document.getElementById('btn-submit-add-custom-option');

  if (formAdd) formAdd.onsubmit = handleSaveCustomOption;
  if (formEdit) formEdit.onsubmit = handleSaveEditCustomOption;
  if (btnSubmitEdit) btnSubmitEdit.onclick = (e) => { e.preventDefault(); handleSaveEditCustomOption(e); };
  if (btnSubmitAdd) btnSubmitAdd.onclick = (e) => { e.preventDefault(); handleSaveCustomOption(e); };
}

function initCustomAddOnListeners() {
  populateAllSectionDropdowns();
  populateTapalTypeDropdowns();
  initCustomModalEvents();

  document.addEventListener('change', (e) => {
    if (e.target && e.target.tagName === 'SELECT') {
      e.target.style.borderColor = '';
      if (e.target.id && e.target.id.includes('emp-desig')) {
        const val = e.target.value;
        if (val && !val.startsWith('__')) {
          if (val !== 'ALL') {
            localStorage.setItem('tapal_last_chosen_emp_desig', val);
            if (e.target.id === 'th-filter-emp-desig') {
              localStorage.setItem('tapal_filter_chosen_emp_desig', val);
            }
          } else if (e.target.id === 'th-filter-emp-desig') {
            localStorage.removeItem('tapal_filter_chosen_emp_desig');
          }
        }
      }
      handleCustomAddOn(e.target);
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target && e.target.tagName === 'INPUT') {
      e.target.style.borderColor = '';
    }
  });
}

function updateEmpDesigFilterDropdown() {
  const thSectionEl = document.getElementById('th-filter-section');
  const thEmpDesigEl = document.getElementById('th-filter-emp-desig');
  if (!thEmpDesigEl) return;

  const selectedSec = thSectionEl ? thSectionEl.value : 'ALL';
  const savedFilterDesig = localStorage.getItem('tapal_filter_chosen_emp_desig');
  const currentDesigVal = (thEmpDesigEl.value && thEmpDesigEl.value !== 'ALL') ? thEmpDesigEl.value : (savedFilterDesig || 'ALL');

  let desigOptions = [];
  if (selectedSec && selectedSec !== 'ALL') {
    desigOptions = typeof getEmployeeDesignations === 'function' ? getEmployeeDesignations(selectedSec) : [];
  } else {
    const allSet = new Set();
    const allSecs = typeof getAllSections === 'function' ? getAllSections() : [];
    allSecs.forEach(sec => {
      const list = typeof getEmployeeDesignations === 'function' ? getEmployeeDesignations(sec.code) : [];
      list.forEach(item => allSet.add(item));
    });
    desigOptions = Array.from(allSet);
  }

  let html = '<option value="ALL">EMPLOYEE DESIGNATION ▾</option>';
  desigOptions.forEach(d => {
    html += `<option value="${d}">${d}</option>`;
  });
  html += '<option value="__ADD_NEW__" style="color: #38bdf8; font-weight: bold;">➕ Add Custom Option...</option>';
  html += '<option value="__MANAGE_OPTIONS__" style="color: #f87171; font-weight: bold;">🗑️ Manage / Delete Options...</option>';

  thEmpDesigEl.innerHTML = html;
  if (currentDesigVal && currentDesigVal !== 'ALL' && desigOptions.includes(currentDesigVal)) {
    thEmpDesigEl.value = currentDesigVal;
  } else {
    thEmpDesigEl.value = 'ALL';
  }
  if (typeof window.refreshSearchableSelect === 'function') {
    window.refreshSearchableSelect(thEmpDesigEl);
  }
}
window.updateEmpDesigFilterDropdown = updateEmpDesigFilterDropdown;

function updateEmpDesigModalDropdown(mode, preselectValue) {
  const isEdit = (mode === 'edit');
  const secElId = isEdit ? 'edit-tech-sec-ref' : 'form-tech-sec-ref';
  const desigElId = isEdit ? 'edit-emp-desig' : 'form-emp-desig';
  const dispTextId = isEdit ? 'edit-selected-section-text' : 'form-selected-section-text';

  const secEl = document.getElementById(secElId);
  const desigEl = document.getElementById(desigElId);
  const dispTextEl = document.getElementById(dispTextId);

  const rawSec = secEl ? secEl.value : '';
  const canonicalCode = (typeof getCanonicalSectionCode === 'function') ? getCanonicalSectionCode(rawSec) : rawSec;
  const fullName = (typeof getSectionFullName === 'function') ? getSectionFullName(canonicalCode) : canonicalCode;

  if (dispTextEl) {
    dispTextEl.innerText = canonicalCode ? `${canonicalCode} (${fullName})` : '-- Not Selected in Step 1 --';
  }

  if (!desigEl) return;

  // Determine target value to select
  let targetVal = '';
  if (preselectValue !== undefined && preselectValue !== null && preselectValue !== '') {
    targetVal = preselectValue;
  } else if (desigEl.value && !desigEl.value.startsWith('__')) {
    targetVal = desigEl.value;
  } else if (isEdit) {
    const editRecIdEl = document.getElementById('edit-record-id');
    const recId = editRecIdEl ? parseInt(editRecIdEl.value, 10) : null;
    const item = recId ? tapalState.find(r => r.id === recId) : null;
    if (item && item.empDesig) {
      targetVal = item.empDesig;
    }
  } else {
    targetVal = localStorage.getItem('tapal_last_chosen_emp_desig') || '';
  }

  let desigOptions = typeof getEmployeeDesignations === 'function' ? getEmployeeDesignations(canonicalCode) : ['CAO', 'AO 1', 'AO 2'];

  let html = '<option value="">-- Select Employee Designation --</option>';
  desigOptions.forEach(d => {
    html += `<option value="${d}">${d}</option>`;
  });
  html += '<option value="__ADD_NEW__" style="color: #38bdf8; font-weight: bold;">➕ Add Custom Option...</option>';
  html += '<option value="__MANAGE_OPTIONS__" style="color: #f87171; font-weight: bold;">🗑️ Manage / Delete Options...</option>';

  desigEl.innerHTML = html;

  if (targetVal && desigOptions.includes(targetVal)) {
    desigEl.value = targetVal;
  } else if (desigOptions.length > 0) {
    desigEl.value = desigOptions[0];
  } else {
    desigEl.value = '';
  }

  if (typeof window.refreshSearchableSelect === 'function') {
    window.refreshSearchableSelect(desigEl);
  }
}
window.updateEmpDesigModalDropdown = updateEmpDesigModalDropdown;

// -------------------------------------------------------------
// 2. INWARD TAPAL REGISTER TABLE & FILTERS
// -------------------------------------------------------------
function renderRegisterTable() {
  populateLetterRefDropdown();
  populateQuickMonthDropdown();

  const tbody = document.getElementById('tapal-tbody');
  const searchEl = document.getElementById('search-input');
  const searchVal = searchEl ? searchEl.value.toLowerCase() : '';
  
  const thTypeEl = document.getElementById('th-filter-type');
  const typeVal = thTypeEl ? thTypeEl.value : 'ALL';

  const thStatusEl = document.getElementById('th-filter-status');
  const filterStatusEl = document.getElementById('filter-status');
  const statusVal = (thStatusEl && thStatusEl.value !== 'ALL') ? thStatusEl.value : (filterStatusEl ? filterStatusEl.value : 'ALL');

  const filterMonthEl = document.getElementById('filter-month');
  const monthVal = filterMonthEl ? filterMonthEl.value : 'ALL';

  const filterOfficeEl = document.getElementById('filter-office');
  const thOfficeEl = document.getElementById('th-filter-office');
  const officeVal = (thOfficeEl && thOfficeEl.value !== 'ALL') ? thOfficeEl.value : (filterOfficeEl ? filterOfficeEl.value : 'ALL');

  const filterOfficerEl = document.getElementById('filter-officer');
  const thOfficerEl = document.getElementById('th-filter-officer');
  const officerVal = (thOfficerEl && thOfficerEl.value !== 'ALL') ? thOfficerEl.value : (filterOfficerEl ? filterOfficerEl.value : 'ALL');

  const whomVal = document.getElementById('filter-letter-whom') ? document.getElementById('filter-letter-whom').value : 'ALL';

  const thShortSubEl = document.getElementById('th-filter-short-sub');
  const shortSubVal = thShortSubEl ? thShortSubEl.value : 'ALL';

  const thLetterRefEl = document.getElementById('th-filter-letter-ref');
  const letterRefVal = thLetterRefEl ? thLetterRefEl.value : 'ALL';

  const thSectionEl = document.getElementById('th-filter-section');
  const sectionVal = thSectionEl ? thSectionEl.value : 'ALL';

  const thEmpDesigEl = document.getElementById('th-filter-emp-desig');
  const empDesigVal = thEmpDesigEl ? thEmpDesigEl.value : 'ALL';

  // Update Total Pendings KPI in register banner
  const pendingCount = tapalState.filter(r => r.status === 'Pending').length;
  const pendingEl = document.getElementById('register-total-pendings');
  if (pendingEl) pendingEl.innerText = pendingCount;

  // Dedicated File Reference No Search
  const fileRefSearchEl = document.getElementById('file-ref-search-input');
  const fileRefSearchVal = fileRefSearchEl ? fileRefSearchEl.value.trim().toLowerCase() : '';

  // Filter items
  const filtered = tapalState.filter(item => {
    const matchesSearch = !searchVal || 
      String(item.currNo || '').toLowerCase().includes(searchVal) ||
      (item.subject && item.subject.toLowerCase().includes(searchVal)) ||
      (item.letterRef && item.letterRef.toLowerCase().includes(searchVal)) ||
      (item.officerDesig && item.officerDesig.toLowerCase().includes(searchVal)) ||
      (item.shortSub && item.shortSub.toLowerCase().includes(searchVal)) ||
      (item.actionInitiated && item.actionInitiated.toLowerCase().includes(searchVal)) ||
      (item.fileNoRef && item.fileNoRef.toLowerCase().includes(searchVal)) ||
      (item.techSecRef && item.techSecRef.toLowerCase().includes(searchVal)) ||
      (item.empDesig && item.empDesig.toLowerCase().includes(searchVal));

    const matchesFileRefSearch = !fileRefSearchVal || 
      (item.fileNoRef && String(item.fileNoRef).toLowerCase().includes(fileRefSearchVal)) ||
      (item.letterRef && String(item.letterRef).toLowerCase().includes(fileRefSearchVal));

    const matchesType = typeVal === 'ALL' || (
      typeVal.toLowerCase() === 'tapal'
        ? (!item.tapalType || item.tapalType === 'Tapal' || item.tapalType === '-')
        : (item.tapalType && item.tapalType.toLowerCase() === typeVal.toLowerCase())
    );
    const matchesMonth = monthVal === 'ALL' || item.month === monthVal;
    const matchesSheetTab = activeSheetTab === 'ALL' || item.month === activeSheetTab;
    const matchesStatus = statusVal === 'ALL' || item.status === statusVal;
    const matchesOffice = officeVal === 'ALL' || (
      officeVal === 'OTHERS' 
        ? (!item.mainOffice || item.mainOffice === '-' || item.mainOffice === 'OTHERS' || item.mainOffice === '') 
        : (item.mainOffice && item.mainOffice.toUpperCase() === officeVal.toUpperCase())
    );
    const matchesWhom = whomVal === 'ALL' || (
      whomVal === 'OTHERS'
        ? (!item.mainOffice || item.mainOffice === '-' || item.mainOffice === 'OTHERS' || item.mainOffice === '')
        : (item.mainOffice && item.mainOffice.toUpperCase() === whomVal.toUpperCase())
    );
    const matchesOfficer = officerVal === 'ALL' || (item.officerDesig && item.officerDesig.includes(officerVal));
    const matchesShortSub = shortSubVal === 'ALL' || item.shortSub === shortSubVal;
    const matchesSection = sectionVal === 'ALL' || (
      typeof getCanonicalSectionCode === 'function'
        ? getCanonicalSectionCode(item.techSecRef) === getCanonicalSectionCode(sectionVal)
        : item.techSecRef === sectionVal
    );
    const matchesEmpDesig = empDesigVal === 'ALL' || item.empDesig === empDesigVal;

    let matchesLetterRef = true;
    if (letterRefVal !== 'ALL') {
      if (item.letterRef) {
        const str = String(item.letterRef).trim();
        if (str.includes('/')) {
          const lastPart = str.split('/').pop().trim();
          matchesLetterRef = (lastPart.toLowerCase() === letterRefVal.toLowerCase());
        } else {
          matchesLetterRef = false;
        }
      } else {
        matchesLetterRef = false;
      }
    }

    let matchesDate = true;
    if (activeDateFilter) {
      if (typeof activeDateFilter === 'string') {
        if (activeDateFilter.includes('-2023') || activeDateFilter.includes('-2024')) {
          const ym = getYearMonthFromKey(activeDateFilter);
          matchesDate = item.month === activeDateFilter || (item.recSecDate && item.recSecDate.startsWith(ym));
        } else {
          matchesDate = item.recSecDate === activeDateFilter || item.letterDate === activeDateFilter;
        }
      } else if (activeDateFilter.start && activeDateFilter.end) {
        const itemDate = item.recSecDate || item.letterDate;
        matchesDate = itemDate >= activeDateFilter.start && itemDate <= activeDateFilter.end;
      }
    }

    return matchesSearch && matchesFileRefSearch && matchesType && matchesMonth && matchesSheetTab && matchesStatus && matchesOffice && matchesWhom && matchesOfficer && matchesDate && matchesShortSub && matchesLetterRef && matchesSection && matchesEmpDesig;
  });

  // Sort by Section Receipt Date, Reminders, Latest Reminder Date, or other selected column
  filtered.sort((a, b) => {
    if (currentSortColumn === 'recSecDate') {
      const dateA = a.recSecDate || '';
      const dateB = b.recSecDate || '';
      return currentSortOrder === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    }
    if (currentSortColumn === 'reminders') {
      const countA = getTapalReminderCount(a);
      const countB = getTapalReminderCount(b);
      return currentSortOrder === 'asc' ? countA - countB : countB - countA;
    }
    if (currentSortColumn === 'latestReminderDate') {
      const getLatestDate = (item) => {
        if (item.latestReminderDate) return item.latestReminderDate;
        const rems = getTapalReminders(item.id);
        return rems.length > 0 ? rems[0].date : '';
      };
      const dateA = getLatestDate(a);
      const dateB = getLatestDate(b);
      return currentSortOrder === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    }
    return 0;
  });

  updateFilterBadgeUI(null, filtered.length);

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIdx = (currentPage - 1) * itemsPerPage;
  const pageData = filtered.slice(startIdx, startIdx + itemsPerPage);

  tbody.innerHTML = '';
  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="27" style="text-align: center; padding: 24px; color: var(--text-muted);">No matching Tapal records found.</td></tr>`;
  } else {
    pageData.forEach(item => {
      const badgeClass = getBadgeClass(item.status);
      const tr = document.createElement('tr');
      const currentType = item.tapalType || 'Tapal';
      const typeClass = `type-${currentType.toLowerCase().replace(/[^a-z]/g, '')}`;

      const statusHtml = `<span class="badge ${badgeClass}" onclick="event.stopPropagation(); toggleRecordStatus('${item.id}')" style="cursor: pointer;" title="Click to update status">${item.status || 'Pending'}</span>`;

      const actionsHtml = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); viewRecordDetails('${item.id}')" style="color: #38bdf8; border-color: rgba(56,189,248,0.4); padding: 4px 8px; font-size: 13px;" title="View Full Details"><i class="ri-eye-line"></i></button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openEditRecordModal('${item.id}')" style="color: #fbbf24; border-color: rgba(251,191,36,0.4); padding: 4px 8px; font-size: 13px;" title="Edit Entry"><i class="ri-edit-line"></i></button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); deleteRecord('${item.id}')" style="color: #ef4444; border-color: rgba(239,68,68,0.4); padding: 4px 8px; font-size: 13px;" title="Delete Record"><i class="ri-delete-bin-line"></i></button>
        </div>`;

      const isFiled = item.status === 'Filed';
      const sentToFormatted = (!isFiled && item.sentTo) ? 
        `<span class="badge" style="background: rgba(56,189,248,0.12); color: #38bdf8; font-weight: 600;" title="${item.sentTo}">${truncate(item.sentTo, 25)}</span>` : '-';

      const canonicalSec = (typeof getCanonicalSectionCode === 'function') ? getCanonicalSectionCode(item.techSecRef) : item.techSecRef;
      const secFullName = (typeof getSectionFullName === 'function') ? getSectionFullName(canonicalSec) : canonicalSec;

      let officeLetterOrAccountsRef = '-';
      if (isFiled) {
        officeLetterOrAccountsRef = `<span class="badge" style="background: rgba(148,163,184,0.15); color: #94a3b8; font-size: 11px;">Filed (No Dispatch)</span>`;
      } else if (canonicalSec === 'ACCT') {
        officeLetterOrAccountsRef = item.accountsRefNo
          ? `<span class="badge" style="background: rgba(251,191,36,0.15); border: 1px solid rgba(251,191,36,0.4); color: #fbbf24; font-weight: 800;" title="Accounts Ref: ${item.accountsRefNo}"><i class="ri-money-dollar-box-line"></i> ${item.accountsRefNo}</span>`
          : (item.sentLetterNo || '-');
      } else {
        officeLetterOrAccountsRef = item.sentLetterNo || '-';
      }

      const remCount = getTapalReminderCount(item);
      const remBtnHtml = remCount > 0 ?
        `<button type="button" class="btn btn-sm" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.5); color: #fbbf24; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; white-space: nowrap;" onclick="event.stopPropagation(); openRemindersModal('${item.id}')" title="${remCount} reminder(s) logged. Click to view history or add new reminder.">
           <i class="ri-notification-3-fill" style="color: #f59e0b;"></i> ${remCount}
         </button>` :
        `<button type="button" class="btn btn-sm" style="background: rgba(148, 163, 184, 0.08); border: 1px dashed rgba(148, 163, 184, 0.3); color: #94a3b8; font-weight: 600; font-size: 11px; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" onclick="event.stopPropagation(); openRemindersModal('${item.id}')" title="No reminders yet. Click to log a reminder.">
           <i class="ri-notification-line"></i> 0
         </button>`;

      const tapalRemindersList = getTapalReminders(item.id);
      const latestRemDate = item.latestReminderDate || (tapalRemindersList.length > 0 ? tapalRemindersList[0].date : null);
      const latestRemFormatted = latestRemDate ?
        `<span class="badge" style="background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.35); color: #38bdf8; font-weight: 700; font-size: 12px; cursor: pointer; white-space: nowrap;" onclick="event.stopPropagation(); openRemindersModal('${item.id}')" title="Latest reminder logged on ${formatISOToDDMMYYYY(latestRemDate)}"><i class="ri-calendar-event-line"></i> ${formatISOToDDMMYYYY(latestRemDate)}</span>` :
        `<span style="color: #64748b; font-size: 13px;">-</span>`;

      const itemComplaints = complaintsState.filter(c => String(c.tapalId) === String(item.id));
      const complaintBtnHtml = itemComplaints.length > 0 ?
        `<button type="button" class="btn btn-sm" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.5); color: #f87171; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" onclick="event.stopPropagation(); openRaiseComplaintModal('${item.id}')" title="${itemComplaints.length} issue(s) raised for this entry">
           <i class="ri-alarm-warning-fill" style="color: #ef4444;"></i> Issue (${itemComplaints.length})
         </button>` :
        `<button type="button" class="btn btn-sm" style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" onclick="event.stopPropagation(); openRaiseComplaintModal('${item.id}')" title="Raise complaint / issue">
           <i class="ri-feedback-line"></i> Raise Issue
         </button>`;

      const dispDateDisplay = (!isFiled && item.dispatchDate) ? formatISOToDDMMYYYY(item.dispatchDate) : '-';

      tr.innerHTML = `
        <td><strong>#${item.sNo}</strong></td>
        <td><span class="badge ${currentType === 'Email' ? 'badge-email' : 'badge-tapal'}">${currentType}</span></td>
        <td><strong>${item.currNo || '-'}</strong></td>
        <td>${item.sealDate ? formatISOToDDMMYYYY(item.sealDate) : '-'}</td>
        <td><span class="badge" style="background: rgba(56,189,248,0.1); color: #38bdf8; font-weight: 600;" title="${secFullName || ''}">${canonicalSec || '-'}</span></td>
        <td><span class="badge" style="background: rgba(251,191,36,0.12); color: #fbbf24; font-weight: 700;">${item.empDesig || '-'}</span></td>
        <td style="color: #38bdf8; font-weight: 700;">${item.recSecDate ? formatISOToDDMMYYYY(item.recSecDate) : '-'}</td>
        <td title="${item.subject || ''}">${truncate(item.subject || '-', 25)}</td>
        <td title="${item.letterRef || ''}">${truncate(item.letterRef || '-', 20)}</td>
        <td>${item.letterDate ? formatISOToDDMMYYYY(item.letterDate) : '-'}</td>
        <td>${item.shortSub || '-'}</td>
        <td><span class="badge" style="background: rgba(255,255,255,0.08); color: #fff;">${item.mainOffice || '-'}</span></td>
        <td>${item.officerDesig || '-'}</td>
        <td>${statusHtml}</td>
        <td title="${item.actionInitiated || ''}">${truncate(item.actionInitiated || '-', 20)}</td>
        <td>${item.fileNoRef || '-'}</td>
        <td>${item.fileInitDate ? formatISOToDDMMYYYY(item.fileInitDate) : '-'}</td>
        <td>${item.fileApprDate ? formatISOToDDMMYYYY(item.fileApprDate) : (isFiled ? '<span style="color:#64748b;">-</span>' : '-')}</td>
        <td>${item.followUp || '-'}</td>
        <td>${item.followUpDate ? formatISOToDDMMYYYY(item.followUpDate) : '-'}</td>
        <td>${item.followUpClosedDate ? `<span class="badge" style="background: rgba(16,185,129,0.15); color: #34d399; font-weight: 700; border: 1px solid #10b981;">✓ ${formatISOToDDMMYYYY(item.followUpClosedDate)}</span>` : (item.followUp && item.followUp !== '-' ? `<span class="badge" style="background: rgba(245,158,11,0.15); color: #fbbf24; font-weight: 700; border: 1px solid #f59e0b;">Pending</span>` : '-')}</td>
        <td>${item.remarks || '-'}</td>
        <td>${officeLetterOrAccountsRef}</td>
        <td>${dispDateDisplay}</td>
        <td>${sentToFormatted}</td>
        <td>${remBtnHtml}</td>
        <td>${latestRemFormatted}</td>
        <td>${complaintBtnHtml}</td>
        <td>${actionsHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Update pagination text
  const startNum = filtered.length > 0 ? startIdx + 1 : 0;
  const endNum = Math.min(startIdx + itemsPerPage, filtered.length);
  document.getElementById('pagination-info').innerText = `Showing ${startNum}-${endNum} of ${filtered.length} entries (Total Records: ${tapalState.length})`;

  // Filter event listeners
  ['search-input', 'filter-month', 'filter-status', 'filter-office', 'filter-officer', 'filter-letter-whom', 'th-filter-type', 'th-filter-status', 'th-filter-office', 'th-filter-officer', 'th-filter-short-sub', 'th-filter-letter-ref', 'th-filter-section', 'th-filter-emp-desig', 'sheet-year-select'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.bound) {
      el.dataset.bound = 'true';
      el.addEventListener('input', () => { 
        if (el.value === '__ADD_NEW__' || el.value === '__MANAGE_OPTIONS__') {
          handleCustomAddOn(el);
          return;
        }
        currentPage = 1; 
        renderRegisterTable(); 
      });
      el.addEventListener('change', () => { 
        if (el.value === '__ADD_NEW__' || el.value === '__MANAGE_OPTIONS__') {
          handleCustomAddOn(el);
          return;
        }
        if (id === 'sheet-year-select') {
          renderExcelSheetTabs();
        }
        currentPage = 1; 
        renderRegisterTable(); 
      });
    }
  });

  // Pagination buttons
  const prevBtn = document.getElementById('btn-prev-page');
  const nextBtn = document.getElementById('btn-next-page');
  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentPage > 1) { currentPage--; renderRegisterTable(); }
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentPage < totalPages) { currentPage++; renderRegisterTable(); }
    };
  }
}

// -------------------------------------------------------------
// VIEW & EDIT RECORD MODAL HANDLERS
// -------------------------------------------------------------
function viewRecordDetails(id) {
  if (id === undefined || id === null || id === '') return;
  const idStr = String(id).trim();
  const item = tapalState.find(r => String(r.id) === idStr || String(r.sNo) === idStr || String(r.currNo) === idStr);
  if (!item) return;

  const modal = document.getElementById('view-tapal-modal');
  const snoBadge = document.getElementById('view-modal-sno-badge');
  const bodyContent = document.getElementById('view-modal-body-content');

  if (!modal || !bodyContent) return;

  if (snoBadge) snoBadge.innerText = `#${item.sNo}`;

  const fields = [
    { label: 'Tapal / Mail Type', val: item.tapalType || 'Tapal', required: true },
    { label: 'Current No (Inward No)', val: item.currNo || '-', required: true },
    { label: 'Office Seal Date', val: item.sealDate ? formatISOToDDMMYYYY(item.sealDate) : '-', required: true },
    { label: 'Received in Section Date', val: item.recSecDate ? formatISOToDDMMYYYY(item.recSecDate) : '-', required: true },
    { label: 'Section', val: item.techSecRef || '-', required: true },
    { label: 'Employee Designation', val: item.empDesig || '-', required: true },
    { label: 'Subject', val: item.subject || '-', fullWidth: true, required: true },
    { label: 'Letter Reference No', val: item.letterRef || '-', required: true },
    { label: 'Letter Date', val: item.letterDate ? formatISOToDDMMYYYY(item.letterDate) : '-', required: true },
    { label: 'Main Office', val: item.mainOffice || '-', required: true },
    { label: 'Officer Designation', val: item.officerDesig || '-', required: true },
    { label: 'SUBJECT IN BRIEF', val: item.shortSub || '-', required: true },
    { label: 'Status', val: item.status || 'Pending' },
    { label: 'Action Initiated', val: item.actionInitiated || '-' },
    { label: 'Action Initiated Date', val: item.fileInitDate ? formatISOToDDMMYYYY(item.fileInitDate) : '-' },
    { label: 'Approval / FC Date', val: item.fileApprDate ? formatISOToDDMMYYYY(item.fileApprDate) : '-', required: true },
    { label: 'File Reference No', val: item.fileNoRef || '-', required: true },
    { label: 'Follow Up Cases', val: item.followUp || '-' },
    { label: 'Alert Date', val: item.followUpDate ? formatISOToDDMMYYYY(item.followUpDate) : '-' },
    { label: 'Follow Up Case Closed Date', val: item.followUpClosedDate ? formatISOToDDMMYYYY(item.followUpClosedDate) : '-' },
    { label: 'Remarks', val: item.remarks || '-' },
    { label: 'Office letter number', val: item.sentLetterNo || '-' },
    { label: 'Dispatch Date', val: item.dispatchDate ? formatISOToDDMMYYYY(item.dispatchDate) : (item.sentDate ? formatISOToDDMMYYYY(item.sentDate) : '-') },
    { label: 'Sent To', val: item.sentTo || '-' }
  ];

  bodyContent.innerHTML = fields.map(f => `
    <div style="${f.fullWidth ? 'grid-column: span 2;' : ''} background: rgba(30,41,59,0.7); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
      <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
        ${f.label} ${f.required ? '<span style="color: #ef4444; font-size: 14px; font-weight: 900; line-height: 1;" title="Mandatory Field">*</span>' : ''}
      </span>
      <span style="font-size: 13px; font-weight: 600; color: #f8fafc; word-break: break-word;">${f.val}</span>
    </div>
  `).join('');

  modal.classList.add('active');
}
window.viewRecordDetails = viewRecordDetails;

// -------------------------------------------------------------
// PROGRESSIVE 3-STEP MODAL STEPPER (LEFT -> MIDDLE -> RIGHT)
// WITH STORED STATE & VIEW-ONLY BACKWARD REVIEW
// -------------------------------------------------------------
let currentRegisterStep = 1;
let currentEditStep = 1;

let registerDraft = {
  step1: {},
  step2: {},
  lockedSteps: new Set()
};

let editDraft = {
  step1: {},
  step2: {},
  lockedSteps: new Set()
};

function lockStepInputs(paneId, isLocked) {
  const pane = document.getElementById(paneId);
  if (!pane) return;

  const inputs = pane.querySelectorAll('input, select, textarea');
  inputs.forEach(el => {
    el.disabled = isLocked;
    if (isLocked) {
      el.classList.add('step-input-view-only');
    } else {
      el.classList.remove('step-input-view-only');
    }
  });

  let notice = pane.querySelector('.step-view-only-banner');
  if (isLocked) {
    if (!notice) {
      const cardBox = pane.querySelector('.step-card-box');
      if (cardBox) {
        const div = document.createElement('div');
        div.className = 'step-view-only-banner';
        div.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); padding: 8px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 12px; color: #38bdf8; font-weight: 700;">
            <i class="ri-lock-2-line" style="font-size: 16px; color: #38bdf8;"></i>
            <span>Data Saved & Stored — View Only Access</span>
          </div>
        `;
        cardBox.insertBefore(div, cardBox.firstChild);
      }
    }
  } else {
    if (notice) notice.remove();
  }
}

function unlockStepInputs(paneId) {
  lockStepInputs(paneId, false);
  const stepNum = paneId.includes('1') ? 1 : (paneId.includes('2') ? 2 : 3);
  if (paneId.startsWith('reg')) {
    registerDraft.lockedSteps.delete(stepNum);
  } else {
    editDraft.lockedSteps.delete(stepNum);
  }
}
window.unlockStepInputs = unlockStepInputs;

function saveLiveRegisterDraft() {
  if (!registerDraft || !registerDraft.recordId) return;
  const item = tapalState.find(r => r.id === registerDraft.recordId);
  if (!item) return;

  const tapalType = document.getElementById('form-tapal-type') ? document.getElementById('form-tapal-type').value : '';
  const currNo = cleanCurrNo(document.getElementById('form-curr-no') ? document.getElementById('form-curr-no').value : '');
  const sealDate = getDateInputISO('form-seal-date-text', 'form-seal-date');
  const recSecDate = getDateInputISO('form-rec-sec-date-text', 'form-rec-sec-date');
  const techSecRef = document.getElementById('form-tech-sec-ref') ? document.getElementById('form-tech-sec-ref').value : '';

  const subject = document.getElementById('form-subject') ? document.getElementById('form-subject').value : '';
  const letterRef = document.getElementById('form-letter-ref') ? document.getElementById('form-letter-ref').value : '';
  const letterDate = getDateInputISO('form-letter-date-text', 'form-letter-date');
  const mainOffice = document.getElementById('form-main-office') ? document.getElementById('form-main-office').value : '';
  const officerDesig = document.getElementById('form-officer') ? document.getElementById('form-officer').value : '';
  const shortSub = document.getElementById('form-short-sub') ? document.getElementById('form-short-sub').value : '';
  const status = document.getElementById('form-status') ? document.getElementById('form-status').value : 'Pending';
  const actionInitiated = document.getElementById('form-action-initiated') ? document.getElementById('form-action-initiated').value : '';
  const fileInitDate = getDateInputISO('form-action-init-date-text', 'form-action-init-date');
  const fileApprDate = getDateInputISO('form-appr-fc-date-text', 'form-appr-fc-date');
  const fileNoRef = document.getElementById('form-file-no') ? document.getElementById('form-file-no').value : '';
  const followUp = document.getElementById('form-follow-up') ? document.getElementById('form-follow-up').value : '';
  const followUpDate = getDateInputISO('form-follow-up-date-text', 'form-follow-up-date');
  const remarks = document.getElementById('form-remarks') ? document.getElementById('form-remarks').value : '';
  const empDesig = document.getElementById('form-emp-desig') ? document.getElementById('form-emp-desig').value : '';

  if (tapalType && tapalType !== '__ADD_NEW__' && tapalType !== '__MANAGE_OPTIONS__') item.tapalType = tapalType;
  if (currNo) item.currNo = currNo;
  if (sealDate) item.sealDate = sealDate;
  if (recSecDate) item.recSecDate = recSecDate;
  if (techSecRef && techSecRef !== '__ADD_NEW__' && techSecRef !== '__MANAGE_OPTIONS__') item.techSecRef = techSecRef;
  if (subject) item.subject = subject;
  if (letterRef) item.letterRef = letterRef;
  if (letterDate) item.letterDate = letterDate;
  if (mainOffice && mainOffice !== '__ADD_NEW__' && mainOffice !== '__MANAGE_OPTIONS__') item.mainOffice = mainOffice;
  if (officerDesig && officerDesig !== '__ADD_NEW__' && officerDesig !== '__MANAGE_OPTIONS__') item.officerDesig = officerDesig;
  if (shortSub && shortSub !== '__ADD_NEW__' && shortSub !== '__MANAGE_OPTIONS__') item.shortSub = shortSub;
  if (status) item.status = status;
  if (actionInitiated) item.actionInitiated = actionInitiated;
  if (fileInitDate) item.fileInitDate = fileInitDate;
  if (fileApprDate) item.fileApprDate = fileApprDate;
  if (fileNoRef) item.fileNoRef = fileNoRef;
  if (followUp) item.followUp = followUp;
  if (followUpDate) item.followUpDate = followUpDate;
  if (remarks) item.remarks = remarks;
  if (empDesig && empDesig !== '__ADD_NEW__' && empDesig !== '__MANAGE_OPTIONS__') item.empDesig = empDesig;

  saveTapalStateToLocalStorage();
  renderRegisterTable();
  renderDashboard();
}
window.saveLiveRegisterDraft = saveLiveRegisterDraft;

function manualSaveDraft(mode, step) {
  if (mode === 'register') {
    const tapalType = (document.getElementById('form-tapal-type') ? document.getElementById('form-tapal-type').value : '') || 'Tapal';
    const currNo = cleanCurrNo(document.getElementById('form-curr-no') ? document.getElementById('form-curr-no').value : '');
    const sealDate = getDateInputISO('form-seal-date-text', 'form-seal-date');
    const recSecDate = getDateInputISO('form-rec-sec-date-text', 'form-rec-sec-date') || getTodayISO();
    const techSecRef = document.getElementById('form-tech-sec-ref') ? document.getElementById('form-tech-sec-ref').value : '';

    const subject = document.getElementById('form-subject') ? document.getElementById('form-subject').value : '';
    const letterRef = document.getElementById('form-letter-ref') ? document.getElementById('form-letter-ref').value : '';
    const letterDate = getDateInputISO('form-letter-date-text', 'form-letter-date');
    const mainOffice = document.getElementById('form-main-office') ? document.getElementById('form-main-office').value : '';
    const officerDesig = document.getElementById('form-officer') ? document.getElementById('form-officer').value : '';
    const shortSub = document.getElementById('form-short-sub') ? document.getElementById('form-short-sub').value : '';
    const status = (document.getElementById('form-status') ? document.getElementById('form-status').value : '') || 'Pending';
    const actionInitiated = document.getElementById('form-action-initiated') ? document.getElementById('form-action-initiated').value : '';
    const fileInitDate = getDateInputISO('form-action-init-date-text', 'form-action-init-date');
    const fileApprDate = getDateInputISO('form-appr-fc-date-text', 'form-appr-fc-date');
    const fileNoRef = document.getElementById('form-file-no') ? document.getElementById('form-file-no').value : '';
    const followUp = document.getElementById('form-follow-up') ? document.getElementById('form-follow-up').value : '';
    const followUpDate = getDateInputISO('form-follow-up-date-text', 'form-follow-up-date');
    const remarks = document.getElementById('form-remarks') ? document.getElementById('form-remarks').value : '';
    const empDesig = document.getElementById('form-emp-desig') ? document.getElementById('form-emp-desig').value : '';

    const sentLetterNo = document.getElementById('form-sent-letter-no') ? document.getElementById('form-sent-letter-no').value : '';
    const dispatchDate = getDateInputISO('form-dispatch-date-text', 'form-dispatch-date');
    const sentTo = document.getElementById('form-sent-to') ? document.getElementById('form-sent-to').value : '';

    if (!registerDraft.recordId) {
      const newId = tapalState.length > 0 ? Math.max(...tapalState.map(r => r.id)) + 1 : 1;
      const newSNo = tapalState.length + 1;
      const newRecord = {
        id: newId,
        sNo: newSNo,
        month: 'MAR-2023',
        tapalType: (tapalType && !tapalType.startsWith('__')) ? tapalType : 'Tapal',
        currNo: currNo || `DRAFT-${newId}`,
        sealDate: sealDate || '',
        recSecDate: recSecDate || getTodayISO(),
        subject: subject || '-',
        letterRef: letterRef || '',
        letterDate: letterDate || '',
        shortSub: (shortSub && !shortSub.startsWith('__')) ? shortSub : '',
        mainOffice: (mainOffice && !mainOffice.startsWith('__')) ? mainOffice : '-',
        officerDesig: (officerDesig && !officerDesig.startsWith('__')) ? officerDesig : '-',
        status: status || 'Pending',
        actionInitiated: actionInitiated || '',
        fileInitDate: fileInitDate || '',
        fileApprDate: fileApprDate || '',
        sentLetterNo: sentLetterNo || '',
        dispatchDate: dispatchDate || '',
        sentTo: sentTo || '',
        fileNoRef: fileNoRef || '',
        followUp: followUp || '',
        followUpDate: followUpDate || '',
        remarks: remarks || '',
        techSecRef: (techSecRef && !techSecRef.startsWith('__')) ? techSecRef : '',
        empDesig: (empDesig && !empDesig.startsWith('__')) ? empDesig : '',
        diffSecToInit: 0
      };
      registerDraft.recordId = newId;
      tapalState.unshift(newRecord);
    } else {
      const item = tapalState.find(r => r.id === registerDraft.recordId);
      if (item) {
        if (tapalType && !tapalType.startsWith('__')) item.tapalType = tapalType;
        if (currNo) item.currNo = currNo;
        if (sealDate) item.sealDate = sealDate;
        if (recSecDate) item.recSecDate = recSecDate;
        if (techSecRef && !techSecRef.startsWith('__')) item.techSecRef = techSecRef;
        if (subject) item.subject = subject;
        if (letterRef) item.letterRef = letterRef;
        if (letterDate) item.letterDate = letterDate;
        if (mainOffice && !mainOffice.startsWith('__')) item.mainOffice = mainOffice;
        if (officerDesig && !officerDesig.startsWith('__')) item.officerDesig = officerDesig;
        if (shortSub && !shortSub.startsWith('__')) item.shortSub = shortSub;
        if (status) item.status = status;
        if (actionInitiated) item.actionInitiated = actionInitiated;
        if (fileInitDate) item.fileInitDate = fileInitDate;
        if (fileApprDate) item.fileApprDate = fileApprDate;
        if (fileNoRef) item.fileNoRef = fileNoRef;
        if (followUp) item.followUp = followUp;
        if (followUpDate !== undefined) item.followUpDate = followUpDate;
        if (remarks) item.remarks = remarks;
        if (empDesig && !empDesig.startsWith('__')) item.empDesig = empDesig;
        if (sentLetterNo) item.sentLetterNo = sentLetterNo;
        if (dispatchDate) item.dispatchDate = dispatchDate;
        if (sentTo) item.sentTo = sentTo;
      }
    }
    saveTapalStateToLocalStorage();
    try { renderRegisterTable(); } catch (e) {}
    try { renderDashboard(); } catch (e) {}
    alert('💾 Entry data saved successfully in the Tapal Register! You can continue editing or complete all mandatory fields to proceed to the next step.');
  } else if (mode === 'edit') {
    const recId = parseInt(document.getElementById('edit-record-id').value, 10);
    const item = tapalState.find(r => r.id === recId);
    if (!item) return;

    const tapalType = document.getElementById('edit-tapal-type') ? document.getElementById('edit-tapal-type').value : '';
    const currNo = cleanCurrNo(document.getElementById('edit-curr-no') ? document.getElementById('edit-curr-no').value : '');
    const sealDate = getDateInputISO('edit-seal-date-text', 'edit-seal-date');
    const recSecDate = getDateInputISO('edit-rec-sec-date-text', 'edit-rec-sec-date');
    const techSecRef = document.getElementById('edit-tech-sec-ref') ? document.getElementById('edit-tech-sec-ref').value : '';

    const subject = document.getElementById('edit-subject') ? document.getElementById('edit-subject').value : '';
    const letterRef = document.getElementById('edit-letter-ref') ? document.getElementById('edit-letter-ref').value : '';
    const letterDate = getDateInputISO('edit-letter-date-text', 'edit-letter-date');
    const mainOffice = document.getElementById('edit-main-office') ? document.getElementById('edit-main-office').value : '';
    const officerDesig = document.getElementById('edit-officer') ? document.getElementById('edit-officer').value : '';
    const shortSub = document.getElementById('edit-short-sub') ? document.getElementById('edit-short-sub').value : '';
    const status = document.getElementById('edit-status') ? document.getElementById('edit-status').value : 'Pending';
    const actionInitiated = document.getElementById('edit-action-initiated') ? document.getElementById('edit-action-initiated').value : '';
    const fileInitDate = getDateInputISO('edit-action-init-date-text', 'edit-action-init-date');
    const fileApprDate = getDateInputISO('edit-appr-fc-date-text', 'edit-appr-fc-date');
    const fileNoRef = document.getElementById('edit-file-no') ? document.getElementById('edit-file-no').value : '';
    const followUp = document.getElementById('edit-follow-up') ? document.getElementById('edit-follow-up').value : '';
    const followUpDate = getDateInputISO('edit-follow-up-date-text', 'edit-follow-up-date');
    const remarks = document.getElementById('edit-remarks') ? document.getElementById('edit-remarks').value : '';
    const empDesig = document.getElementById('edit-emp-desig') ? document.getElementById('edit-emp-desig').value : '';

    const sentLetterNo = document.getElementById('edit-sent-letter-no') ? document.getElementById('edit-sent-letter-no').value : '';
    const dispatchDate = getDateInputISO('edit-dispatch-date-text', 'edit-dispatch-date');
    const sentTo = document.getElementById('edit-sent-to') ? document.getElementById('edit-sent-to').value : '';

    if (tapalType && !tapalType.startsWith('__')) item.tapalType = tapalType;
    if (currNo) item.currNo = currNo;
    if (sealDate) item.sealDate = sealDate;
    if (recSecDate) item.recSecDate = recSecDate;
    if (techSecRef && !techSecRef.startsWith('__')) item.techSecRef = techSecRef;
    if (subject) item.subject = subject;
    if (letterRef) item.letterRef = letterRef;
    if (letterDate) item.letterDate = letterDate;
    if (mainOffice && !mainOffice.startsWith('__')) item.mainOffice = mainOffice;
    if (officerDesig && !officerDesig.startsWith('__')) item.officerDesig = officerDesig;
    if (shortSub && !shortSub.startsWith('__')) item.shortSub = shortSub;
    if (status) item.status = status;
    if (actionInitiated) item.actionInitiated = actionInitiated;
    if (fileInitDate) item.fileInitDate = fileInitDate;
    if (fileApprDate) item.fileApprDate = fileApprDate;
    if (fileNoRef) item.fileNoRef = fileNoRef;
    if (followUp) item.followUp = followUp;
    if (followUpDate !== undefined) item.followUpDate = followUpDate;
    if (remarks) item.remarks = remarks;
    if (empDesig && !empDesig.startsWith('__')) item.empDesig = empDesig;
    if (sentLetterNo) item.sentLetterNo = sentLetterNo;
    if (dispatchDate) item.dispatchDate = dispatchDate;
    if (sentTo) item.sentTo = sentTo;

    saveTapalStateToLocalStorage();
    try { renderRegisterTable(); } catch (e) {}
    try { renderDashboard(); } catch (e) {}
    alert('💾 Changes saved successfully into the Tapal Register!');
  }
}
window.manualSaveDraft = manualSaveDraft;

function proceedRegisterStep(fromStep, toStep) {
  if (fromStep === 1) {
    const sealTextEl = document.getElementById('form-seal-date-text');
    const sealDateRaw = getDateInputISO('form-seal-date-text', 'form-seal-date');

    const recSecTextEl = document.getElementById('form-rec-sec-date-text');
    const recSecDateRaw = getDateInputISO('form-rec-sec-date-text', 'form-rec-sec-date');

    if (!sealDateRaw) {
      showToast('Please enter a valid Office Seal Date (DD/MM/YYYY) before proceeding.', 'error');
      if (sealTextEl) {
        sealTextEl.style.borderColor = '#ef4444';
        sealTextEl.focus();
      }
      return false;
    }

    if (!recSecDateRaw) {
      showToast('Please enter a valid Received in Section Date (DD/MM/YYYY) before proceeding.', 'error');
      if (recSecTextEl) {
        recSecTextEl.style.borderColor = '#ef4444';
        recSecTextEl.focus();
      }
      return false;
    }

    if (globalDateLockState) {
      const today = getTodayISO();
      if (sealDateRaw > today) {
        showToast('Office Seal Date cannot be in the future when Date Lock is active.', 'error');
        if (sealTextEl) { sealTextEl.style.borderColor = '#ef4444'; sealTextEl.focus(); }
        return false;
      }
      if (recSecDateRaw > today) {
        showToast('Section Receipt Date cannot be in the future when Date Lock is active.', 'error');
        if (recSecTextEl) { recSecTextEl.style.borderColor = '#ef4444'; recSecTextEl.focus(); }
        return false;
      }
    }

    // Logical date sequence check
    if (sealDateRaw && recSecDateRaw && sealDateRaw > recSecDateRaw) {
      showToast('Received in Section Date cannot be earlier than Office Seal Date.', 'error');
      if (recSecTextEl) {
        recSecTextEl.style.borderColor = '#ef4444';
        recSecTextEl.focus();
      }
      return false;
    }

    const tapalType = (document.getElementById('form-tapal-type') ? document.getElementById('form-tapal-type').value : '') || 'Tapal';
    const currNoEl = document.getElementById('form-curr-no');
    const currNo = cleanCurrNo(currNoEl ? currNoEl.value : '');
    if (currNoEl) currNoEl.value = currNo;

    if (!currNo) {
      showToast('Please enter a valid Current Number (Inward No).', 'error');
      if (currNoEl) { currNoEl.style.borderColor = '#ef4444'; currNoEl.focus(); }
      return false;
    }

    // Enforce uniqueness like a Primary Key
    const duplicate = tapalState.find(r => r.currNo === currNo && r.id !== registerDraft.recordId);
    if (duplicate) {
      showToast(`Current Number "${currNo}" already exists in the Tapal Register!`, 'error');
      if (currNoEl) {
        currNoEl.style.borderColor = '#ef4444';
        currNoEl.focus();
        currNoEl.select();
      }
      return false;
    }

    const techSecRefEl = document.getElementById('form-tech-sec-ref');
    const techSecRef = techSecRefEl ? techSecRefEl.value : '';

    if (!techSecRef || techSecRef === '__ADD_NEW__' || techSecRef === '__MANAGE_OPTIONS__') {
      showToast('Please select Section before proceeding.', 'error');
      if (techSecRefEl) {
        techSecRefEl.style.borderColor = '#ef4444';
        techSecRefEl.focus();
      }
      return false;
    }

    registerDraft.step1 = { tapalType, currNo, sealDate: sealDateRaw, recSecDate: recSecDateRaw, techSecRef };
    registerDraft.lockedSteps.add(1);
    lockStepInputs('reg-step-pane-1', true);

    handleFormStatusAndSectionVisibility('register');
  }

  if (fromStep === 2) {
    const status = (document.getElementById('form-status') ? document.getElementById('form-status').value : '') || 'Pending';
    const isFiled = status === 'Filed';

    const subject = (document.getElementById('form-subject') ? document.getElementById('form-subject').value.trim() : '');
    const mainOffice = document.getElementById('form-main-office') ? document.getElementById('form-main-office').value : 'SE';
    const officer = document.getElementById('form-officer') ? document.getElementById('form-officer').value : '';
    const shortSub = document.getElementById('form-short-sub') ? document.getElementById('form-short-sub').value : '';
    const letterDateTextEl = document.getElementById('form-letter-date-text');
    const letterDateRaw = getDateInputISO('form-letter-date-text', 'form-letter-date');

    if (!subject) {
      showToast('Please enter Subject.', 'error');
      const subInput = document.getElementById('form-subject');
      if (subInput) { subInput.style.borderColor = '#ef4444'; subInput.focus(); }
      return false;
    }

    const actInitTextEl = document.getElementById('form-action-init-date-text');
    const actInitDateRaw = getDateInputISO('form-action-init-date-text', 'form-action-init-date');

    // Action Date mandatory check when status is not Pending or action is initiated
    if (!isFiled && status !== 'Pending' && !actInitDateRaw) {
      showToast(`Action Initiated Date is mandatory for status '${status}'.`, 'error');
      if (actInitTextEl) { actInitTextEl.style.borderColor = '#ef4444'; actInitTextEl.focus(); }
      return false;
    }

    const fileNoEl = document.getElementById('form-file-no');
    const fileNo = fileNoEl ? fileNoEl.value.trim() : '';
    if (!fileNo) {
      showToast('Please provide File Reference No before proceeding.', 'error');
      if (fileNoEl) { fileNoEl.style.borderColor = '#ef4444'; fileNoEl.focus(); }
      return false;
    }

    const apprFcTextEl = document.getElementById('form-appr-fc-date-text');
    const apprFcDateRaw = getDateInputISO('form-appr-fc-date-text', 'form-appr-fc-date');
    
    // Approval date required only when NOT Filed
    if (!isFiled && ['Letter', 'Memo', 'Proceeding'].includes(status) && !apprFcDateRaw) {
      showToast(`Approval/FC Date is mandatory for status '${status}'.`, 'error');
      if (apprFcTextEl) { apprFcTextEl.style.borderColor = '#ef4444'; apprFcTextEl.focus(); }
      return false;
    }

    if (globalDateLockState) {
      const today = getTodayISO();
      if (letterDateRaw && letterDateRaw > today) {
        showToast('Letter Date cannot be in the future when Date Lock is active.', 'error');
        return false;
      }
      if (apprFcDateRaw && apprFcDateRaw > today) {
        showToast('Approval/FC Date cannot be in the future when Date Lock is active.', 'error');
        return false;
      }
    }

    const empDesigEl = document.getElementById('form-emp-desig');
    const empDesig = empDesigEl ? empDesigEl.value : '';
    if (!empDesig || empDesig === '__ADD_NEW__' || empDesig === '__MANAGE_OPTIONS__') {
      showToast('Please select Employee Designation before proceeding.', 'error');
      if (empDesigEl) { empDesigEl.style.borderColor = '#ef4444'; empDesigEl.focus(); }
      return false;
    }

    if (isFiled) {
      const actInitEl = document.getElementById('form-action-initiated');
      const actInitDateEl = document.getElementById('form-action-init-date');
      const actInitDateTextEl = document.getElementById('form-action-init-date-text');
      if (actInitEl && (!actInitEl.value || actInitEl.value.trim() === '')) {
        actInitEl.value = 'Filed';
      }
      if (actInitDateEl && (!actInitDateEl.value || actInitDateEl.value.trim() === '')) {
        const today = getTodayISO();
        actInitDateEl.value = today;
        if (actInitDateTextEl) actInitDateTextEl.value = formatISOToDDMMYYYY(today);
      }
      // If Filed, save directly from Step 2!
      saveTapalEntryRecord('register');
      return true;
    }

    const fUpDateTextEl = document.getElementById('form-follow-up-date-text');
    const fUpDateRaw = getDateInputISO('form-follow-up-date-text', 'form-follow-up-date');

    registerDraft.step2 = {
      subject,
      letterRef: (document.getElementById('form-letter-ref') ? document.getElementById('form-letter-ref').value : ''),
      letterDate: letterDateRaw,
      mainOffice,
      officerDesig: officer,
      shortSub,
      status,
      actionInitiated: (document.getElementById('form-action-initiated') ? document.getElementById('form-action-initiated').value : ''),
      fileInitDate: actInitDateRaw,
      fileApprDate: apprFcDateRaw,
      fileNoRef: fileNo,
      followUp: (document.getElementById('form-follow-up') ? document.getElementById('form-follow-up').value : ''),
      followUpDate: fUpDateRaw || '',
      remarks: (document.getElementById('form-remarks') ? document.getElementById('form-remarks').value : ''),
      techSecRef: (document.getElementById('form-tech-sec-ref') ? document.getElementById('form-tech-sec-ref').value : ''),
      empDesig: (document.getElementById('form-emp-desig') ? document.getElementById('form-emp-desig').value : '')
    };

    registerDraft.lockedSteps.add(2);
    lockStepInputs('reg-step-pane-2', true);

    syncDispatchBadgeSummary('register');
    handleFormStatusAndSectionVisibility('register');
  }

  goToRegisterStep(toStep);
  return true;
}

function openEditRecordModal(id) {
  if (id === undefined || id === null || id === '') return;
  const idStr = String(id).trim();
  const item = tapalState.find(r => String(r.id) === idStr || String(r.sNo) === idStr || String(r.currNo) === idStr);
  if (!item) return;

  const modal = document.getElementById('edit-tapal-modal');
  const snoTitle = document.getElementById('edit-modal-title-sno');
  if (!modal) return;

  if (snoTitle) snoTitle.innerText = `#${item.sNo}`;

  document.getElementById('edit-record-id').value = item.id;
  document.getElementById('edit-tapal-type').value = item.tapalType || 'Tapal';
  document.getElementById('edit-curr-no').value = item.currNo || '';

  setDateInputValues('edit-seal-date-text', 'edit-seal-date', item.sealDate || '');
  setDateInputValues('edit-rec-sec-date-text', 'edit-rec-sec-date', item.recSecDate || '');

  document.getElementById('edit-subject').value = item.subject || '';
  document.getElementById('edit-letter-ref').value = item.letterRef || '';

  setDateInputValues('edit-letter-date-text', 'edit-letter-date', item.letterDate || '');

  document.getElementById('edit-main-office').value = item.mainOffice || 'SE';
  const canonicalSec = (typeof getCanonicalSectionCode === 'function') ? getCanonicalSectionCode(item.techSecRef || '') : (item.techSecRef || '');
  document.getElementById('edit-tech-sec-ref').value = canonicalSec;

  updateOfficerModalDropdown('edit', item.officerDesig);
  updateShortSubModalDropdown('edit', item.shortSub);
  updateEmpDesigModalDropdown('edit', item.empDesig);

  if (document.getElementById('edit-officer') && item.officerDesig) {
    document.getElementById('edit-officer').value = item.officerDesig;
  }
  if (document.getElementById('edit-short-sub') && item.shortSub) {
    document.getElementById('edit-short-sub').value = item.shortSub;
  }
  if (document.getElementById('edit-emp-desig') && item.empDesig) {
    document.getElementById('edit-emp-desig').value = item.empDesig;
  }

  document.getElementById('edit-status').value = item.status || 'Pending';
  document.getElementById('edit-action-initiated').value = item.actionInitiated || '';

  setDateInputValues('edit-action-init-date-text', 'edit-action-init-date', item.fileInitDate || '');
  setDateInputValues('edit-appr-fc-date-text', 'edit-appr-fc-date', item.fileApprDate || '');

  document.getElementById('edit-file-no').value = item.fileNoRef || '';
  document.getElementById('edit-follow-up').value = item.followUp || '';

  setDateInputValues('edit-follow-up-date-text', 'edit-follow-up-date', item.followUpDate || '');

  document.getElementById('edit-remarks').value = item.remarks || '';
  document.getElementById('edit-sent-letter-no').value = item.sentLetterNo || '';

  const accRefEl = document.getElementById('edit-accounts-ref-no');
  if (accRefEl) accRefEl.value = item.accountsRefNo || '';

  const currentDispDate = item.dispatchDate || getTodayISO();
  setDateInputValues('edit-dispatch-date-text', 'edit-dispatch-date', currentDispDate);

  document.getElementById('edit-sent-to').value = item.sentTo || '';
  editSentToTags = item.sentTo ? item.sentTo.split(',').map(s => s.trim()).filter(Boolean) : [];
  renderSentToTags('edit');

  syncDispatchBadgeSummary('edit');
  handleFormStatusAndSectionVisibility('edit');
  renderEditReminderList(item.id);

  const lockedSteps = new Set([1]);
  if (item.status === 'Filed') lockedSteps.add(2);
  if (item.dispatchCompleted) lockedSteps.add(3);

  editDraft = { step1: {}, step2: {}, lockedSteps: lockedSteps };
  lockStepInputs('edit-step-pane-1', true);
  lockStepInputs('edit-step-pane-2', item.status === 'Filed');
  lockStepInputs('edit-step-pane-3', !!item.dispatchCompleted);

  goToEditStep(1);
  const todayISO = getTodayISO();
  document.querySelectorAll('#edit-tapal-modal .custom-native-date-picker').forEach(dp => {
    if (globalDateLockState) {
      dp.max = todayISO;
      dp.removeAttribute('min');
    } else {
      dp.removeAttribute('max');
      dp.removeAttribute('min');
    }
  });
  bindAllDateInputsInDOM();
  modal.classList.add('active');
}

function initEditModalEvents() {
  const modal = document.getElementById('edit-tapal-modal');
  const closeBtn = document.getElementById('btn-close-edit-modal');
  const cancelBtn = document.getElementById('btn-cancel-edit-modal');
  const form = document.getElementById('edit-tapal-form');

  const viewModal = document.getElementById('view-tapal-modal');
  const closeViewBtn = document.getElementById('btn-close-view-modal');
  const doneViewBtn = document.getElementById('btn-done-view-modal');

  if (closeViewBtn && viewModal) closeViewBtn.onclick = () => viewModal.classList.remove('active');
  if (doneViewBtn && viewModal) doneViewBtn.onclick = () => viewModal.classList.remove('active');

  if (closeBtn && modal) closeBtn.onclick = () => modal.classList.remove('active');
  if (cancelBtn && modal) cancelBtn.onclick = () => modal.classList.remove('active');

  const editMainOffice = document.getElementById('edit-main-office');
  if (editMainOffice) {
    editMainOffice.onchange = () => {
      updateOfficerAndShortSubDropdowns('edit');
    };
  }

  const editStatus = document.getElementById('edit-status');
  if (editStatus) {
    editStatus.onchange = () => {
      const recId = parseInt(document.getElementById('edit-record-id').value, 10);
      const item = tapalState.find(r => r.id === recId);
      if (editStatus.value === 'Filed' && item && (item.sentLetterNo || item.dispatchDate || item.sentTo)) {
        showToast('⚠️ Note: Status "Filed" will clear dispatch details upon saving.', 'info');
      }
      handleFormStatusAndSectionVisibility('edit');
    };
  }

  const editTechSec = document.getElementById('edit-tech-sec-ref');
  if (editTechSec) {
    editTechSec.onchange = () => {
      updateEmpDesigModalDropdown('edit');
      handleFormStatusAndSectionVisibility('edit');
    };
  }

  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      saveTapalEntryRecord('edit');
    };
  }
}
window.openEditRecordModal = openEditRecordModal;

function proceedEditStep(fromStep, toStep) {
  if (fromStep === 1) {
    const editSealTextEl = document.getElementById('edit-seal-date-text');
    const editSealDateRaw = getDateInputISO('edit-seal-date-text', 'edit-seal-date');
    const editRecSecTextEl = document.getElementById('edit-rec-sec-date-text');
    const editRecSecDateRaw = getDateInputISO('edit-rec-sec-date-text', 'edit-rec-sec-date');

    const editSecRefEl = document.getElementById('edit-tech-sec-ref');
    const editSecRef = editSecRefEl ? editSecRefEl.value : '';

    if (!editSealDateRaw) {
      showToast('Please enter a valid Office Seal Date (DD/MM/YYYY) before proceeding.', 'error');
      if (editSealTextEl) { editSealTextEl.style.borderColor = '#ef4444'; editSealTextEl.focus(); }
      return false;
    }

    if (!editRecSecDateRaw) {
      showToast('Please enter a valid Received in Section Date (DD/MM/YYYY) before proceeding.', 'error');
      if (editRecSecTextEl) { editRecSecTextEl.style.borderColor = '#ef4444'; editRecSecTextEl.focus(); }
      return false;
    }

    if (!editSecRef || editSecRef === '__ADD_NEW__' || editSecRef === '__MANAGE_OPTIONS__') {
      showToast('Please select Section before proceeding.', 'error');
      if (editSecRefEl) { editSecRefEl.style.borderColor = '#ef4444'; editSecRefEl.focus(); }
      return false;
    }
    const editCurrNo = cleanCurrNo(document.getElementById('edit-curr-no').value);
    const recId = parseInt(document.getElementById('edit-record-id').value, 10);

    if (!editCurrNo) {
      showToast('Please enter a valid Current Number (Inward No).', 'error');
      const inputEl = document.getElementById('edit-curr-no');
      if (inputEl) inputEl.focus();
      return false;
    }

    const duplicate = tapalState.find(r => r.currNo === editCurrNo && r.id !== recId);
    if (duplicate) {
      showToast(`Current Number "${editCurrNo}" already exists in the Tapal Register!`, 'error');
      const inputEl = document.getElementById('edit-curr-no');
      if (inputEl) { inputEl.style.borderColor = '#ef4444'; inputEl.focus(); inputEl.select(); }
      return false;
    }

    if (globalDateLockState) {
      const today = getTodayISO();
      if (editSealDateRaw && editSealDateRaw > today) {
        showToast('Office Seal Date cannot be in the future when Date Lock is active.', 'error');
        if (editSealTextEl) { editSealTextEl.style.borderColor = '#ef4444'; editSealTextEl.focus(); }
        return false;
      }
      if (editRecSecDateRaw && editRecSecDateRaw > today) {
        showToast('Section Receipt Date cannot be in the future when Date Lock is active.', 'error');
        if (editRecSecTextEl) { editRecSecTextEl.style.borderColor = '#ef4444'; editRecSecTextEl.focus(); }
        return false;
      }
    }

    lockStepInputs('edit-step-pane-1', true);
    handleFormStatusAndSectionVisibility('edit');
  }

  if (fromStep === 2) {
    const editStatus = (document.getElementById('edit-status') ? document.getElementById('edit-status').value : '') || 'Pending';
    const isFiled = editStatus === 'Filed';

    const editSubject = (document.getElementById('edit-subject') ? document.getElementById('edit-subject').value.trim() : '');
    const editLetterDateTextEl = document.getElementById('edit-letter-date-text');
    const editLetterDateRaw = getDateInputISO('edit-letter-date-text', 'edit-letter-date');

    if (!editSubject) {
      showToast('Please enter Subject.', 'error');
      const subInput = document.getElementById('edit-subject');
      if (subInput) { subInput.style.borderColor = '#ef4444'; subInput.focus(); }
      return false;
    }

    const editActInitTextEl = document.getElementById('edit-action-init-date-text');
    const editActInitDateRaw = getDateInputISO('edit-action-init-date-text', 'edit-action-init-date');

    // Mandatory Action Date for any changes done in pending or when updating record
    if (!isFiled && !editActInitDateRaw) {
      showToast('Action Initiated Date is mandatory when updating/making changes to a Tapal record.', 'error');
      if (editActInitTextEl) { editActInitTextEl.style.borderColor = '#ef4444'; editActInitTextEl.focus(); }
      return false;
    }

    const editFileNoEl = document.getElementById('edit-file-no');
    const editFileNo = editFileNoEl ? editFileNoEl.value.trim() : '';
    if (!editFileNo) {
      showToast('Please provide File Reference No before proceeding.', 'error');
      if (editFileNoEl) { editFileNoEl.style.borderColor = '#ef4444'; editFileNoEl.focus(); }
      return false;
    }

    const editApprFcTextEl = document.getElementById('edit-appr-fc-date-text');
    const editApprFcDateRaw = getDateInputISO('edit-appr-fc-date-text', 'edit-appr-fc-date');

    // Approval date required only when NOT Filed
    if (!isFiled && ['Letter', 'Memo', 'Proceeding'].includes(editStatus) && !editApprFcDateRaw) {
      showToast(`Approval/FC Date is mandatory for status '${editStatus}'.`, 'error');
      if (editApprFcTextEl) { editApprFcTextEl.style.borderColor = '#ef4444'; editApprFcTextEl.focus(); }
      return false;
    }

    if (globalDateLockState) {
      const today = getTodayISO();
      if (editLetterDateRaw && editLetterDateRaw > today) {
        showToast('Letter Date cannot be in the future when Date Lock is active.', 'error');
        return false;
      }
      if (editApprFcDateRaw && editApprFcDateRaw > today) {
        showToast('Approval/FC Date cannot be in the future when Date Lock is active.', 'error');
        return false;
      }
    }

    const editEmpDesigEl = document.getElementById('edit-emp-desig');
    const editEmpDesig = editEmpDesigEl ? editEmpDesigEl.value : '';
    if (!editEmpDesig || editEmpDesig === '__ADD_NEW__' || editEmpDesig === '__MANAGE_OPTIONS__') {
      showToast('Please select Employee Designation before proceeding.', 'error');
      if (editEmpDesigEl) { editEmpDesigEl.style.borderColor = '#ef4444'; editEmpDesigEl.focus(); }
      return false;
    }

    if (isFiled) {
      const editActInitEl = document.getElementById('edit-action-initiated');
      const editActInitDateEl = document.getElementById('edit-action-init-date');
      const editActInitDateTextEl = document.getElementById('edit-action-init-date-text');
      if (editActInitEl && (!editActInitEl.value || editActInitEl.value.trim() === '')) {
        editActInitEl.value = 'Filed';
      }
      if (editActInitDateEl && (!editActInitDateEl.value || editActInitDateEl.value.trim() === '')) {
        const today = getTodayISO();
        editActInitDateEl.value = today;
        if (editActInitDateTextEl) editActInitDateTextEl.value = formatISOToDDMMYYYY(today);
      }
      saveTapalEntryRecord('edit');
      return true;
    }

    syncDispatchBadgeSummary('edit');
    handleFormStatusAndSectionVisibility('edit');
  }

  goToEditStep(toStep);
  return true;
}

// =============================================================
// UNIFIED TAPAL ENTRY RECORD PERSISTENCE
// =============================================================
async function saveTapalEntryRecord(mode) {
  const isEdit = mode === 'edit';
  const prefix = isEdit ? 'edit-' : 'form-';
  const panePrefix = isEdit ? 'edit-step-pane-' : 'reg-step-pane-';
  const modalId = isEdit ? 'edit-tapal-modal' : 'register-modal';
  const modal = document.getElementById(modalId);
  const form = document.getElementById(isEdit ? 'edit-tapal-form' : 'tapal-form');

  const submitBtn = isEdit ? (document.querySelector('#edit-tapal-modal button[type="submit"]') || document.getElementById('btn-edit-step2-next')) : (document.querySelector('#register-modal button[type="submit"]') || document.getElementById('btn-reg-step2-next'));
  let origBtnHtml = '';
  if (submitBtn) {
    origBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="btn-spinner"></span> Saving...`;
  }

  try {
    lockStepInputs(`${panePrefix}1`, false);
    lockStepInputs(`${panePrefix}2`, false);
    lockStepInputs(`${panePrefix}3`, false);

    const currNoEl = document.getElementById(`${prefix}curr-no`);
    const currNo = cleanCurrNo(currNoEl ? currNoEl.value : '');
    const recId = isEdit ? parseInt(document.getElementById('edit-record-id').value, 10) : (registerDraft.recordId || null);

    if (!currNo) {
      showToast('Please enter a valid Current Number (Inward No).', 'error');
      goToStepMode(mode, 1);
      return;
    }

    const duplicate = tapalState.find(r => r.currNo === currNo && r.id !== recId);
    if (duplicate) {
      showToast(`Current Number "${currNo}" already exists in the Tapal Register!`, 'error');
      goToStepMode(mode, 1);
      return;
    }

    const statusEl = document.getElementById(`${prefix}status`);
    const status = statusEl ? statusEl.value : 'Pending';
    const isFiled = status === 'Filed';

    const sealDate = getDateInputISO(`${prefix}seal-date-text`, `${prefix}seal-date`);
    const recSecDate = getDateInputISO(`${prefix}rec-sec-date-text`, `${prefix}rec-sec-date`) || getTodayISO();
    const letterDate = getDateInputISO(`${prefix}letter-date-text`, `${prefix}letter-date`);
    const fileInitDate = getDateInputISO(`${prefix}action-init-date-text`, `${prefix}action-init-date`);
    const fileApprDate = getDateInputISO(`${prefix}appr-fc-date-text`, `${prefix}appr-fc-date`);
    const followUpDate = getDateInputISO(`${prefix}follow-up-date-text`, `${prefix}follow-up-date`);
    let dispatchDate = getDateInputISO(`${prefix}dispatch-date-text`, `${prefix}dispatch-date`);

    const actInitDateText = document.getElementById(`${prefix}action-init-date-text`);
    const techSecRef = (document.getElementById(`${prefix}tech-sec-ref`) ? document.getElementById(`${prefix}tech-sec-ref`).value : '') || '';
    const empDesig = (document.getElementById(`${prefix}emp-desig`) ? document.getElementById(`${prefix}emp-desig`).value : '') || '';
    const mainOffice = (document.getElementById(`${prefix}main-office`) ? document.getElementById(`${prefix}main-office`).value : '') || 'SE';
    const officerDesig = (document.getElementById(`${prefix}officer`) ? document.getElementById(`${prefix}officer`).value : '') || '';
    const shortSub = (document.getElementById(`${prefix}short-sub`) ? document.getElementById(`${prefix}short-sub`).value : '') || '';
    const subject = (document.getElementById(`${prefix}subject`) ? document.getElementById(`${prefix}subject`).value.trim() : '') || '-';
    const letterRef = (document.getElementById(`${prefix}letter-ref`) ? document.getElementById(`${prefix}letter-ref`).value.trim() : '') || '';
    const fileNoRef = (document.getElementById(`${prefix}file-no`) ? document.getElementById(`${prefix}file-no`).value.trim() : '') || '';
    const actionInitiated = (document.getElementById(`${prefix}action-initiated`) ? document.getElementById(`${prefix}action-initiated`).value.trim() : '') || '';
    const followUp = (document.getElementById(`${prefix}follow-up`) ? document.getElementById(`${prefix}follow-up`).value.trim() : '') || '';
    const remarks = (document.getElementById(`${prefix}remarks`) ? document.getElementById(`${prefix}remarks`).value.trim() : '') || '';

    if (globalDateLockState) {
      const today = getTodayISO();
      if (sealDate && sealDate > today) {
        showToast('Office Seal Date cannot be in the future when Date Lock is active.', 'error');
        goToStepMode(mode, 1);
        return;
      }
      if (recSecDate && recSecDate > today) {
        showToast('Section Receipt Date cannot be in the future when Date Lock is active.', 'error');
        goToStepMode(mode, 1);
        return;
      }
      if (letterDate && letterDate > today) {
        showToast('Letter Date cannot be in the future when Date Lock is active.', 'error');
        goToStepMode(mode, 2);
        return;
      }
      if (fileApprDate && fileApprDate > today) {
        showToast('Approval/FC Date cannot be in the future when Date Lock is active.', 'error');
        goToStepMode(mode, 2);
        return;
      }
      if (dispatchDate && dispatchDate > today) {
        showToast('Dispatch Date cannot be in the future when Date Lock is active.', 'error');
        goToStepMode(mode, 3);
        return;
      }
    }

    if (!isFiled && ['Letter', 'Memo', 'Proceeding'].includes(status) && !fileApprDate) {
      showToast(`Approval/FC Date is mandatory for status '${status}'.`, 'error');
      goToStepMode(mode, 2);
      return;
    }

    // Mandatory Action Date when updating a record or when status is not Pending
    if (!isFiled && (isEdit || status !== 'Pending' || actionInitiated) && !fileInitDate) {
      showToast('Action Initiated Date is mandatory.', 'error');
      if (actInitDateText) { actInitDateText.style.borderColor = '#ef4444'; actInitDateText.focus(); }
      goToStepMode(mode, 2);
      return;
    }

    let sentLetterNo = '';
    let sentTo = '';
    let accountsRefNo = '';

    if (!isFiled) {
      sentLetterNo = document.getElementById(`${prefix}sent-letter-no`) ? document.getElementById(`${prefix}sent-letter-no`).value.trim() : '';
      sentTo = document.getElementById(`${prefix}sent-to`) ? document.getElementById(`${prefix}sent-to`).value.trim() : '';
      if (techSecRef === 'Accounts') {
        const accEl = document.getElementById(`${prefix}accounts-ref-no`);
        accountsRefNo = accEl ? accEl.value.trim() : '';
      }
      if (!sentLetterNo) {
        showToast('Please enter compulsory Office letter number.', 'error');
        goToStepMode(mode, 3);
        return;
      }
      if (!dispatchDate) {
        showToast('Please select Dispatch Date.', 'error');
        goToStepMode(mode, 3);
        return;
      }
    }
    let finalActionInitiated = actionInitiated;
    let finalFileInitDate = fileInitDate;
    if (isFiled) {
      if (!finalActionInitiated || finalActionInitiated.trim() === '') {
        finalActionInitiated = 'Filed';
      }
      if (!finalFileInitDate) {
        finalFileInitDate = getTodayISO();
      }
      dispatchDate = null;
      sentLetterNo = null;
      sentTo = null;
      accountsRefNo = null;
    }

    const tapalType = (document.getElementById(`${prefix}tapal-type`) ? document.getElementById(`${prefix}tapal-type`).value : '') || 'Tapal';

    const payload = {
      tapalType,
      currNo,
      sealDate: sealDate || null,
      recSecDate,
      subject,
      letterRef,
      letterDate: letterDate || null,
      shortSub,
      mainOffice,
      officerDesig,
      status,
      actionInitiated: finalActionInitiated || null,
      fileInitDate: finalFileInitDate || null,
      fileApprDate: isFiled ? (fileApprDate || null) : (fileApprDate || null),
      sentLetterNo: isFiled ? null : (sentLetterNo || null),
      dispatchDate: isFiled ? null : (dispatchDate || null),
      sentTo: isFiled ? null : (sentTo || null),
      fileNoRef,
      followUp,
      followUpDate: followUpDate || null,
      remarks,
      techSecRef,
      empDesig,
      accountsRefNo: isFiled ? null : (accountsRefNo || null),
      dispatchCompleted: isFiled ? false : (!!(sentLetterNo && dispatchDate))
    };

    let savedRecordId = recId;
    try {
      const url = isEdit && recId ? `/api/tapal/${recId}` : '/api/tapal';
      const method = isEdit && recId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const savedData = await res.json();
        if (savedData && savedData.id) savedRecordId = savedData.id;
      }
    } catch (apiErr) {
      console.warn('Backend API unavailable, saving to local store:', apiErr);
    }

    if (isEdit && recId) {
      let record = tapalState.find(r => r.id === recId);
      if (record) {
        Object.assign(record, payload, { id: recId, currNo });
      }
    } else {
      const newId = savedRecordId || (tapalState.length > 0 ? Math.max(...tapalState.map(r => r.id)) + 1 : 1);
      const newSNo = tapalState.length + 1;
      const newRecord = {
        ...payload,
        id: newId,
        sNo: newSNo,
        month: 'MAR-2023'
      };
      tapalState.unshift(newRecord);
    }

    saveTapalStateToLocalStorage();

    // Clean drafts and close modal safely
    try {
      if (isEdit) {
        editDraft = { step1: {}, step2: {}, lockedSteps: new Set() };
        editSentToTags = [];
        renderSentToTags('edit');
      } else {
        registerDraft = { step1: {}, step2: {}, lockedSteps: new Set(), recordId: null };
        registerSentToTags = [];
        renderSentToTags('register');
        if (form) form.reset();
      }
    } catch (cleanErr) {
      console.warn('Draft cleanup notice:', cleanErr);
    }

    // Auto-close modal
    if (modal) modal.classList.remove('active');

    // Show success toast immediately
    showToast(`Tapal Inward #${currNo} saved successfully!`, 'success');

    // Asynchronously trigger UI refreshes so they can never block or affect save status
    setTimeout(() => {
      try { if (typeof renderDashboard === 'function') renderDashboard(); } catch (e) { console.warn('renderDashboard notice:', e); }
      try { if (typeof renderRegisterTable === 'function') renderRegisterTable(); } catch (e) { console.warn('renderRegisterTable notice:', e); }
      try { if (typeof renderKanbanPipeline === 'function') renderKanbanPipeline(); } catch (e) { console.warn('renderKanbanPipeline notice:', e); }
      try { if (typeof renderSLAAnalytics === 'function') renderSLAAnalytics(); } catch (e) { console.warn('renderSLAAnalytics notice:', e); }
      try { if (typeof renderFollowUpModule === 'function') renderFollowUpModule(); } catch (e) { console.warn('renderFollowUpModule notice:', e); }
      try { if (typeof renderDashboardFollowUpAlerts === 'function') renderDashboardFollowUpAlerts(); } catch (e) { console.warn('renderDashboardFollowUpAlerts notice:', e); }
    }, 10);

  } catch (err) {
    console.error('Error saving tapal record:', err);
    if (!err.message || !err.message.toLowerCase().includes('getcontext')) {
      showToast(`Error: ${err.message || 'Failed to save entry.'}`, 'error');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml || (isEdit ? 'Update Tapal Entry' : 'Complete Tapal Entry');
    }
  }
}
window.saveTapalEntryRecord = saveTapalEntryRecord;

function goToStepMode(mode, stepNum) {
  if (mode === 'edit') {
    goToEditStep(stepNum);
  } else {
    goToRegisterStep(stepNum);
  }
}


function onRegisterTabClick(targetStep) {
  const status = (document.getElementById('form-status') ? document.getElementById('form-status').value : '') || 'Pending';
  if (status === 'Filed' && targetStep === 3) {
    showToast('Filed tapals do not have dispatch details.', 'info');
    return;
  }
  if (targetStep === currentRegisterStep) return;
  if (targetStep < currentRegisterStep) {
    goToRegisterStep(targetStep);
    return;
  }
  if (currentRegisterStep === 1) {
    const s1Ok = proceedRegisterStep(1, 2);
    if (!s1Ok) return;
    if (targetStep === 3) {
      if (status === 'Filed') return;
      proceedRegisterStep(2, 3);
    }
  } else if (currentRegisterStep === 2) {
    if (status === 'Filed') return;
    proceedRegisterStep(2, 3);
  }
}
window.onRegisterTabClick = onRegisterTabClick;

function onEditTabClick(targetStep) {
  const status = (document.getElementById('edit-status') ? document.getElementById('edit-status').value : '') || 'Pending';
  if (status === 'Filed' && targetStep === 3) {
    showToast('Filed tapals do not have dispatch details.', 'info');
    return;
  }
  if (targetStep === currentEditStep) return;
  if (targetStep < currentEditStep) {
    goToEditStep(targetStep);
    return;
  }
  if (currentEditStep === 1) {
    const s1Ok = proceedEditStep(1, 2);
    if (!s1Ok) return;
    if (targetStep === 3) {
      if (status === 'Filed') return;
      proceedEditStep(2, 3);
    }
  } else if (currentEditStep === 2) {
    if (status === 'Filed') return;
    proceedEditStep(2, 3);
  }
}
window.onEditTabClick = onEditTabClick;

window.proceedRegisterStep = proceedRegisterStep;
window.proceedEditStep = proceedEditStep;

function goToRegisterStep(step) {
  const status = (document.getElementById('form-status') ? document.getElementById('form-status').value : '') || 'Pending';
  if (status === 'Filed' && step === 3) step = 2;
  currentRegisterStep = step;
  if (step === 2) {
    const secVal = (document.getElementById('form-tech-sec-ref') ? document.getElementById('form-tech-sec-ref').value : '') || (registerDraft.step1 ? registerDraft.step1.techSecRef : '');
    const selSecDisplay = document.getElementById('form-selected-section-text');
    if (selSecDisplay) {
      selSecDisplay.innerText = secVal || '-- Not Selected in Step 1 --';
    }
    updateEmpDesigModalDropdown('register');
    updateOfficerModalDropdown('register');
    updateShortSubModalDropdown('register');
  }
  if (step === 3) {
    const dispPicker = document.getElementById('form-dispatch-date');
    const dispText = document.getElementById('form-dispatch-date-text');
    if (dispPicker) {
      if (globalDateLockState) {
        dispPicker.max = getTodayISO();
        dispPicker.removeAttribute('min');
      } else {
        dispPicker.removeAttribute('max');
        dispPicker.removeAttribute('min');
      }
      if (!dispPicker.value && (!dispText || !dispText.value.trim())) {
        dispPicker.value = getTodayISO();
        if (dispText) dispText.value = formatISOToDDMMYYYY(getTodayISO());
      }
    }
  }
  const panes = ['reg-step-pane-1', 'reg-step-pane-2', 'reg-step-pane-3'];
  const tabs = ['reg-step-tab-1', 'reg-step-tab-2', 'reg-step-tab-3'];

  panes.forEach((pId, idx) => {
    const pane = document.getElementById(pId);
    const tab = document.getElementById(tabs[idx]);
    const stepNum = idx + 1;

    if (pane) {
      if (stepNum === step) {
        pane.classList.add('active');
        if (registerDraft.lockedSteps.has(stepNum)) {
          lockStepInputs(pId, true);
        }
      } else {
        pane.classList.remove('active');
      }
    }

    if (tab) {
      if (stepNum === step) {
        tab.classList.add('active');
        tab.classList.remove('completed');
      } else if (stepNum < step) {
        tab.classList.remove('active');
        tab.classList.add('completed');
      } else {
        tab.classList.remove('active');
        tab.classList.remove('completed');
      }
    }
  });
}

function goToEditStep(step) {
  const status = (document.getElementById('edit-status') ? document.getElementById('edit-status').value : '') || 'Pending';
  if (status === 'Filed' && step === 3) step = 2;
  currentEditStep = step;
  if (step === 2) {
    const secVal = (document.getElementById('edit-tech-sec-ref') ? document.getElementById('edit-tech-sec-ref').value : '') || (editDraft.step1 ? editDraft.step1.techSecRef : '');
    const selSecDisplay = document.getElementById('edit-selected-section-text');
    if (selSecDisplay) {
      selSecDisplay.innerText = secVal || '-- Not Selected in Step 1 --';
    }
    const editRecIdEl = document.getElementById('edit-record-id');
    const recId = editRecIdEl ? parseInt(editRecIdEl.value, 10) : null;
    const item = recId ? tapalState.find(r => r.id === recId) : null;
    const currentDesig = (document.getElementById('edit-emp-desig') ? document.getElementById('edit-emp-desig').value : '') || (item ? item.empDesig : '');
    updateEmpDesigModalDropdown('edit', currentDesig);
    updateOfficerModalDropdown('edit');
    updateShortSubModalDropdown('edit');
  }
  if (step === 3) {
    const dispPicker = document.getElementById('edit-dispatch-date');
    const dispText = document.getElementById('edit-dispatch-date-text');
    if (dispPicker) {
      if (globalDateLockState) {
        dispPicker.max = getTodayISO();
        dispPicker.removeAttribute('min');
      } else {
        dispPicker.removeAttribute('max');
        dispPicker.removeAttribute('min');
      }
      if (!dispPicker.value && (!dispText || !dispText.value.trim())) {
        dispPicker.value = getTodayISO();
        if (dispText) dispText.value = formatISOToDDMMYYYY(getTodayISO());
      }
    }
  }
  const panes = ['edit-step-pane-1', 'edit-step-pane-2', 'edit-step-pane-3'];
  const tabs = ['edit-step-tab-1', 'edit-step-tab-2', 'edit-step-tab-3'];

  const recId = parseInt(document.getElementById('edit-record-id').value, 10);
  const item = tapalState.find(r => r.id === recId);

  panes.forEach((pId, idx) => {
    const pane = document.getElementById(pId);
    const tab = document.getElementById(tabs[idx]);
    const stepNum = idx + 1;

    if (pane) {
      if (stepNum === step) {
        pane.classList.add('active');
        if (stepNum === 1) {
          lockStepInputs(pId, true);
        } else if (stepNum === 2) {
          const isStep2Locked = editDraft.lockedSteps.has(2) || (item && item.status === 'Filed');
          lockStepInputs(pId, isStep2Locked);
        } else if (stepNum === 3) {
          const isStep3Locked = editDraft.lockedSteps.has(3) || (item && item.dispatchCompleted);
          lockStepInputs(pId, isStep3Locked);
        }
      } else {
        pane.classList.remove('active');
      }
    }

    if (tab) {
      if (stepNum === step) {
        tab.classList.add('active');
        tab.classList.remove('completed');
      } else if (stepNum < step) {
        tab.classList.remove('active');
        tab.classList.add('completed');
      } else {
        tab.classList.remove('active');
        tab.classList.remove('completed');
      }
    }
  });
}

window.goToRegisterStep = goToRegisterStep;
window.goToEditStep = goToEditStep;

// -------------------------------------------------------------
// SENT TO MULTI-RECIPIENT TAG MANAGEMENT
// -------------------------------------------------------------
let registerSentToTags = [];
let editSentToTags = [];

function renderSentToTags(mode) {
  const isEdit = (mode === 'edit');
  const tags = isEdit ? editSentToTags : registerSentToTags;
  const containerId = isEdit ? 'edit-sent-to-tags-container' : 'form-sent-to-tags-container';
  const hiddenId = isEdit ? 'edit-sent-to' : 'form-sent-to';

  const container = document.getElementById(containerId);
  const hiddenInput = document.getElementById(hiddenId);

  if (hiddenInput) {
    hiddenInput.value = tags.join(', ');
  }

  if (!container) return;

  if (tags.length === 0) {
    container.innerHTML = `<span style="font-size: 11px; color: #64748b; font-style: italic;"><i class="ri-user-shared-line" style="margin-right: 4px;"></i> No recipients added yet.</span>`;
    return;
  }

  container.innerHTML = tags.map((name, idx) => `
    <div class="sent-to-chip" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
      <span><i class="ri-user-shared-line" style="font-size: 11px; opacity: 0.8;"></i> ${name}</span>
      <button type="button" onclick="removeSentToTag('${mode}', ${idx})" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; line-height: 1; padding: 0; display: flex; align-items: center;" title="Remove ${name}">&times;</button>
    </div>
  `).join('');
}

function addSentToTag(mode) {
  const isEdit = (mode === 'edit');
  const inputId = isEdit ? 'edit-sent-to-input' : 'form-sent-to-input';
  const input = document.getElementById(inputId);
  if (!input) return;

  const rawVal = input.value.trim();
  if (!rawVal) return;

  const namesToAdd = rawVal.split(',').map(s => s.trim()).filter(Boolean);
  const targetArray = isEdit ? editSentToTags : registerSentToTags;

  namesToAdd.forEach(name => {
    if (!targetArray.includes(name)) {
      targetArray.push(name);
    }
  });

  input.value = '';
  renderSentToTags(mode);
}

function removeSentToTag(mode, idx) {
  const isEdit = (mode === 'edit');
  const targetArray = isEdit ? editSentToTags : registerSentToTags;
  if (idx >= 0 && idx < targetArray.length) {
    targetArray.splice(idx, 1);
    renderSentToTags(mode);
  }
}

function initSentToTagEvents() {
  const regInput = document.getElementById('form-sent-to-input');
  const regAddBtn = document.getElementById('btn-add-sent-to-tag');

  if (regAddBtn) {
    regAddBtn.onclick = (e) => {
      e.preventDefault();
      addSentToTag('register');
    };
  }

  if (regInput) {
    regInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addSentToTag('register');
      }
    });
  }

  const editInput = document.getElementById('edit-sent-to-input');
  const editAddBtn = document.getElementById('btn-add-edit-sent-to-tag');

  if (editAddBtn) {
    editAddBtn.onclick = (e) => {
      e.preventDefault();
      addSentToTag('edit');
    };
  }

  if (editInput) {
    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addSentToTag('edit');
      }
    });
  }

  renderSentToTags('register');
  renderSentToTags('edit');
}

// -------------------------------------------------------------
// PREVIOUS MONTH READ-ONLY ENFORCEMENT UTILITIES
// -------------------------------------------------------------
function getRecordYearMonth(item) {
  if (!item) return '';
  if (item.recSecDate && typeof item.recSecDate === 'string' && item.recSecDate.includes('-')) {
    const parts = item.recSecDate.split('T')[0].split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}`;
    }
  }
  if (item.letterDate && typeof item.letterDate === 'string' && item.letterDate.includes('-')) {
    const parts = item.letterDate.split('T')[0].split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}`;
    }
  }
  if (item.month && typeof item.month === 'string' && item.month.includes('-')) {
    const parts = item.month.split('-');
    const mStr = parts[0].toUpperCase();
    const mIdx = monthNamesList.indexOf(mStr);
    if (mIdx !== -1 && parts[1]) {
      return `${parts[1]}-${String(mIdx + 1).padStart(2, '0')}`;
    }
  }
  return '';
}

function getCurrentSystemYearMonth() {
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let maxYM = currentYM;
  if (typeof tapalState !== 'undefined' && tapalState.length > 0) {
    tapalState.forEach(r => {
      const ym = getRecordYearMonth(r);
      if (ym && ym > maxYM) maxYM = ym;
    });
  }
  return maxYM;
}

function isRecordReadOnly(item) {
  if (!item) return false;
  // Record is ONLY non-editable / locked if 3rd module (Dispatch Details) has been completed and saved
  const isDispatchCompleted = item.dispatchCompleted || (item.status === 'Filed' && item.sentLetterNo && item.dispatchDate);
  return !!isDispatchCompleted;
}

function getBadgeClass(status) {
  switch (status) {
    case 'Pending': return 'badge-pending';
    case 'Letter': return 'badge-letter';
    case 'Memo': return 'badge-memo';
    case 'Filed': return 'badge-filed';
    case 'Proceeding': return 'badge-proceeding';
    default: return 'badge-pending';
  }
}

function truncate(str, len) {
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function deleteRecord(id) {
  if (id === undefined || id === null || id === '') return;
  const idStr = String(id).trim();
  const item = tapalState.find(r => String(r.id) === idStr || String(r.sNo) === idStr || String(r.currNo) === idStr);
  const displayNo = item ? (item.currNo || item.sNo || idStr) : idStr;

  if (!confirm(`Are you sure you want to delete Tapal entry #${displayNo}?`)) {
    return;
  }

  const prevLen = tapalState.length;
  tapalState = tapalState.filter(r => {
    if (String(r.id) === idStr) return false;
    if (item && r === item) return false;
    return true;
  });

  saveTapalStateToLocalStorage();

  // Async sync with database
  try {
    const dbId = (item && item.id) ? item.id : id;
    fetch(`/api/tapal/${dbId}`, { method: 'DELETE' })
      .then(res => {
        if (res.ok) console.log(`Deleted Tapal record #${dbId} from database.`);
      })
      .catch(err => console.warn('Backend delete sync:', err));
  } catch (e) {}

  renderDashboard();
  renderRegisterTable();
  if (typeof renderFollowUpModule === 'function') renderFollowUpModule();
  if (typeof renderKanbanPipeline === 'function') renderKanbanPipeline();
  if (typeof renderSLAAnalytics === 'function') renderSLAAnalytics();
  if (typeof updateHomeKPICounters === 'function') updateHomeKPICounters();
  if (typeof showToast === 'function') {
    showToast(`Tapal record #${displayNo} deleted successfully.`, 'success');
  }
}
window.deleteRecord = deleteRecord;

function updateTapalType(id, newType, selectEl) {
  const item = tapalState.find(r => r.id === id);
  if (item) {
    if (isRecordReadOnly(item)) {
      alert('🔒 Previous month completed/processed records are View-Only.');
      if (selectEl) selectEl.value = item.tapalType;
      return;
    }
    item.tapalType = newType;
    saveTapalStateToLocalStorage();
    console.log(`Updated Tapal #${item.sNo} type to "${newType}".`);
    if (selectEl) {
      selectEl.className = `tapal-type-select type-${newType.toLowerCase().replace(/[^a-z]/g, '')}`;
    }
  }
}

function toggleRecordStatus(id) {
  if (id === undefined || id === null || id === '') return;
  const idStr = String(id).trim();
  const item = tapalState.find(r => String(r.id) === idStr || String(r.sNo) === idStr || String(r.currNo) === idStr);
  if (!item) return;

  const nextStatusMap = {
    'Pending': 'Filed',
    'Filed': 'Proceeding',
    'Proceeding': 'Letter',
    'Letter': 'Memo',
    'Memo': 'Pending'
  };

  const newStatus = nextStatusMap[item.status] || 'Pending';
  updateRecordStatus(item.id, newStatus);
}
window.toggleRecordStatus = toggleRecordStatus;

function updateRecordStatus(id, newStatus, selectEl) {
  if (id === undefined || id === null || id === '') return;
  const idStr = String(id).trim();
  const item = tapalState.find(r => String(r.id) === idStr || String(r.sNo) === idStr || String(r.currNo) === idStr);
  if (item) {
    const oldStatus = item.status;
    item.status = newStatus;

    if (newStatus === 'Filed') {
      item.actionInitiated = item.actionInitiated || 'Filed';
      item.fileInitDate = item.fileInitDate || getTodayISO();
      // Strictly clear dispatch details
      item.sentLetterNo = null;
      item.dispatchDate = null;
      item.sentTo = null;
      item.accountsRefNo = null;
      item.dispatchCompleted = false;
    } else {
      // Mandatory Action Date whenever changes are done from Pending / status updated
      if (!item.fileInitDate) {
        item.fileInitDate = getTodayISO();
      }
      if (newStatus !== 'Pending' && !item.fileApprDate) {
        item.fileApprDate = getTodayISO();
      }
    }

    saveTapalStateToLocalStorage();

    // Sync with backend API
    fetch(`/api/tapal/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        actionInitiated: item.actionInitiated,
        fileInitDate: item.fileInitDate,
        fileApprDate: item.fileApprDate,
        sentLetterNo: item.sentLetterNo,
        dispatchDate: item.dispatchDate,
        sentTo: item.sentTo,
        accountsRefNo: item.accountsRefNo
      })
    }).catch(err => console.warn('Backend sync error in updateRecordStatus:', err));
    
    console.log(`Updated Tapal #${item.sNo} status from "${oldStatus}" to "${newStatus}".`);
    if (selectEl) {
      selectEl.className = `status-select status-${newStatus.toLowerCase()}`;
    }
    // Update live pendings counter on dashboard & register toolbar
    const pendingCount = tapalState.filter(r => r.status === 'Pending').length;
    const pendingEl = document.getElementById('register-total-pendings');
    if (pendingEl) pendingEl.innerText = pendingCount;

    renderDashboard();
    renderKanbanPipeline();
    renderSLAAnalytics();
    renderExcelSheetTabs();
  }
}

// -------------------------------------------------------------
// 3. AI OCR SCANNER SIMULATOR
// -------------------------------------------------------------
function renderOCRSimulator() {
  const samples = [
    {
      docType: 'Government Order (G.O.)',
      sender: 'MORTH / Ministry of Road Transport & Highways',
      subject: 'Sanction of Annual Budget Allocation for National Highways 2023-24',
      refDate: 'RW/NH-33044/12/2023 | Dated: 2023-03-15',
      assigned: 'Planning & Budget | Concerned Officer: Ganeshkumar',
      raw: { tapalType: 'G.O.', mainOffice: 'MORTH', officerDesig: 'Ganeshkumar', subject: 'Sanction of Annual Budget Allocation for NH 2023-24' }
    },
    {
      docType: 'Official Letter',
      sender: 'Superintending Engineer (SE) Salem Circle',
      subject: 'Submission of Revised Estimate for Widening of Salem-Namakkal Stretch',
      refDate: 'SE/SLM/Tech/1042/2023 | Dated: 2023-02-18',
      assigned: 'Technical Section | Concerned Officer: Kousalya',
      raw: { tapalType: 'Letter', mainOffice: 'SE', officerDesig: 'Kousalya', subject: 'Submission of Revised Estimate for Salem-Namakkal Stretch' }
    },
    {
      docType: 'Court Order / Proceedings',
      sender: 'High Court of Judicature Madras',
      subject: 'WP No. 4921/2023 - Land Acquisition Compensation Clearance',
      refDate: 'HC/MAD/2023/WP-4921 | Dated: 2023-03-02',
      assigned: 'Legal / Land Acquisition | Concerned Officer: Kamini',
      raw: { tapalType: 'Proceeding', mainOffice: 'GOVT', officerDesig: 'Kamini', subject: 'WP No. 4921/2023 Land Acquisition Clearance' }
    }
  ];

  let currentSample = samples[0];

  document.getElementById('btn-simulate-scan').onclick = () => {
    const randomIdx = Math.floor(Math.random() * samples.length);
    currentSample = samples[randomIdx];

    document.getElementById('ocr-doc-type').innerText = 'Scanning & Extracting...';
    document.getElementById('ocr-sender').innerText = 'Running Vision OCR Model...';

    setTimeout(() => {
      document.getElementById('ocr-doc-type').innerText = currentSample.docType;
      document.getElementById('ocr-sender').innerText = currentSample.sender;
      document.getElementById('ocr-subject').innerText = currentSample.subject;
      document.getElementById('ocr-ref-date').innerText = currentSample.refDate;
      document.getElementById('ocr-assigned').innerText = currentSample.assigned;
    }, 600);
  };

  document.getElementById('btn-ocr-commit').onclick = () => {
    const today = new Date().toISOString().split('T')[0];
    const newId = tapalState.length + 1;
    const newRecord = {
      id: newId,
      sNo: newId,
      month: 'MAR-2023',
      tapalType: currentSample.raw.tapalType,
      currNo: `${1600 + newId}`,
      sealDate: today,
      recSecDate: today,
      subject: currentSample.raw.subject,
      letterRef: currentSample.refDate.split('|')[0].trim(),
      letterDate: today,
      mainOffice: currentSample.raw.mainOffice,
      officerDesig: currentSample.raw.officerDesig,
      status: 'Pending',
      fileNoRef: `OCR-${newId}/NH/2023`,
      fileInitDate: today,
      diffSecToInit: 0
    };

    tapalState.unshift(newRecord);
    alert(`Success! Tapal #${newRecord.sNo} auto-registered via OCR Scanner!`);

    renderDashboard();
    renderRegisterTable();
    renderKanbanPipeline();
    renderSLAAnalytics();
  };
}

// -------------------------------------------------------------
// 4. KANBAN WORKFLOW PIPELINE
// -------------------------------------------------------------
function renderKanbanPipeline() {
  try {
    const colInward = document.getElementById('kanban-inward');
    const colSuper = document.getElementById('kanban-super');
    const colOfficer = document.getElementById('kanban-officer');
    const colDispatch = document.getElementById('kanban-dispatch');
    const colClosed = document.getElementById('kanban-closed');

    if (colInward) colInward.innerHTML = '';
    if (colSuper) colSuper.innerHTML = '';
    if (colOfficer) colOfficer.innerHTML = '';
    if (colDispatch) colDispatch.innerHTML = '';
    if (colClosed) colClosed.innerHTML = '';

    let cInward = 0, cSuper = 0, cOfficer = 0, cDispatch = 0, cClosed = 0;

    tapalState.slice(0, 40).forEach(r => {
      const card = document.createElement('div');
      card.className = 'kanban-card';
      const isReadOnly = isRecordReadOnly(r);
      const advanceBtnHtml = isReadOnly ?
        `<span style="font-size: 10px; color: #94a3b8; font-weight: 700;" title="🔒 View Only (Previous Month Completed)"><i class="ri-lock-2-line"></i> View Only</span>` :
        `<button class="btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 10px;" onclick="advancePipeline(${r.id})">Advance <i class="ri-arrow-right-s-line"></i></button>`;

      card.innerHTML = `
        <div class="kanban-card-meta">
          <span>#${r.sNo} | ${r.mainOffice || 'SE'}</span>
          <span>${r.currNo || 'No. -'}</span>
        </div>
        <div class="kanban-card-title">${truncate(r.subject || 'Official Mail', 36)}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
          <span style="font-size: 11px; color: var(--text-muted);"><i class="ri-user-line"></i> ${r.officerDesig || 'Officer'}</span>
          ${advanceBtnHtml}
        </div>
      `;

      if (r.status === 'Pending') {
        if (colOfficer) colOfficer.appendChild(card); cOfficer++;
      } else if (r.status === 'Letter') {
        if (colInward) colInward.appendChild(card); cInward++;
      } else if (r.status === 'Memo') {
        if (colSuper) colSuper.appendChild(card); cSuper++;
      } else if (r.status === 'Proceeding') {
        if (colDispatch) colDispatch.appendChild(card); cDispatch++;
      } else {
        if (colClosed) colClosed.appendChild(card); cClosed++;
      }
    });

    const cntInward = document.getElementById('cnt-inward');
    const cntSuper = document.getElementById('cnt-super');
    const cntOfficer = document.getElementById('cnt-officer');
    const cntDispatch = document.getElementById('cnt-dispatch');
    const cntClosed = document.getElementById('cnt-closed');
    if (cntInward) cntInward.innerText = cInward;
    if (cntSuper) cntSuper.innerText = cSuper;
    if (cntOfficer) cntOfficer.innerText = cOfficer;
    if (cntDispatch) cntDispatch.innerText = cDispatch;
    if (cntClosed) cntClosed.innerText = cClosed;
  } catch (err) {
    console.warn('renderKanbanPipeline error:', err);
  }
}

function advancePipeline(id) {
  const item = tapalState.find(r => r.id === id);
  if (!item) return;

  if (isRecordReadOnly(item)) {
    alert('🔒 Previous month completed/processed records are View-Only.');
    return;
  }

  const nextStatusMap = {
    'Letter': 'Memo',
    'Memo': 'Pending',
    'Pending': 'Proceeding',
    'Proceeding': 'Filed',
    'Filed': 'Filed'
  };

  item.status = nextStatusMap[item.status] || 'Filed';
  if (!item.fileInitDate) {
    item.fileInitDate = getTodayISO();
  }
  if (item.status === 'Filed') {
    item.actionInitiated = item.actionInitiated || 'Filed';
  } else if (!item.fileApprDate && item.status !== 'Pending') {
    item.fileApprDate = getTodayISO();
  }
  renderDashboard();
  renderRegisterTable();
  renderKanbanPipeline();
  renderSLAAnalytics();
}

// -------------------------------------------------------------
// 5. TURNAROUND & SLA ANALYTICS
// -------------------------------------------------------------
function renderSLAAnalytics() {
  try {
    const chartCanvas = document.getElementById('turnaroundChart');
    if (chartCanvas && typeof Chart !== 'undefined' && chartCanvas.offsetParent !== null) {
      if (turnaroundChartInst) {
        try {
          turnaroundChartInst.destroy();
        } catch (e) {}
        turnaroundChartInst = null;
      }

      try {
        turnaroundChartInst = new Chart(chartCanvas, {
          type: 'bar',
          data: {
            labels: ['Stage 1: Letter to Office', 'Stage 2: Office to Section', 'Stage 3: Section to Initiation', 'Stage 4: Initiation to Approval'],
            datasets: [{
              label: 'Average Turnaround Time (Days)',
              data: [2.1, 1.8, 3.5, 4.2],
              backgroundColor: ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981'],
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
              y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Days', color: '#94a3b8' } }
            }
          }
        });
      } catch (chartErr) {
        console.warn('turnaroundChart error:', chartErr);
        turnaroundChartInst = null;
      }
    }

    // Render SLA Warnings
    const slaTbody = document.getElementById('sla-warning-tbody');
    if (slaTbody) {
      slaTbody.innerHTML = '';

      const pendings = tapalState.filter(r => r.status === 'Pending');

      if (pendings.length === 0) {
        slaTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--success); padding: 16px;">🎉 Zero SLA Breaches! All pending correspondence clear.</td></tr>`;
      } else {
        pendings.forEach((p, idx) => {
          const daysOver = 5 + (idx * 3);
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>#${p.currNo || p.sNo}</strong></td>
            <td>${p.officerDesig || 'Ganeshkumar'}</td>
            <td>${p.mainOffice || 'MORTH'}</td>
            <td>${p.sealDate ? formatISOToDDMMYYYY(p.sealDate) : '10/01/2023'}</td>
            <td><span style="color: var(--danger); font-weight: 700;">${daysOver} Days Pending</span></td>
            <td><span class="badge badge-pending">Action Required</span></td>
          `;
          slaTbody.appendChild(tr);
        });
      }
    }
  } catch (err) {
    console.warn('renderSLAAnalytics error:', err);
  }
}

// -------------------------------------------------------------
// 6. WORKFLOW COMPARISON RENDERER
// -------------------------------------------------------------
function renderWorkflowComparison() {
  const manualContainer = document.getElementById('timeline-manual');
  const modernContainer = document.getElementById('timeline-modern');
  if (!manualContainer || !modernContainer) return;

  manualContainer.innerHTML = '';
  modernContainer.innerHTML = '';

  WORKFLOW_STEPS_MANUAL.forEach(s => {
    const item = document.createElement('div');
    item.className = 'timeline-step';
    item.innerHTML = `
      <div class="timeline-step-num">${s.step}</div>
      <div class="timeline-step-content">
        <h4>${s.title}</h4>
        <p>${s.desc}</p>
      </div>
    `;
    manualContainer.appendChild(item);
  });

  WORKFLOW_STEPS_MODERN.forEach(s => {
    const item = document.createElement('div');
    item.className = 'timeline-step';
    item.innerHTML = `
      <div class="timeline-step-num" style="background: rgba(16,185,129,0.15); color: var(--success);">${s.step}</div>
      <div class="timeline-step-content">
        <h4>${s.title}</h4>
        <p>${s.desc}</p>
      </div>
    `;
    modernContainer.appendChild(item);
  });
}

// -------------------------------------------------------------
// MODAL EVENTS & NEW TAPAL SUBMISSION
// -------------------------------------------------------------
function initModalEvents() {
  const modal = document.getElementById('register-modal');
  const openBtn = document.getElementById('btn-open-register-modal');
  const closeBtn = document.getElementById('btn-close-register-modal');
  const cancelBtn = document.getElementById('btn-cancel-modal');
  const form = document.getElementById('tapal-form');

  const formTechSecRef = document.getElementById('form-tech-sec-ref');
  if (formTechSecRef) {
    formTechSecRef.onchange = () => updateEmpDesigModalDropdown('register');
  }

  const editTechSecRef = document.getElementById('edit-tech-sec-ref');
  if (editTechSecRef) {
    editTechSecRef.onchange = () => updateEmpDesigModalDropdown('edit');
  }

  const formCurrNoInput = document.getElementById('form-curr-no');
  if (formCurrNoInput) {
    formCurrNoInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val.length > 5) val = val.substring(0, 5);
      e.target.value = val;
      e.target.style.borderColor = '';
    });
    formCurrNoInput.addEventListener('blur', (e) => {
      if (e.target.value.trim()) {
        const cleaned = cleanCurrNo(e.target.value);
        e.target.value = cleaned;
        const duplicate = tapalState.find(r => r.currNo === cleaned && r.id !== registerDraft.recordId);
        if (duplicate) {
          e.target.style.borderColor = '#ef4444';
        } else {
          e.target.style.borderColor = '';
        }
      }
    });
  }

  const editCurrNoInput = document.getElementById('edit-curr-no');
  if (editCurrNoInput) {
    editCurrNoInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val.length > 5) val = val.substring(0, 5);
      e.target.value = val;
      e.target.style.borderColor = '';
    });
    editCurrNoInput.addEventListener('blur', (e) => {
      if (e.target.value.trim()) {
        const cleaned = cleanCurrNo(e.target.value);
        e.target.value = cleaned;
        const recId = parseInt(document.getElementById('edit-record-id').value, 10);
        const duplicate = tapalState.find(r => r.currNo === cleaned && r.id !== recId);
        if (duplicate) {
          e.target.style.borderColor = '#ef4444';
        } else {
          e.target.style.borderColor = '';
        }
      }
    });
  }

  const formFileNoInput = document.getElementById('form-file-no');
  if (formFileNoInput) {
    formFileNoInput.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.code === 'Space') e.preventDefault();
    });
    formFileNoInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\s+/g, '');
      e.target.style.borderColor = '';
    });
  }

  const editFileNoInput = document.getElementById('edit-file-no');
  if (editFileNoInput) {
    editFileNoInput.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.code === 'Space') e.preventDefault();
    });
    editFileNoInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\s+/g, '');
      e.target.style.borderColor = '';
    });
  }

  openBtn.onclick = () => {
    form.reset();
    registerDraft = { step1: {}, step2: {}, lockedSteps: new Set() };
    lockStepInputs('reg-step-pane-1', false);
    lockStepInputs('reg-step-pane-2', false);
    lockStepInputs('reg-step-pane-3', false);

    // Auto pre-fill next inward number (previous highest inward number + 1)
    if (formCurrNoInput) {
      formCurrNoInput.value = getNextCurrNo();
    }

    const todayISO = getTodayISO();
    setDateInputValues('form-seal-date-text', 'form-seal-date', todayISO);
    setDateInputValues('form-rec-sec-date-text', 'form-rec-sec-date', todayISO);
    setDateInputValues('form-letter-date-text', 'form-letter-date', todayISO);

    const sealDateInput = document.getElementById('form-seal-date');
    if (sealDateInput) {
      if (globalDateLockState) { sealDateInput.max = todayISO; sealDateInput.removeAttribute('min'); }
      else { sealDateInput.removeAttribute('max'); sealDateInput.removeAttribute('min'); }
    }
    const recSecDateInput = document.getElementById('form-rec-sec-date');
    if (recSecDateInput) {
      if (globalDateLockState) { recSecDateInput.max = todayISO; recSecDateInput.removeAttribute('min'); }
      else { recSecDateInput.removeAttribute('max'); recSecDateInput.removeAttribute('min'); }
    }
    const letterDateInput = document.getElementById('form-letter-date');
    if (letterDateInput) {
      if (globalDateLockState) { letterDateInput.max = todayISO; letterDateInput.removeAttribute('min'); }
      else { letterDateInput.removeAttribute('max'); letterDateInput.removeAttribute('min'); }
    }
    const actInitDateInput = document.getElementById('form-action-init-date');
    if (actInitDateInput) {
      if (globalDateLockState) { actInitDateInput.max = todayISO; actInitDateInput.removeAttribute('min'); }
      else { actInitDateInput.removeAttribute('max'); actInitDateInput.removeAttribute('min'); }
    }
    const apprFcDateInput = document.getElementById('form-appr-fc-date');
    if (apprFcDateInput) {
      if (globalDateLockState) { apprFcDateInput.max = todayISO; apprFcDateInput.removeAttribute('min'); }
      else { apprFcDateInput.removeAttribute('max'); apprFcDateInput.removeAttribute('min'); }
    }
    const dispDateInput = document.getElementById('form-dispatch-date');
    if (dispDateInput) {
      if (globalDateLockState) { dispDateInput.max = todayISO; dispDateInput.removeAttribute('min'); }
      else { dispDateInput.removeAttribute('max'); dispDateInput.removeAttribute('min'); }
      setDateInputValues('form-dispatch-date-text', 'form-dispatch-date', todayISO);
    }

    const formMainOffice = document.getElementById('form-main-office');
    if (formMainOffice) {
      updateOfficerAndShortSubDropdowns('register');
    }
    updateEmpDesigModalDropdown('register');
    registerSentToTags = [];
    renderSentToTags('register');
    handleFormStatusAndSectionVisibility('register');
    bindAllDateInputsInDOM();
    goToRegisterStep(1);
    modal.classList.add('active');
  };

  const formMainOffice = document.getElementById('form-main-office');
  if (formMainOffice) {
    formMainOffice.onchange = () => updateOfficerAndShortSubDropdowns('register');
  }

  const formStatus = document.getElementById('form-status');
  if (formStatus) {
    formStatus.onchange = () => handleFormStatusAndSectionVisibility('register');
  }

  const formTechSec = document.getElementById('form-tech-sec-ref');
  if (formTechSec) {
    formTechSec.onchange = () => {
      updateEmpDesigModalDropdown('register');
      handleFormStatusAndSectionVisibility('register');
    };
  }

  form.addEventListener('input', () => {
    saveLiveRegisterDraft();
  });
  form.addEventListener('change', () => {
    saveLiveRegisterDraft();
  });
  closeBtn.onclick = () => modal.classList.remove('active');
  cancelBtn.onclick = () => modal.classList.remove('active');

  form.onsubmit = (e) => {
    e.preventDefault();
    saveTapalEntryRecord('register');
  };
}

// Export CSV Feature
function initExportEvent() {
  document.getElementById('btn-export-csv').onclick = () => {
    if (tapalState.length === 0) return alert('No data to export!');

    const headers = [
      'S.No.', 'Tapal / mail', 'Current number', 'Office seal Date', 'Section', 'Employee Designation',
      'Section Receipt Date (Date Received in Section)', 'Subject', 'Letter ref.', 'Dated', 'SUBJECT IN BRIEF', 'Main office',
      'Officer Designation', 'Status', 'Action initiated', 'File No. Ref',
      'File Initiated Date', 'File Approval / Fair copy sent Date', 'Follow up cases', 'Remarks',
      'Office letter number', 'Accounts Voucher / Bill Ref No', 'Dispatch Date', 'Sent To', 'Reminders Count', 'Latest Reminder Date'
    ];
    const rows = tapalState.map(r => {
      const tapalRemindersList = getTapalReminders(r.id);
      const latestRemDate = r.latestReminderDate || (tapalRemindersList.length > 0 ? tapalRemindersList[0].date : '');
      const remCount = getTapalReminderCount(r);

      return [
        r.sNo,
        `"${r.tapalType || 'Tapal'}"`,
        `"${r.currNo || ''}"`,
        `"${r.sealDate ? formatISOToDDMMYYYY(r.sealDate) : ''}"`,
        `"${(r.techSecRef || '').replace(/"/g, '""')}"`,
        `"${(r.empDesig || '').replace(/"/g, '""')}"`,
        `"${r.recSecDate ? formatISOToDDMMYYYY(r.recSecDate) : ''}"`,
        `"${(r.subject || '').replace(/"/g, '""')}"`,
        `"${(r.letterRef || '').replace(/"/g, '""')}"`,
        `"${r.letterDate ? formatISOToDDMMYYYY(r.letterDate) : ''}"`,
        `"${(r.shortSub || '').replace(/"/g, '""')}"`,
        `"${r.mainOffice || ''}"`,
        `"${r.officerDesig || ''}"`,
        `"${r.status || ''}"`,
        `"${(r.actionInitiated || '').replace(/"/g, '""')}"`,
        `"${r.fileNoRef || ''}"`,
        `"${r.fileInitDate ? formatISOToDDMMYYYY(r.fileInitDate) : ''}"`,
        `"${r.fileApprDate ? formatISOToDDMMYYYY(r.fileApprDate) : ''}"`,
        `"${(r.followUp || '').replace(/"/g, '""')}"`,
        `"${(r.remarks || '').replace(/"/g, '""')}"`,
        `"${r.sentLetterNo || ''}"`,
        `"${r.accountsRefNo || ''}"`,
        `"${r.dispatchDate ? formatISOToDDMMYYYY(r.dispatchDate) : ''}"`,
        `"${(r.sentTo || '').replace(/"/g, '""')}"`,
        remCount,
        `"${latestRemDate ? formatISOToDDMMYYYY(latestRemDate) : ''}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `INWARD_TAPAL_REGISTER_${getTodayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
}

// -------------------------------------------------------------
// 7. MANUAL DD/MM/YYYY DATE PICKER & FILTER MODULE
// -------------------------------------------------------------
let activeDateFilter;

// Date Conversion & Calendar Validation Utilities (DD/MM/YYYY <-> YYYY-MM-DD)
function isValidCalendarDate(dayStr, monthStr, yearStr) {
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > 2100) return false;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function parseDDMMYYYYToISO(ddmmyyyy) {
  if (!ddmmyyyy || typeof ddmmyyyy !== 'string') return null;
  const cleaned = ddmmyyyy.trim();
  if (!cleaned) return null;

  // If already in ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const parts = cleaned.split('-');
    if (isValidCalendarDate(parts[2], parts[1], parts[0])) return cleaned;
    return null;
  }

  // Parse DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const parts = cleaned.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let dayStr = parts[0].trim().padStart(2, '0');
    let monthStr = parts[1].trim().padStart(2, '0');
    let yearStr = parts[2].trim();

    if (yearStr.length === 2) yearStr = '20' + yearStr;

    if (yearStr.length === 4 && isValidCalendarDate(dayStr, monthStr, yearStr)) {
      return `${yearStr}-${monthStr}-${dayStr}`;
    }
  }
  return null;
}

function formatISOToDDMMYYYY(isoStr) {
  if (!isoStr) return '';
  if (typeof isoStr !== 'string') isoStr = String(isoStr);
  const cleanStr = isoStr.split('T')[0].trim();

  if (cleanStr.includes('/')) {
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
      const d = parts[0].trim().padStart(2, '0');
      const m = parts[1].trim().padStart(2, '0');
      const y = parts[2].trim();
      return `${d}/${m}/${y}`;
    }
    return cleanStr;
  }

  const parts = cleanStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  return isoStr;
}

function getDateInputISO(textElOrId, pickerElOrId) {
  const textEl = typeof textElOrId === 'string' ? document.getElementById(textElOrId) : textElOrId;
  const pickerEl = typeof pickerElOrId === 'string' ? document.getElementById(pickerElOrId) : pickerElOrId;

  const textVal = textEl ? textEl.value.trim() : '';
  if (textVal) {
    const parsed = parseDDMMYYYYToISO(textVal);
    if (parsed) return parsed;
  }

  if (pickerEl && pickerEl.value) {
    return pickerEl.value;
  }

  return '';
}
window.getDateInputISO = getDateInputISO;

function setDateInputValues(textId, pickerId, isoDate) {
  const textEl = document.getElementById(textId);
  const pickerEl = document.getElementById(pickerId);
  if (textEl && pickerEl) {
    bindDatePairSync(textEl, pickerEl);
    if (isoDate) {
      pickerEl.value = isoDate;
      textEl.value = formatISOToDDMMYYYY(isoDate);
      textEl.style.borderColor = '';
    } else {
      pickerEl.value = '';
      textEl.value = '';
      textEl.style.borderColor = '';
    }
  }
}
window.setDateInputValues = setDateInputValues;

function bindDatePairSync(textEl, pickerEl) {
  if (!textEl || !pickerEl) return;
  if (textEl.dataset.datePairBound === 'true') return;
  textEl.dataset.datePairBound = 'true';

  textEl.setAttribute('maxlength', '10');
  textEl.setAttribute('autocomplete', 'off');

  const wrapper = textEl.closest('.date-picker-input-wrapper') || textEl.parentElement;
  let calBtn = wrapper ? wrapper.querySelector('.custom-date-picker-btn') : null;

  if (wrapper && !calBtn) {
    calBtn = document.createElement('button');
    calBtn.type = 'button';
    calBtn.className = 'custom-date-picker-btn';
    calBtn.setAttribute('tabindex', '-1');
    calBtn.setAttribute('title', 'Click to open calendar');
    calBtn.innerHTML = '<i class="ri-calendar-2-line"></i>';
    wrapper.appendChild(calBtn);
  }

  // Trigger browser date picker when calendar button is clicked
  if (calBtn) {
    calBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Ensure picker max/min is up to date with global date lock
      if (globalDateLockState) {
        pickerEl.max = getTodayISO();
      } else {
        pickerEl.removeAttribute('max');
        pickerEl.removeAttribute('min');
      }

      // Sync current text to picker before opening
      const currentTextVal = textEl.value ? textEl.value.trim() : '';
      if (currentTextVal) {
        const iso = parseDDMMYYYYToISO(currentTextVal);
        if (iso) pickerEl.value = iso;
      }

      try {
        if (typeof pickerEl.showPicker === 'function') {
          pickerEl.showPicker();
          return;
        }
      } catch (err) {
        console.warn('pickerEl.showPicker() fallback:', err);
      }

      // Fallback
      try {
        pickerEl.focus();
        pickerEl.click();
      } catch (err2) {}
    };
  }

  // Native picker change -> sync text input in DD/MM/YYYY
  const onPickerChange = () => {
    if (pickerEl.value) {
      textEl.value = formatISOToDDMMYYYY(pickerEl.value);
      textEl.style.borderColor = '';
      const parts = pickerEl.value.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        if (typeof populateQuickMonthDropdown === 'function') {
          populateQuickMonthDropdown(parts[0]);
        }
      }
    } else {
      textEl.value = '';
      textEl.style.borderColor = '';
    }
    textEl.dispatchEvent(new Event('input', { bubbles: true }));
    textEl.dispatchEvent(new Event('change', { bubbles: true }));
  };

  pickerEl.addEventListener('change', onPickerChange);
  pickerEl.addEventListener('input', onPickerChange);

  // Keydown for backspace past slashes
  textEl.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey) {
      const val = textEl.value;
      const start = textEl.selectionStart;
      const end = textEl.selectionEnd;
      if (start === end && (start === 3 || start === 6) && val.charAt(start - 1) === '/') {
        e.preventDefault();
        textEl.value = val.slice(0, start - 2) + val.slice(start);
        textEl.setSelectionRange(start - 2, start - 2);
        textEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });

  // Text input live typing -> Auto insert '/' after DD and MM
  textEl.addEventListener('input', () => {
    textEl.style.borderColor = '';
    let raw = textEl.value;

    // Auto-mask digits to DD/MM/YYYY format
    let digits = raw.replace(/\D/g, '');
    if (digits.length > 8) digits = digits.substring(0, 8);

    let masked = '';
    if (digits.length === 0) {
      masked = '';
    } else if (digits.length <= 2) {
      masked = digits;
      if (digits.length === 2 && raw.length >= 2) masked += '/';
    } else if (digits.length <= 4) {
      masked = digits.substring(0, 2) + '/' + digits.substring(2, 4);
      if (digits.length === 4 && raw.length >= 5) masked += '/';
    } else {
      masked = digits.substring(0, 2) + '/' + digits.substring(2, 4) + '/' + digits.substring(4, 8);
    }

    textEl.value = masked;

    // Update native picker if valid ISO
    if (digits.length === 8) {
      const iso = parseDDMMYYYYToISO(masked);
      if (iso && iso.length === 10) {
        pickerEl.value = iso;
        textEl.style.borderColor = '';
        const parts = iso.split('-');
        if (parts.length === 3 && typeof populateQuickMonthDropdown === 'function') {
          populateQuickMonthDropdown(parts[0]);
        }
      } else {
        textEl.style.borderColor = '#ef4444';
        pickerEl.value = '';
      }
    } else if (!digits) {
      pickerEl.value = '';
      textEl.style.borderColor = '';
    }
  });

  // Text input blur -> format & validate DD/MM/YYYY
  const handleFormatAndValidate = () => {
    const val = textEl.value.trim();
    if (!val) {
      pickerEl.value = '';
      textEl.value = '';
      textEl.style.borderColor = '';
      return;
    }
    const iso = parseDDMMYYYYToISO(val);
    if (iso && iso.length === 10) {
      pickerEl.value = iso;
      textEl.value = formatISOToDDMMYYYY(iso);
      textEl.style.borderColor = '';
    } else {
      textEl.style.borderColor = '#ef4444';
      pickerEl.value = '';
    }
  };

  textEl.addEventListener('blur', handleFormatAndValidate);
}

let selectedCalYear = 2023;
let selectedCalMonth = 1; // 0-indexed (1 = Feb 2023)

function renderCalendarModule() {
  const drawer = document.getElementById('selected-date-drawer');
  const title = document.getElementById('drawer-date-title');
  if (drawer && title) {
    drawer.style.display = 'block';
    let filteredRecords = tapalState;
    let label = 'Showing All Dates';

    if (activeDateFilter) {
      if (typeof activeDateFilter === 'string') {
        filteredRecords = tapalState.filter(r => r.recSecDate === activeDateFilter || r.letterDate === activeDateFilter);
        label = `Date ${formatISOToDDMMYYYY(activeDateFilter)}`;
      } else if (activeDateFilter.start && activeDateFilter.end) {
        filteredRecords = tapalState.filter(r => {
          const d = r.recSecDate || r.letterDate;
          return d >= activeDateFilter.start && d <= activeDateFilter.end;
        });
        label = `${formatISOToDDMMYYYY(activeDateFilter.start)} to ${formatISOToDDMMYYYY(activeDateFilter.end)}`;
      }
    }
    openSelectedDateDrawer(label, filteredRecords);
  }
}

function openSelectedDateDrawer(label, records) {
  const drawer = document.getElementById('selected-date-drawer');
  const title = document.getElementById('drawer-date-title');
  const tbody = document.getElementById('drawer-tbody');

  if (!drawer || !tbody) return;
  drawer.style.display = 'block';
  title.innerText = `Correspondence Records (${label}) — ${records.length} items found`;

  tbody.innerHTML = '';
  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--text-muted);">No letters recorded for ${label}.</td></tr>`;
  } else {
    records.forEach(r => {
      const tr = document.createElement('tr');
      const currentType = r.tapalType || 'Tapal';
      const typeClass = `type-${currentType.toLowerCase().replace(/[^a-z]/g, '')}`;
      tr.innerHTML = `
        <td>#${r.sNo}</td>
        <td><span class="badge ${currentType === 'Email' ? 'badge-email' : 'badge-tapal'}">${currentType}</span></td>
        <td><strong>${r.currNo || '-'}</strong></td>
        <td>${r.recSecDate ? formatISOToDDMMYYYY(r.recSecDate) : (r.letterDate ? formatISOToDDMMYYYY(r.letterDate) : '-')}</td>
        <td title="${r.subject || ''}">${truncate(r.subject || '-', 30)}</td>
        <td>${r.letterRef || '-'}</td>
        <td><span class="badge" style="background: rgba(255,255,255,0.08); color: #fff;">${r.mainOffice || '-'}</span></td>
        <td>${r.officerDesig || '-'}</td>
        <td><span class="badge ${getBadgeClass(r.status)}" onclick="toggleRecordStatus(${r.id})" style="cursor: pointer;" title="Click to update status">${r.status || 'Pending'}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }
}

function initCalendarModalEvents() {
  const openBtn = document.getElementById('btn-open-calendar-modal');
  const closeBtn = document.getElementById('btn-close-calendar-modal');
  const calModal = document.getElementById('calendar-modal');
  const applyRangeBtn = document.getElementById('btn-apply-date-range');
  const clearBtn = document.getElementById('btn-clear-calendar-filter');

  // Modal Date Pickers & Text Inputs
  const startPicker = document.getElementById('cal-filter-start');
  const startText = document.getElementById('cal-filter-start-text');
  const endPicker = document.getElementById('cal-filter-end');
  const endText = document.getElementById('cal-filter-end-text');

  // Timeline Slider Elements
  const slider = document.getElementById('date-range-slider');
  const sliderLabel = document.getElementById('slider-date-range-label');

  // Page Manual Elements
  const pageText = document.getElementById('page-manual-date-text');
  const pagePicker = document.getElementById('page-manual-date-picker');
  const pageSearchBtn = document.getElementById('btn-page-search-date');

  const pageRangeStartText = document.getElementById('page-range-start-text');
  const pageRangeStartPicker = document.getElementById('page-range-start-picker');
  const pageRangeEndText = document.getElementById('page-range-end-text');
  const pageRangeEndPicker = document.getElementById('page-range-end-picker');
  const pageSearchRangeBtn = document.getElementById('btn-page-search-range');

  const pageResetBtn = document.getElementById('btn-page-reset-date');

  // Bidirectional Calendar Picker & DD/MM/YYYY Text Input Sync
  bindDatePairSync(startText, startPicker);
  bindDatePairSync(endText, endPicker);
  bindDatePairSync(pageText, pagePicker);
  bindDatePairSync(pageRangeStartText, pageRangeStartPicker);
  bindDatePairSync(pageRangeEndText, pageRangeEndPicker);

  // Interactive Timeline Range Slider Handler
  if (slider && sliderLabel) {
    slider.oninput = () => {
      const day = String(slider.value).padStart(2, '0');
      const isoEnd = `2023-02-${day}`;
      const ddmmyyyyEnd = `${day}/02/2023`;
      if (endPicker) endPicker.value = isoEnd;
      if (endText) endText.value = ddmmyyyyEnd;
      sliderLabel.innerText = `Feb 01, 2023 - Feb ${day}, 2023`;
    };
  }

  // Modal Quick Presets Handler
  const modalPresets = document.querySelectorAll('.modal-preset-btn');
  modalPresets.forEach(btn => {
    btn.onclick = () => {
      modalPresets.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const preset = btn.dataset.preset;

      if (preset === 'FEB-2023') {
        if (startPicker) startPicker.value = '2023-02-01';
        if (startText) startText.value = '01/02/2023';
        if (endPicker) endPicker.value = '2023-02-28';
        if (endText) endText.value = '28/02/2023';
        if (slider) slider.value = 28;
        if (sliderLabel) sliderLabel.innerText = 'Feb 01, 2023 - Feb 28, 2023';
      } else if (preset === 'JAN-2023') {
        if (startPicker) startPicker.value = '2023-01-01';
        if (startText) startText.value = '01/01/2023';
        if (endPicker) endPicker.value = '2023-01-31';
        if (endText) endText.value = '31/01/2023';
        if (sliderLabel) sliderLabel.innerText = 'Jan 01, 2023 - Jan 31, 2023';
      } else if (preset === 'MAR-2023') {
        if (startPicker) startPicker.value = '2023-03-01';
        if (startText) startText.value = '01/03/2023';
        if (endPicker) endPicker.value = '2023-03-31';
        if (endText) endText.value = '31/03/2023';
        if (sliderLabel) sliderLabel.innerText = 'Mar 01, 2023 - Mar 31, 2023';
      } else if (preset === 'ALL') {
        activeDateFilter = null;
        renderRegisterTable();
        renderCalendarModule();
        if (calModal) calModal.classList.remove('active');
      }
    };
  });

  if (openBtn && calModal) openBtn.onclick = () => calModal.classList.add('active');
  if (closeBtn && calModal) closeBtn.onclick = () => calModal.classList.remove('active');

  // Apply Filter Button Handler
  if (applyRangeBtn) {
    applyRangeBtn.onclick = () => {
      let rawStart = (startText ? startText.value : '') || (startPicker ? startPicker.value : '');
      let rawEnd = (endText ? endText.value : '') || (endPicker ? endPicker.value : '');

      if (!rawStart || !rawEnd) return alert('Please select/enter both From and To dates in dd/mm/yyyy format.');

      const isoStart = parseDDMMYYYYToISO(rawStart);
      const isoEnd = parseDDMMYYYYToISO(rawEnd);
      if (!isoStart || !isoEnd) return alert('Please enter valid calendar dates in DD/MM/YYYY format.');

      activeDateFilter = { start: isoStart, end: isoEnd };
      if (calModal) calModal.classList.remove('active');
      renderRegisterTable();
      renderCalendarModule();
    };
  }

  // Clear Filter Button Handler
  if (clearBtn) {
    clearBtn.onclick = () => {
      activeDateFilter = null;
      if (startText) startText.value = '01/02/2023';
      if (startPicker) startPicker.value = '2023-02-01';
      if (endText) endText.value = '28/02/2023';
      if (endPicker) endPicker.value = '2023-02-28';
      if (calModal) calModal.classList.remove('active');
      renderRegisterTable();
      renderCalendarModule();
    };
  }

  // Page Single Date Search Handler
  if (pageSearchBtn) {
    pageSearchBtn.onclick = () => {
      let rawVal = (pageText ? pageText.value : '') || (pagePicker ? pagePicker.value : '');
      if (!rawVal) return alert('Please enter or select a date in DD/MM/YYYY format.');
      const isoDate = parseDDMMYYYYToISO(rawVal);
      if (!isoDate) return alert('Please enter a valid calendar date in DD/MM/YYYY format.');
      activeDateFilter = isoDate;
      renderCalendarModule();
      renderRegisterTable();
    };
  }

  // Page Date Range Search Handler
  if (pageSearchRangeBtn) {
    pageSearchRangeBtn.onclick = () => {
      let rawStart = (pageRangeStartText ? pageRangeStartText.value : '') || (pageRangeStartPicker ? pageRangeStartPicker.value : '');
      let rawEnd = (pageRangeEndText ? pageRangeEndText.value : '') || (pageRangeEndPicker ? pageRangeEndPicker.value : '');
      if (!rawStart || !rawEnd) return alert('Please enter both From and To dates in DD/MM/YYYY format.');
      const isoStart = parseDDMMYYYYToISO(rawStart);
      const isoEnd = parseDDMMYYYYToISO(rawEnd);
      if (!isoStart || !isoEnd) return alert('Please enter valid calendar dates in DD/MM/YYYY format.');
      activeDateFilter = { start: isoStart, end: isoEnd };
      renderCalendarModule();
      renderRegisterTable();
    };
  }

  if (pageResetBtn) {
    pageResetBtn.onclick = () => {
      activeDateFilter = null;
      if (pageText) pageText.value = '';
      if (pagePicker) pagePicker.value = '';
      if (pageRangeStartText) pageRangeStartText.value = '';
      if (pageRangeStartPicker) pageRangeStartPicker.value = '';
      if (pageRangeEndText) pageRangeEndText.value = '';
      if (pageRangeEndPicker) pageRangeEndPicker.value = '';
      renderCalendarModule();
      renderRegisterTable();
    };
  }
}

function initRegisterDateFilterEvents() {
  const regRangeStartText = document.getElementById('reg-range-start-text');
  const regRangeStartPicker = document.getElementById('reg-range-start-picker');
  const regRangeEndText = document.getElementById('reg-range-end-text');
  const regRangeEndPicker = document.getElementById('reg-range-end-picker');
  const btnFilterRange = document.getElementById('btn-reg-filter-range');

  const regSingleText = document.getElementById('reg-single-date-text');
  const regSinglePicker = document.getElementById('reg-single-date-picker');
  const btnSearchSingle = document.getElementById('btn-reg-search-date');
  const btnResetDate = document.getElementById('btn-reg-reset-date');

  // Quick Month Select Dropdown Handler
  const quickMonthSelect = document.getElementById('quick-month-select');
  if (quickMonthSelect) {
    quickMonthSelect.onchange = () => {
      const val = quickMonthSelect.value;
      if (val === 'ALL') {
        activeDateFilter = null;
      } else {
        activeDateFilter = val;
      }
      currentPage = 1;
      renderRegisterTable();
      updateFilterBadgeUI();
    };
  }

  // Sync Range Start, End, and Single Date
  bindDatePairSync(regRangeStartText, regRangeStartPicker);
  bindDatePairSync(regRangeEndText, regRangeEndPicker);
  bindDatePairSync(regSingleText, regSinglePicker);

  // Filter Range Action
  if (btnFilterRange) {
    btnFilterRange.onclick = () => {
      let rawStart = (regRangeStartText ? regRangeStartText.value : '') || (regRangeStartPicker ? regRangeStartPicker.value : '');
      let rawEnd = (regRangeEndText ? regRangeEndText.value : '') || (regRangeEndPicker ? regRangeEndPicker.value : '');
      if (!rawStart || !rawEnd) return alert('Please enter both From and To dates in DD/MM/YYYY format.');
      const isoStart = parseDDMMYYYYToISO(rawStart);
      const isoEnd = parseDDMMYYYYToISO(rawEnd);
      if (!isoStart || !isoEnd) return alert('Please enter valid calendar dates in DD/MM/YYYY format.');
      activeDateFilter = { start: isoStart, end: isoEnd };
      currentPage = 1;
      renderRegisterTable();
      updateFilterBadgeUI();
    };
  }

  // Search Single Date Action
  if (btnSearchSingle) {
    btnSearchSingle.onclick = () => {
      let rawVal = (regSingleText ? regSingleText.value : '') || (regSinglePicker ? regSinglePicker.value : '');
      if (!rawVal) return alert('Please enter or select a date in DD/MM/YYYY format.');
      const isoDate = parseDDMMYYYYToISO(rawVal);
      if (!isoDate) return alert('Please enter a valid calendar date in DD/MM/YYYY format.');
      activeDateFilter = isoDate;
      currentPage = 1;
      renderRegisterTable();
      updateFilterBadgeUI(rawVal);
    };
  }

  // Clear / Reset Date Filters Action
  if (btnResetDate) {
    btnResetDate.onclick = resetAllDateFilters;
  }
}

function resetAllDateFilters() {
  activeDateFilter = null;
  const regRangeStartText = document.getElementById('reg-range-start-text');
  const regRangeStartPicker = document.getElementById('reg-range-start-picker');
  const regRangeEndText = document.getElementById('reg-range-end-text');
  const regRangeEndPicker = document.getElementById('reg-range-end-picker');
  const regSingleText = document.getElementById('reg-single-date-text');
  const regSinglePicker = document.getElementById('reg-single-date-picker');

  if (regRangeStartText) regRangeStartText.value = '';
  if (regRangeStartPicker) regRangeStartPicker.value = '';
  if (regRangeEndText) regRangeEndText.value = '';
  if (regRangeEndPicker) regRangeEndPicker.value = '';
  if (regSingleText) regSingleText.value = '';
  if (regSinglePicker) regSinglePicker.value = '';

  populateQuickMonthDropdown();
  const quickMonthSelect = document.getElementById('quick-month-select');
  if (quickMonthSelect) quickMonthSelect.value = 'ALL';

  currentPage = 1;
  renderRegisterTable();
  updateFilterBadgeUI();
}

function updateFilterBadgeUI(searchedVal, filteredCount) {
  const statusBadge = document.getElementById('date-filter-status-badge');
  const rangeBadge = document.getElementById('range-file-count-badge');
  const rangeText = document.getElementById('range-count-text');

  let count = filteredCount;
  if (typeof count !== 'number') {
    if (!activeDateFilter) {
      count = tapalState.length;
    } else if (typeof activeDateFilter === 'object' && activeDateFilter && activeDateFilter.start && activeDateFilter.end) {
      count = tapalState.filter(item => {
        const itemDate = item.recSecDate || item.letterDate;
        return itemDate >= activeDateFilter.start && itemDate <= activeDateFilter.end;
      }).length;
    } else if (typeof activeDateFilter === 'string') {
      if (activeDateFilter.includes('-2023') || activeDateFilter.includes('-2024')) {
        const ym = getYearMonthFromKey(activeDateFilter);
        count = tapalState.filter(item => item.month === activeDateFilter || (item.recSecDate && item.recSecDate.startsWith(ym))).length;
      } else {
        count = tapalState.filter(item => item.recSecDate === activeDateFilter || item.letterDate === activeDateFilter).length;
      }
    } else {
      count = tapalState.length;
    }
  }

  const unitLabel = count === 1 ? 'file' : 'files';

  // Update Range Badge beside Filter Range button
  if (typeof activeDateFilter === 'object' && activeDateFilter && activeDateFilter.start && activeDateFilter.end) {
    if (rangeBadge && rangeText) {
      rangeBadge.style.display = 'inline-flex';
      rangeText.innerText = `${count} ${unitLabel}`;
      if (count === 0) {
        rangeBadge.style.color = '#ef4444';
        rangeBadge.style.background = 'rgba(239,68,68,0.15)';
        rangeBadge.style.borderColor = 'rgba(239,68,68,0.4)';
      } else {
        rangeBadge.style.color = '#34d399';
        rangeBadge.style.background = 'rgba(52,211,153,0.15)';
        rangeBadge.style.borderColor = 'rgba(52,211,153,0.4)';
      }
    }
  } else {
    if (rangeBadge) rangeBadge.style.display = 'none';
  }

  if (!statusBadge) return;

  if (!activeDateFilter) {
    statusBadge.style.color = '#ff79c6';
    statusBadge.innerHTML = `<i class="ri-calendar-check-line"></i> <span>Showing All Active Dates (${tapalState.length} ${tapalState.length === 1 ? 'file' : 'files'})</span>`;
  } else if (count === 0) {
    statusBadge.style.color = '#ef4444';
    let filterName = 'selected range';
    if (typeof activeDateFilter === 'object' && activeDateFilter.start && activeDateFilter.end) {
      filterName = `Range (${formatISOToDDMMYYYY(activeDateFilter.start)} to ${formatISOToDDMMYYYY(activeDateFilter.end)})`;
    } else if (typeof activeDateFilter === 'string') {
      filterName = `Date ${formatISOToDDMMYYYY(activeDateFilter)}`;
    }
    statusBadge.innerHTML = `<i class="ri-error-warning-line"></i> <span>No files found for ${filterName} — </span><a href="javascript:void(0)" onclick="resetAllDateFilters()" style="color:#38bdf8; text-decoration:underline; font-weight:800;">Reset Filter</a>`;
  } else if (typeof activeDateFilter === 'object' && activeDateFilter.start && activeDateFilter.end) {
    const startFmt = formatISOToDDMMYYYY(activeDateFilter.start);
    const endFmt = formatISOToDDMMYYYY(activeDateFilter.end);
    statusBadge.style.color = '#34d399';
    statusBadge.innerHTML = `<i class="ri-calendar-event-fill"></i> <span>Range: <strong>${startFmt}</strong> to <strong>${endFmt}</strong> — <strong>${count} ${unitLabel} found</strong></span>`;
  } else if (typeof activeDateFilter === 'string' && activeDateFilter.includes('-')) {
    const displayVal = activeDateFilter.includes('20') ? activeDateFilter.replace('-', ' ') : formatISOToDDMMYYYY(activeDateFilter);
    statusBadge.style.color = '#38bdf8';
    statusBadge.innerHTML = `<i class="ri-calendar-line"></i> <span>Filter: <strong>${displayVal}</strong> — <strong>${count} ${unitLabel} found</strong></span>`;
  } else {
    statusBadge.style.color = '#34d399';
    statusBadge.innerHTML = `<i class="ri-filter-3-line"></i> <span>Date Filter Active — <strong>${count} ${unitLabel} found</strong></span>`;
  }
}

function bindAllDateInputsInDOM() {
  const wrappers = document.querySelectorAll('.date-picker-input-wrapper');
  wrappers.forEach(wrap => {
    const textInput = wrap.querySelector('.custom-date-text-input');
    const pickerInput = wrap.querySelector('.custom-native-date-picker');
    if (textInput && pickerInput) {
      bindDatePairSync(textInput, pickerInput);
    }
  });
}

function initFileRefSearchEvents() {
  const fileRefInput = document.getElementById('file-ref-search-input');
  const clearBtn = document.getElementById('btn-clear-file-ref-search');

  if (fileRefInput) {
    fileRefInput.addEventListener('input', () => {
      const val = fileRefInput.value.trim();
      if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
      currentPage = 1;
      renderRegisterTable();
    });
  }

  if (clearBtn) {
    clearBtn.onclick = () => {
      if (fileRefInput) fileRefInput.value = '';
      clearBtn.style.display = 'none';
      currentPage = 1;
      renderRegisterTable();
      if (fileRefInput) fileRefInput.focus();
    };
  }
}

function updateInboxBadgeCount() {
  const badge = document.getElementById('inbox-unread-count');
  if (!badge) return;
  const openCount = complaintsState.filter(c => c.status !== 'Resolved').length;
  if (openCount > 0) {
    badge.innerText = openCount;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}
window.updateInboxBadgeCount = updateInboxBadgeCount;

function openRaiseComplaintModal(tapalId) {
  if (tapalId === undefined || tapalId === null || tapalId === '') return;
  const idStr = String(tapalId).trim();
  const item = tapalState.find(r => String(r.id) === idStr || String(r.sNo) === idStr || String(r.currNo) === idStr);
  if (!item) return;

  const modal = document.getElementById('raise-complaint-modal');
  if (!modal) return;

  document.getElementById('complaint-record-id').value = item.id;
  document.getElementById('complaint-modal-sno').innerText = `#${item.sNo}`;
  document.getElementById('complaint-curr-no').innerText = item.currNo || '0000';
  document.getElementById('complaint-subject').innerText = item.subject || '-';
  document.getElementById('complaint-sec-officer').innerText = `${item.techSecRef || 'General'} / ${item.officerDesig || item.mainOffice || '-'}`;
  
  const msgInput = document.getElementById('complaint-message');
  if (msgInput) msgInput.value = '';
  
  const catInput = document.getElementById('complaint-category');
  if (catInput) catInput.value = 'Correction / Typo';

  const prioInput = document.getElementById('complaint-priority');
  if (prioInput) prioInput.value = 'Medium';

  modal.classList.add('active');
  if (msgInput) msgInput.focus();
}
window.openRaiseComplaintModal = openRaiseComplaintModal;

function initComplaintModalEvents() {
  const modal = document.getElementById('raise-complaint-modal');
  const closeBtn = document.getElementById('btn-close-complaint-modal');
  const cancelBtn = document.getElementById('btn-cancel-complaint-modal');
  const form = document.getElementById('raise-complaint-form');

  if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
  if (cancelBtn) cancelBtn.onclick = () => modal.classList.remove('active');

  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const recId = parseInt(document.getElementById('complaint-record-id').value, 10);
      const item = tapalState.find(r => r.id === recId);
      if (!item) return;

      const category = document.getElementById('complaint-category').value;
      const priority = document.getElementById('complaint-priority').value;
      const raisedBy = document.getElementById('complaint-raised-by').value.trim();
      const message = document.getElementById('complaint-message').value.trim();

      if (!message) {
        alert('Please describe the problem or issue in detail.');
        return;
      }

      const newId = complaintsState.length > 0 ? Math.max(...complaintsState.map(c => c.id)) + 1 : 1;
      const code = 'CMP-' + String(newId).padStart(3, '0');
      const now = new Date();
      const dateFormatted = formatISOToDDMMYYYY(getTodayISO()) + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const newComplaint = {
        id: newId,
        code: code,
        tapalId: item.id,
        currNo: item.currNo || '',
        subject: item.subject || '-',
        mainOffice: item.mainOffice || '-',
        techSecRef: item.techSecRef || '-',
        officerDesig: item.officerDesig || '-',
        category: category,
        priority: priority,
        raisedBy: raisedBy || 'Official Staff',
        message: message,
        createdAt: now.toISOString(),
        dateFormatted: dateFormatted,
        status: 'Pending',
        adminNotes: '',
        resolvedAt: null
      };

      complaintsState.unshift(newComplaint);
      saveComplaintsStateToLocalStorage();
      updateInboxBadgeCount();
      renderRegisterTable();
      renderAdminInbox();

      modal.classList.remove('active');
      alert(`✅ Issue ${code} successfully registered and sent to Admin Inbox!`);
    };
  }

  // Inbox search and filters
  const searchInput = document.getElementById('inbox-search-input');
  const filterStatus = document.getElementById('inbox-filter-status');
  const filterPriority = document.getElementById('inbox-filter-priority');

  if (searchInput) searchInput.addEventListener('input', renderAdminInbox);
  if (filterStatus) filterStatus.addEventListener('change', renderAdminInbox);
  if (filterPriority) filterPriority.addEventListener('change', renderAdminInbox);
}

function renderAdminInbox() {
  const tbody = document.getElementById('inbox-tbody');
  if (!tbody) return;

  const totalEl = document.getElementById('inbox-kpi-total');
  const pendingEl = document.getElementById('inbox-kpi-pending');
  const reviewEl = document.getElementById('inbox-kpi-review');
  const resolvedEl = document.getElementById('inbox-kpi-resolved');

  const totalCount = complaintsState.length;
  const pendingCount = complaintsState.filter(c => c.status === 'Pending').length;
  const reviewCount = complaintsState.filter(c => c.status === 'Under Review').length;
  const resolvedCount = complaintsState.filter(c => c.status === 'Resolved').length;

  if (totalEl) totalEl.innerText = totalCount;
  if (pendingEl) pendingEl.innerText = pendingCount;
  if (reviewEl) reviewEl.innerText = reviewCount;
  if (resolvedEl) resolvedEl.innerText = resolvedCount;

  updateInboxBadgeCount();

  const searchVal = document.getElementById('inbox-search-input') ? document.getElementById('inbox-search-input').value.toLowerCase().trim() : '';
  const statusVal = document.getElementById('inbox-filter-status') ? document.getElementById('inbox-filter-status').value : 'ALL';
  const priorityVal = document.getElementById('inbox-filter-priority') ? document.getElementById('inbox-filter-priority').value : 'ALL';

  const filtered = complaintsState.filter(c => {
    const matchesSearch = !searchVal || 
      c.code.toLowerCase().includes(searchVal) ||
      (c.currNo && c.currNo.toLowerCase().includes(searchVal)) ||
      (c.subject && c.subject.toLowerCase().includes(searchVal)) ||
      (c.raisedBy && c.raisedBy.toLowerCase().includes(searchVal)) ||
      (c.message && c.message.toLowerCase().includes(searchVal)) ||
      (c.category && c.category.toLowerCase().includes(searchVal));

    const matchesStatus = statusVal === 'ALL' || c.status === statusVal;
    const matchesPriority = priorityVal === 'ALL' || c.priority === priorityVal;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 32px; color: var(--text-muted);"><i class="ri-inbox-line" style="font-size: 28px; display: block; margin-bottom: 8px;"></i>No complaints or issues found in the Admin Inbox.</td></tr>`;
    return;
  }

  filtered.forEach(c => {
    const tr = document.createElement('tr');

    let priorityBadge = `<span class="badge" style="background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid #38bdf8; padding: 4px 8px; font-weight: 700;">🟢 Low</span>`;
    if (c.priority === 'Urgent') {
      priorityBadge = `<span class="badge" style="background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid #ef4444; font-weight: 800; padding: 4px 8px;"><i class="ri-alarm-warning-fill" style="margin-right: 3px;"></i>🚨 Urgent</span>`;
    } else if (c.priority === 'High') {
      priorityBadge = `<span class="badge" style="background: rgba(249,115,22,0.2); color: #fb923c; border: 1px solid #f97316; font-weight: 700; padding: 4px 8px;">🟠 High</span>`;
    } else if (c.priority === 'Medium') {
      priorityBadge = `<span class="badge" style="background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid #f59e0b; font-weight: 700; padding: 4px 8px;">🟡 Medium</span>`;
    }

    let statusBadge = `<span class="badge badge-pending" style="cursor: pointer; padding: 4px 10px; font-weight: 700;" onclick="toggleComplaintStatus(${c.id})" title="Click to cycle status">⏳ Pending</span>`;
    if (c.status === 'Under Review') {
      statusBadge = `<span class="badge" style="background: rgba(56,189,248,0.2); color: #38bdf8; border: 1px solid #38bdf8; cursor: pointer; padding: 4px 10px; font-weight: 700;" onclick="toggleComplaintStatus(${c.id})" title="Click to cycle status">🔍 Under Review</span>`;
    } else if (c.status === 'Resolved') {
      statusBadge = `<span class="badge badge-filed" style="cursor: pointer; padding: 4px 10px; font-weight: 700; background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid #10b981;" onclick="toggleComplaintStatus(${c.id})" title="Click to cycle status">✅ Resolved</span>`;
    }

    tr.innerHTML = `
      <td><span class="badge" style="background: rgba(56,189,248,0.15); color: #38bdf8; font-weight: 800; font-size: 11px; padding: 4px 8px; border: 1px solid rgba(56,189,248,0.3);">${c.code}</span></td>
      <td><strong style="color: #38bdf8; font-size: 13px;">${c.currNo || '-'}</strong></td>
      <td title="${c.subject}"><div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: #f8fafc;">${truncate(c.subject, 26)}</div></td>
      <td><span style="font-size: 12px; color: #cbd5e1; font-weight: 500;">${c.category}</span></td>
      <td style="text-align: center;">${priorityBadge}</td>
      <td>
        <div style="max-width: 280px; font-size: 12px; color: #f1f5f9; line-height: 1.45; background: rgba(15,23,42,0.6); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
          ${c.message}
        </div>
      </td>
      <td>
        <div style="font-size: 12px;">
          <div style="font-weight: 700; color: #f8fafc; margin-bottom: 2px;"><i class="ri-user-3-line" style="color: #38bdf8;"></i> ${c.raisedBy}</div>
          <div style="font-size: 11px; color: #94a3b8;"><i class="ri-time-line"></i> ${c.dateFormatted}</div>
        </div>
      </td>
      <td style="text-align: center;">${statusBadge}</td>
      <td style="text-align: center;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
          <button class="btn btn-secondary btn-sm" onclick="viewRecordDetails(${c.tapalId})" title="View Tapal Details" style="color: #38bdf8; border-color: rgba(56,189,248,0.4); padding: 6px 9px;">
            <i class="ri-eye-line"></i>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="toggleComplaintStatus(${c.id})" title="Change Status" style="color: #fbbf24; border-color: rgba(251,191,36,0.4); padding: 6px 9px;">
            <i class="ri-refresh-line"></i>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="deleteComplaint(${c.id})" title="Delete Complaint" style="color: #ef4444; border-color: rgba(239,68,68,0.4); padding: 6px 9px;">
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
window.renderAdminInbox = renderAdminInbox;

function toggleComplaintStatus(id) {
  const item = complaintsState.find(c => c.id === id);
  if (!item) return;

  const nextStatus = {
    'Pending': 'Under Review',
    'Under Review': 'Resolved',
    'Resolved': 'Pending'
  };

  item.status = nextStatus[item.status] || 'Pending';
  saveComplaintsStateToLocalStorage();
  renderAdminInbox();
  renderRegisterTable();
}
window.toggleComplaintStatus = toggleComplaintStatus;

function deleteComplaint(id) {
  if (confirm('Are you sure you want to delete this complaint record?')) {
    complaintsState = complaintsState.filter(c => String(c.id) !== String(id));
    saveComplaintsStateToLocalStorage();
    renderAdminInbox();
    renderRegisterTable();
    updateInboxBadgeCount();
    if (typeof showToast === 'function') showToast('Complaint deleted successfully.', 'info');
  }
}
window.deleteComplaint = deleteComplaint;

function exportComplaintsCSV() {
  if (complaintsState.length === 0) return alert('No complaints to export!');

  const headers = ['Issue ID', 'Inward No', 'Tapal Subject', 'Category', 'Priority', 'Description', 'Raised By', 'Created Date', 'Status'];
  const rows = complaintsState.map(c => [
    `"${c.code}"`,
    `"${c.currNo}"`,
    `"${(c.subject || '').replace(/"/g, '""')}"`,
    `"${c.category}"`,
    `"${c.priority}"`,
    `"${(c.message || '').replace(/"/g, '""')}"`,
    `"${c.raisedBy}"`,
    `"${c.dateFormatted}"`,
    `"${c.status}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Tapal_Admin_Complaints_${getTodayISO()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
window.exportComplaintsCSV = exportComplaintsCSV;

// -------------------------------------------------------------
// FOLLOW UP CASES & REMINDER ALERT MODULE
// -------------------------------------------------------------
function getFollowUpAlertInfo(item) {
  if (item.followUpStatus === 'Closed' || item.followUpClosedDate) {
    return {
      category: 'CLOSED',
      badgeHtml: `<span class="badge" style="background: rgba(16,185,129,0.15); border: 1px solid #10b981; color: #34d399; font-weight: 700;">🟢 Closed / Resolved</span>`,
      statusLabel: 'Closed',
      urgencyOrder: 4
    };
  }

  if (!item.followUpDate) {
    return {
      category: 'NO_DATE',
      badgeHtml: `<span class="badge" style="background: rgba(148,163,184,0.15); border: 1px solid #64748b; color: #94a3b8; font-weight: 700;">⚪ No Alert Date</span>`,
      statusLabel: 'No Date',
      urgencyOrder: 3
    };
  }

  const today = getTodayISO();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().split('T')[0];

  if (item.followUpDate < today) {
    const daysOver = calculateDaysBetween(item.followUpDate, today);
    return {
      category: 'OVERDUE_TODAY',
      badgeHtml: `<span class="badge" style="background: rgba(239,68,68,0.2); border: 1px solid #ef4444; color: #f87171; font-weight: 800;">🚨 Overdue (${daysOver}d)</span>`,
      statusLabel: 'Overdue',
      urgencyOrder: 0
    };
  }

  if (item.followUpDate === today) {
    return {
      category: 'OVERDUE_TODAY',
      badgeHtml: `<span class="badge" style="background: rgba(239,68,68,0.2); border: 1px solid #ef4444; color: #f87171; font-weight: 800;">🔴 Due Today!</span>`,
      statusLabel: 'Due Today',
      urgencyOrder: 0
    };
  }

  if (item.followUpDate === tomorrowISO) {
    return {
      category: 'DUE_TOMORROW',
      badgeHtml: `<span class="badge" style="background: rgba(245,158,11,0.2); border: 1px solid #f59e0b; color: #fbbf24; font-weight: 800;">🟡 Due Tomorrow (1-Day Reminder)</span>`,
      statusLabel: 'Due Tomorrow',
      urgencyOrder: 1
    };
  }

  return {
    category: 'UPCOMING',
    badgeHtml: `<span class="badge" style="background: rgba(56,189,248,0.15); border: 1px solid #38bdf8; color: #38bdf8; font-weight: 700;">🔵 Upcoming</span>`,
    statusLabel: 'Upcoming',
    urgencyOrder: 2
  };
}

function closeFollowUpCase(id) {
  const item = tapalState.find(r => r.id === id);
  if (!item) return;

  const today = getTodayISO();
  item.followUpStatus = 'Closed';
  item.followUpClosedDate = today;

  saveTapalStateToLocalStorage();
  renderFollowUpModule();
  renderDashboard();
  renderDashboardFollowUpAlerts();
  renderRegisterTable();
  updateFollowUpBadgeCount();
  alert(`✅ Follow Up Case for Inward #${item.currNo} closed successfully!\nClosure Date recorded: ${formatISOToDDMMYYYY(today)}.`);
}
window.closeFollowUpCase = closeFollowUpCase;

function reopenFollowUpCase(id) {
  const item = tapalState.find(r => r.id === id);
  if (!item) return;

  item.followUpStatus = 'Open';
  item.followUpClosedDate = '';

  saveTapalStateToLocalStorage();
  renderFollowUpModule();
  renderDashboard();
  renderDashboardFollowUpAlerts();
  renderRegisterTable();
  updateFollowUpBadgeCount();
  alert(`🔔 Follow Up Case for Inward #${item.currNo} re-opened.`);
}
window.reopenFollowUpCase = reopenFollowUpCase;

function updateFollowUpBadgeCount() {
  const badge = document.getElementById('followup-alert-count');
  if (!badge) return;

  const alerts = tapalState.filter(r => {
    if (r.followUpStatus === 'Closed' || r.followUpClosedDate) return false;
    if (!r.followUp || r.followUp.trim() === '' || r.followUp === '-') return false;
    const info = getFollowUpAlertInfo(r);
    return info.category === 'DUE_TOMORROW' || info.category === 'OVERDUE_TODAY';
  });

  if (alerts.length > 0) {
    badge.style.display = 'inline-block';
    badge.innerText = alerts.length;
  } else {
    badge.style.display = 'none';
  }
}
window.updateFollowUpBadgeCount = updateFollowUpBadgeCount;

function renderDashboardFollowUpAlerts() {
  const container = document.getElementById('dashboard-followup-alert-container');
  if (!container) return;

  const activeAlerts = tapalState.filter(r => {
    if (r.followUpStatus === 'Closed' || r.followUpClosedDate) return false;
    if (!r.followUp || r.followUp.trim() === '' || r.followUp === '-') return false;
    const info = getFollowUpAlertInfo(r);
    return info.category === 'DUE_TOMORROW' || info.category === 'OVERDUE_TODAY';
  });

  if (activeAlerts.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'block';

  // Sort: Overdue/Today first, then Tomorrow
  activeAlerts.sort((a, b) => {
    const infoA = getFollowUpAlertInfo(a);
    const infoB = getFollowUpAlertInfo(b);
    return (infoA.urgencyOrder - infoB.urgencyOrder) || ((a.followUpDate || '').localeCompare(b.followUpDate || ''));
  });

  const alertCardsHtml = activeAlerts.slice(0, 4).map(item => {
    const info = getFollowUpAlertInfo(item);
    const isTomorrow = info.category === 'DUE_TOMORROW';
    const borderColor = isTomorrow ? 'rgba(251,191,36,0.4)' : 'rgba(239,68,68,0.5)';
    const bgColor = isTomorrow ? 'rgba(251,191,36,0.08)' : 'rgba(239,68,68,0.1)';
    const iconColor = isTomorrow ? '#fbbf24' : '#ef4444';

    return `
      <div style="background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 22px; color: ${iconColor};"><i class="${isTomorrow ? 'ri-alarm-warning-line' : 'ri-error-warning-fill'}"></i></div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <strong style="color: #fff; font-size: 13px;">Inward #${item.currNo}</strong>
              <span class="badge" style="background: rgba(56,189,248,0.15); color: #38bdf8; font-size: 11px;">${item.techSecRef || 'Section'}</span>
              ${info.badgeHtml}
            </div>
            <div style="font-size: 12px; color: #cbd5e1; margin-top: 3px;">
              <strong>Follow Up:</strong> <span style="color: #fbbf24;">${item.followUp}</span> • <strong>Alert Date:</strong> ${formatISOToDDMMYYYY(item.followUpDate)} • <span style="color: #94a3b8;">${truncate(item.subject, 35)}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="btn btn-sm" onclick="closeFollowUpCase(${item.id})" style="background: #10b981; color: #fff; font-weight: 700; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Stop alert and record closure date as today">
            <i class="ri-check-line"></i> Close Alert
          </button>
          <button class="btn btn-secondary btn-sm" onclick="viewRecordDetails(${item.id})" style="padding: 6px 10px; font-size: 12px;">
            <i class="ri-eye-line"></i> View
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98)); border: 1.5px solid rgba(251, 191, 36, 0.5); border-radius: 14px; padding: 18px 20px; box-shadow: 0 8px 25px rgba(0,0,0,0.35);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(251,191,36,0.2); color: #fbbf24; display: flex; align-items: center; justify-content: center; font-size: 18px;">
            <i class="ri-notification-3-line"></i>
          </div>
          <div>
            <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: #f8fafc; letter-spacing: 0.5px;">
              🔔 ACTION REQUIRED: ACTIVE FOLLOW UP CASE ALERTS (${activeAlerts.length})
            </h4>
            <p style="margin: 2px 0 0; font-size: 12px; color: #fbbf24; font-weight: 600;">
              Reminder alerts due tomorrow (1-day notice) or requiring immediate attention today.
            </p>
          </div>
        </div>

        <button class="btn btn-secondary btn-sm" onclick="navigateToFollowUpPane()" style="border-color: rgba(251,191,36,0.5); color: #fbbf24; font-weight: 700; display: flex; align-items: center; gap: 6px;">
          View All Follow Ups <i class="ri-arrow-right-line"></i>
        </button>
      </div>

      <div style="display: grid; gap: 10px;">
        ${alertCardsHtml}
      </div>
    </div>
  `;
}
window.renderDashboardFollowUpAlerts = renderDashboardFollowUpAlerts;

function navigateToFollowUpPane() {
  const navItem = document.querySelector('.nav-item[data-tab="followup-pane"]');
  if (navItem) navItem.click();
}
window.navigateToFollowUpPane = navigateToFollowUpPane;

function renderFollowUpModule() {
  const tbody = document.getElementById('followup-tbody');
  if (!tbody) return;

  // 1. Populate Section Filter Dropdown
  const secSelect = document.getElementById('fu-filter-section');
  if (secSelect && secSelect.options.length <= 1) {
    const secSet = new Set();
    tapalState.forEach(r => {
      if (r.techSecRef && r.techSecRef !== '-' && !r.techSecRef.startsWith('__')) secSet.add(r.techSecRef);
    });
    secSet.forEach(sec => {
      const opt = document.createElement('option');
      opt.value = sec;
      opt.innerText = sec;
      secSelect.appendChild(opt);
    });
    secSelect.onchange = () => renderFollowUpModule();
  }

  // 2. Setup Filter Listeners
  const searchInput = document.getElementById('fu-search-input');
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = 'true';
    searchInput.oninput = () => renderFollowUpModule();
  }
  const statusSelect = document.getElementById('fu-filter-status');
  if (statusSelect && !statusSelect.dataset.bound) {
    statusSelect.dataset.bound = 'true';
    statusSelect.onchange = () => renderFollowUpModule();
  }

  // 3. Filter Records that have Follow Up cases registered
  const followUpItems = tapalState.filter(r => (r.followUp && r.followUp.trim() !== '' && r.followUp !== '-') || r.followUpDate || r.followUpStatus === 'Closed' || r.followUpClosedDate);

  // Compute KPIs
  let totCount = followUpItems.length;
  let tomCount = 0;
  let overCount = 0;
  let closedCount = 0;

  followUpItems.forEach(item => {
    const info = getFollowUpAlertInfo(item);
    if (info.category === 'CLOSED') closedCount++;
    else if (info.category === 'DUE_TOMORROW') tomCount++;
    else if (info.category === 'OVERDUE_TODAY') overCount++;
  });

  const kpiTotal = document.getElementById('fu-kpi-total');
  const kpiTom = document.getElementById('fu-kpi-tomorrow');
  const kpiOver = document.getElementById('fu-kpi-overdue');
  const kpiClosed = document.getElementById('fu-kpi-closed');
  if (kpiTotal) kpiTotal.innerText = totCount;
  if (kpiTom) kpiTom.innerText = tomCount;
  if (kpiOver) kpiOver.innerText = overCount;
  if (kpiClosed) kpiClosed.innerText = closedCount;

  // Apply User Filters
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const statusVal = statusSelect ? statusSelect.value : 'ALL';
  const secVal = secSelect ? secSelect.value : 'ALL';

  let displayItems = followUpItems.filter(item => {
    const info = getFollowUpAlertInfo(item);

    if (statusVal === 'DUE_TOMORROW' && info.category !== 'DUE_TOMORROW') return false;
    if (statusVal === 'OVERDUE_TODAY' && info.category !== 'OVERDUE_TODAY') return false;
    if (statusVal === 'UPCOMING' && info.category !== 'UPCOMING') return false;
    if (statusVal === 'CLOSED' && info.category !== 'CLOSED') return false;

    if (secVal !== 'ALL' && item.techSecRef !== secVal) return false;

    if (searchVal) {
      const matchCurrNo = String(item.currNo || '').toLowerCase().includes(searchVal);
      const matchSub = (item.subject || '').toLowerCase().includes(searchVal);
      const matchFollow = (item.followUp || '').toLowerCase().includes(searchVal);
      const matchOfficer = (item.officerDesig || '').toLowerCase().includes(searchVal);
      const matchSec = (item.techSecRef || '').toLowerCase().includes(searchVal);
      if (!matchCurrNo && !matchSub && !matchFollow && !matchOfficer && !matchSec) return false;
    }
    return true;
  });

  // Sort Chronologically by Alert Date (Earliest / Most Urgent first, Closed last)
  displayItems.sort((a, b) => {
    const infoA = getFollowUpAlertInfo(a);
    const infoB = getFollowUpAlertInfo(b);
    if (infoA.urgencyOrder !== infoB.urgencyOrder) {
      return infoA.urgencyOrder - infoB.urgencyOrder;
    }
    const dateA = a.followUpDate || '9999-99-99';
    const dateB = b.followUpDate || '9999-99-99';
    return dateA.localeCompare(dateB);
  });

  // Render Table
  tbody.innerHTML = '';
  if (displayItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: #94a3b8; font-size: 14px;">📭 No follow up cases matching the current filters.</td></tr>`;
    return;
  }

  displayItems.forEach(item => {
    const info = getFollowUpAlertInfo(item);
    const isClosed = info.category === 'CLOSED';
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td style="padding: 12px 14px; font-weight: 800; color: #38bdf8;">#${item.currNo || item.sNo}</td>
      <td style="padding: 12px 14px;">
        <span class="badge" style="background: rgba(56,189,248,0.15); color: #38bdf8; font-weight: 700;">${item.techSecRef || '-'}</span>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${item.officerDesig || item.empDesig || '-'}</div>
      </td>
      <td style="padding: 12px 14px; max-width: 250px;" title="${item.subject || ''}">
        <div style="font-weight: 600; color: #f8fafc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.subject || '-'}</div>
        <div style="font-size: 11px; color: #94a3b8;">${item.letterRef || '-'}</div>
      </td>
      <td style="padding: 12px 14px; color: #fbbf24; font-weight: 700;">${item.followUp || '-'}</td>
      <td style="padding: 12px 14px; text-align: center; font-weight: 700; color: #f8fafc;">
        ${item.followUpDate ? formatISOToDDMMYYYY(item.followUpDate) : '<span style="color: #64748b;">-</span>'}
      </td>
      <td style="padding: 12px 14px; text-align: center;">${info.badgeHtml}</td>
      <td style="padding: 12px 14px; text-align: center;">
        ${item.followUpClosedDate ? `<span class="badge" style="background: rgba(16,185,129,0.15); border: 1px solid #10b981; color: #34d399; font-weight: 700;">✓ ${formatISOToDDMMYYYY(item.followUpClosedDate)}</span>` : '<span style="color: #94a3b8; font-style: italic;">Pending Action</span>'}
      </td>
      <td style="padding: 12px 14px; text-align: center;">
        <div style="display: inline-flex; align-items: center; gap: 6px;">
          ${!isClosed ? `
            <button class="btn btn-sm" onclick="closeFollowUpCase(${item.id})" style="background: #10b981; color: #fff; font-weight: 700; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Stop alert and record closure date as today">
              <i class="ri-check-line"></i> Close Alert
            </button>
          ` : `
            <button class="btn btn-secondary btn-sm" onclick="reopenFollowUpCase(${item.id})" style="padding: 5px 10px; font-size: 11px; color: #38bdf8; border-color: rgba(56,189,248,0.4);" title="Re-open this follow up alert">
              <i class="ri-restart-line"></i> Re-open
            </button>
          `}
          <button class="btn btn-secondary btn-sm" onclick="openEditRecordModal(${item.id})" style="padding: 5px 8px; font-size: 12px;" title="Edit Alert Date / Follow Up">
            <i class="ri-edit-line"></i>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="viewRecordDetails(${item.id})" style="padding: 5px 8px; font-size: 12px;" title="View Details">
            <i class="ri-eye-line"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
window.renderFollowUpModule = renderFollowUpModule;

function exportFollowUpCSV() {
  const items = tapalState.filter(r => (r.followUp && r.followUp.trim() !== '' && r.followUp !== '-') || r.followUpDate || r.followUpStatus === 'Closed' || r.followUpClosedDate);
  if (items.length === 0) return alert('No follow up records to export!');

  const headers = ['Inward No', 'Section', 'Officer', 'Subject', 'Letter Ref', 'Follow Up Details', 'Alert Date', 'Alert Status', 'Closure Date'];
  const rows = items.map(r => {
    const info = getFollowUpAlertInfo(r);
    return [
      `"${r.currNo || r.sNo}"`,
      `"${r.techSecRef || ''}"`,
      `"${r.officerDesig || ''}"`,
      `"${(r.subject || '').replace(/"/g, '""')}"`,
      `"${(r.letterRef || '').replace(/"/g, '""')}"`,
      `"${(r.followUp || '').replace(/"/g, '""')}"`,
      `"${r.followUpDate ? formatISOToDDMMYYYY(r.followUpDate) : ''}"`,
      `"${info.statusLabel}"`,
      `"${r.followUpClosedDate ? formatISOToDDMMYYYY(r.followUpClosedDate) : ''}"`
    ];
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Tapal_Follow_Up_Cases_${getTodayISO()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
window.exportFollowUpCSV = exportFollowUpCSV;

// Automatically bind all date input wrappers and custom add-on listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof initCustomAddOnListeners === 'function') initCustomAddOnListeners();
  if (typeof populateDashboardSectionDropdown === 'function') populateDashboardSectionDropdown();
  if (typeof updateEmpDesigFilterDropdown === 'function') updateEmpDesigFilterDropdown();
  if (typeof updateEmpDesigModalDropdown === 'function') updateEmpDesigModalDropdown('register');
  bindAllDateInputsInDOM();
  initFileRefSearchEvents();
  initComplaintModalEvents();
  initRemindersModalEvents();
  renderAdminInbox();
  updateInboxBadgeCount();
  renderRegisterTable();
  renderFollowUpModule();
  renderDashboardFollowUpAlerts();
  updateFollowUpBadgeCount();
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  bindAllDateInputsInDOM();
}

