(() => {
  'use strict';

  const TIMEOUT_MS = 12000;

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Sign-in timed out. Check your connection and try again.')), ms)),
    ]);
  }

  function install(form) {
    if (!form || form.dataset.authGuard === '1') return;
    form.dataset.authGuard = '1';

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const button = form.querySelector('button');
      const error = form.querySelector('.login-error');
      const email = form.querySelector('input[name="email"]')?.value?.trim() || '';
      const password = form.querySelector('input[name="password"]')?.value || '';

      if (!email || !password) {
        if (error) error.textContent = 'Enter your Chill Pros email and password.';
        return;
      }

      if (!window.firebase?.auth) {
        if (error) error.textContent = 'Secure sign-in is still loading. Try again in a moment.';
        return;
      }

      if (button?.disabled) return;
      if (error) error.textContent = '';
      if (button) {
        button.disabled = true;
        button.dataset.originalText = button.textContent || 'SIGN IN';
        button.textContent = 'SIGNING IN…';
        button.setAttribute('aria-busy', 'true');
      }

      try {
        await withTimeout(firebase.auth().signInWithEmailAndPassword(email, password), TIMEOUT_MS);
      } catch (err) {
        console.error('[Chill Pros auth]', err);
        if (error) {
          const code = String(err?.code || '');
          if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
            error.textContent = 'Email or password is incorrect.';
          } else if (code.includes('too-many-requests')) {
            error.textContent = 'Too many sign-in attempts. Wait a moment and try again.';
          } else if (code.includes('network-request-failed')) {
            error.textContent = 'Network error. Check your connection and try again.';
          } else {
            error.textContent = err?.message || 'Sign-in failed. Please try again.';
          }
        }
        if (button) {
          button.disabled = false;
          button.textContent = button.dataset.originalText || 'SIGN IN';
          button.removeAttribute('aria-busy');
        }
      }
    }, true);
  }

  function scan() {
    install(document.querySelector('.login-card'));
  }

  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();
})();
