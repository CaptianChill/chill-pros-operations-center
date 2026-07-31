(() => {
  'use strict';

  const APPROVED_ARTWORK = Object.freeze({
    mobile: 'https://github.com/user-attachments/assets/816b9e04-e54e-4c7d-99a0-3783a4ce2269',
    desktop: 'https://github.com/user-attachments/assets/28a8189c-3bba-4448-800a-3d07e0b15aab'
  });

  const clock = document.querySelector('#clock');
  const date = document.querySelector('#date');
  const toast = document.querySelector('#toast');

  function installApprovedArtworkReference() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reference') !== 'approved') return;

    const reference = document.createElement('section');
    reference.id = 'approvedArtworkReference';
    reference.setAttribute('aria-label', 'Approved BB Command Center source artwork');
    reference.innerHTML = `
      <style>
        body.approved-reference-mode { padding: 0; background: #020406; }
        body.approved-reference-mode > :not(#approvedArtworkReference) { display: none !important; }
        #approvedArtworkReference { width: 100%; margin: 0; background: #020406; }
        #approvedArtworkReference picture,
        #approvedArtworkReference img { display: block; width: 100%; height: auto; margin: 0; }
        #approvedArtworkReference img { object-fit: contain; object-position: center top; }
      </style>
      <picture>
        <source media="(max-width: 767px)" srcset="${APPROVED_ARTWORK.mobile}">
        <img src="${APPROVED_ARTWORK.desktop}" alt="Approved BB Command Center desktop design reference" decoding="async">
      </picture>`;

    document.body.classList.add('approved-reference-mode');
    document.body.prepend(reference);
  }

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

  installApprovedArtworkReference();

  document.querySelectorAll('[data-note]').forEach((button) => {
    button.addEventListener('click', () => showToast(button.dataset.note));
  });

  updateClock();
  loadLocalOperationsMetrics();
  window.setInterval(updateClock, 1000);
  window.addEventListener('storage', loadLocalOperationsMetrics);
})();
