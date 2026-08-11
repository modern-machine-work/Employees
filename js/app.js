const APP_VERSION = window.APP_VERSION || '1.0.0';
const AUTH_KEY = 'mmwAuth';

function isAuthenticated() {
  if (getApiUrl() && !localStorage.getItem('mmwToken')) {
    return false;
  }
  return localStorage.getItem(AUTH_KEY) === 'true';
}

function getRole() {
  return localStorage.getItem('mmwRole') || '';
}

function getEmployeeID() {
  return localStorage.getItem('mmwEmployeeID') || '';
}

async function login(username, password) {
  const response = await apiPost('login', { username, password });
  if (response.authenticated) {
    sessionExpiredHandled = false;
    localStorage.setItem(AUTH_KEY, 'true');
    localStorage.setItem('mmwUser', response.username || username);
    localStorage.setItem('mmwToken', response.token || '');
    localStorage.setItem('mmwRole', response.role || 'User');
    localStorage.setItem('mmwEmployeeID', response.employeeID || '');
    return true;
  }
  return false;
}

function logout() {
  clearAuthState();
  window.location.hash = 'login';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
}

function formatDateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateValue(value) {
  const text = String(value || '').slice(0, 10);
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  match = text.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateDisplay(value) {
  const date = parseDateValue(value);
  if (!date) return value || '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatCurrency(value) {
  const num = Number(value || 0);
  return '₹ ' + num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function minutesToHours(minutes) {
  const num = Number(minutes || 0);
  return (num / 60).toFixed(2);
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getTodayDateString() {
  return formatDateStamp();
}

function calculateEarnedSalary(employee, monthKey) {
  const salaryType = String(employee.SalaryType || 'Monthly').toLowerCase();
  const monthly = Number(employee.MonthlySalary || 0);
  const perDay = Number(employee.PerDaySalary || monthly / 26 || 0);
  const perHour = Number(employee.PerHourSalary || (monthly / 26) / 11 || 0);

  if (salaryType === 'monthly') {
    const now = new Date();
    const dateInMonth = parseDateValue(monthKey + '-01');
    const daysInMonth = new Date(dateInMonth.getFullYear(), dateInMonth.getMonth() + 1, 0).getDate();
    const daysUntilToday = Math.min(now.getDate(), daysInMonth);
    return (monthly / daysInMonth) * daysUntilToday;
  }

  if (salaryType === 'daily') {
    const daysWorked = Number(employee._daysWorked || 0);
    return perDay * daysWorked;
  }

  if (salaryType === 'hourly') {
    const hoursWorked = Number(employee._hoursWorked || 0);
    return perHour * hoursWorked;
  }

  return monthly;
}

function buildCalendarGrid(year, month, attendanceDates) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay(); // 0 = Sunday
  const total = last.getDate();
  const cells = [];

  for (let i = 0; i < startDay; i += 1) {
    cells.push(null);
  }

  for (let d = 1; d <= total; d += 1) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      date: dateStr,
      day: d,
      present: attendanceDates.has(dateStr),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function normalizeDateStr(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function loadComponent(id, path) {
  return fetch(`${path}?v=${APP_VERSION}`)
    .then((res) => res.text())
    .then((html) => {
      document.getElementById(id).innerHTML = html;
    });
}

function setupShell() {
  document.body.classList.add('no-sidebar');
  document.getElementById('sidebar').innerHTML = '';

  loadComponent('navbar', 'components/navbar.html').then(() => {
    document.getElementById('navbar')?.classList.add('portal-navbar');
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
  });
}

window.addEventListener('load', () => {
  if (isAuthenticated()) {
    setupShell();
  }
});
