async function initLoginPage() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const toggle = document.getElementById('passwordToggle');
  const pwInput = document.getElementById('password');
  toggle?.addEventListener('click', () => {
    const show = pwInput.type === 'password';
    pwInput.type = show ? 'text' : 'password';
    toggle.classList.toggle('active', show);
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorNode = document.getElementById('loginError');
    errorNode.textContent = '';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
      const ok = await login(username, password);
      if (ok) {
        window.location.hash = getDefaultRoute();
      } else {
        errorNode.textContent = 'Invalid login response.';
      }
    } catch (error) {
      errorNode.textContent = error.message;
    }
  });
}
