(() => {
  'use strict';

  const clock = document.querySelector('#clock');
  const date = document.querySelector('#date');
  const toast = document.querySelector('#toast');

  function updateClock() {
    const now = new Date();
    clock.textContent = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric', minute: '2-digit', second: '2-digit'
    }).format(now);
    date.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
    }).format(now);
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn(`Unable to read ${key}`, error);
      return null;
    }
  }

  function findFirstArray(keys) {
    for (const key of keys) {
      const value = readJson(key);
      if (Array.isArray(value)) return value;
      if (value && Array.isArray(value.items)) return value.items;
    }
    return [];
  }

  function loadLocalOperationsMetrics() {
    const jobs = findFirstArray(['chillProsJobs', 'jobs', 'todayJobs']);
    const queue = findFirstArray(['chillProsQueue', 'officeQueue', 'queue']);
    const technicians = findFirstArray(['chillProsTechnicians', 'technicians']);

    document.querySelector('#cpJobs').textContent = jobs.length || '—';
    document.querySelector('#cpQueue').textContent = queue.length || '—';
    document.querySelector('#cpTechs').textContent = technicians.length || '—';
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
  }

  document.querySelectorAll('[data-note]').forEach((button) => {
    button.addEventListener('click', () => showToast(button.dataset.note));
  });

  updateClock();
  loadLocalOperationsMetrics();
  window.setInterval(updateClock, 1000);
  window.addEventListener('storage', loadLocalOperationsMetrics);
})();
