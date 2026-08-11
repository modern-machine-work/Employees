const API_CONFIG_KEY = 'mmwEmployeeApiUrl';
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbx_xHAyop1J6QbSez84NWqZ5Ld1xEmCyZW0HJqFLijVGzjk6URMtbs_OPujQ4QXXPk/exec';
let sessionExpiredHandled = false;

function getApiUrl() {
  return localStorage.getItem(API_CONFIG_KEY) || DEFAULT_API_URL;
}

function setApiUrl(url) {
  localStorage.setItem(API_CONFIG_KEY, url.trim());
}

function getAuthToken() {
  return localStorage.getItem('mmwToken') || '';
}

function clearAuthState() {
  localStorage.removeItem('mmwAuth');
  localStorage.removeItem('mmwToken');
  localStorage.removeItem('mmwUser');
  localStorage.removeItem('mmwRole');
  localStorage.removeItem('mmwEmployeeID');
}

function handleSessionExpired() {
  clearAuthState();
  if (!sessionExpiredHandled) {
    sessionExpiredHandled = true;
    window.location.hash = 'login';
  }
}

function showLoader() {
  document.getElementById('loader')?.classList.remove('hidden');
}

function hideLoader() {
  document.getElementById('loader')?.classList.add('hidden');
}

async function parseApiResponse(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok || payload.success === false) {
    const message = payload.message || `Request failed with status ${response.status}`;
    if (message.toLowerCase().includes('login required') || message.toLowerCase().includes('session expired')) {
      handleSessionExpired();
      const authError = new Error(message);
      authError.isAuthError = true;
      throw authError;
    }
    throw new Error(message);
  }
  return payload.data ?? payload;
}

async function apiGet(action, params = {}) {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error('API URL is required.');
  }

  const url = new URL(apiUrl);
  url.searchParams.set('action', action);
  const token = getAuthToken();
  if (token) {
    url.searchParams.set('token', token);
  }
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  showLoader();
  try {
    const response = await fetch(url.toString(), { method: 'GET' });
    return await parseApiResponse(response);
  } finally {
    hideLoader();
  }
}

async function apiPost(action, data = {}) {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error('API URL is required.');
  }

  showLoader();
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: JSON.stringify({ action, data, token: getAuthToken() }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    });
    return await parseApiResponse(response);
  } finally {
    hideLoader();
  }
}
