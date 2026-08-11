const routes = {
  login: { title: 'Login', init: 'initLoginPage', public: true },
  employee: { title: 'My Portal', init: 'initEmployeePage' },
  admin: { title: 'Admin Portal', init: 'initAdminPage' },
};

function getCurrentRoute() {
  return window.location.hash.replace('#', '') || getDefaultRoute();
}

function getDefaultRoute() {
  const role = getRole().toLowerCase();
  return role === 'admin' ? 'admin' : 'employee';
}

async function loadHtml(path) {
  const response = await fetch(`${path}?v=${APP_VERSION}`);
  if (!response.ok) {
    throw new Error(`Unable to load ${path}`);
  }
  return response.text();
}

function setActiveNavigation(routeName) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.route === routeName);
  });
}

async function navigateTo(routeName = getCurrentRoute()) {
  const route = routes[routeName] || routes[getDefaultRoute()];
  const authenticated = isAuthenticated();

  if (!route.public && !authenticated) {
    window.location.hash = 'login';
    return;
  }

  if (route.public && authenticated) {
    window.location.hash = getDefaultRoute();
    return;
  }

  showLoader();
  try {
    if (!route.public && getAuthToken()) {
      await apiGet('validateSession');
    }

    const target = route.public ? document.getElementById('authContent') : document.getElementById('pageContent');
    target.innerHTML = await loadHtml(`pages/${routeName}.html`);
    const isPublicRoute = Boolean(route.public);
    document.getElementById('authLayout').classList.toggle('hidden', !isPublicRoute);
    document.getElementById('appLayout').classList.toggle('hidden', isPublicRoute);
    document.title = `MMW Employee Portal - ${route.title}`;
    setActiveNavigation(routeName);

    if (!route.public) {
      setupShell();
    }

    if (typeof window[route.init] === 'function') {
      await window[route.init]();
    }
  } catch (error) {
    if (!error.isAuthError) {
      alert(error.message);
    }
  } finally {
    hideLoader();
  }
}

function startRouter() {
  window.addEventListener('hashchange', () => navigateTo());
  navigateTo();
}

window.addEventListener('DOMContentLoaded', startRouter);
