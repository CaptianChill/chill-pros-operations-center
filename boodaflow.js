(() => {
  'use strict';

  const STORAGE_KEY = 'chillProsBoodaFlow';
  const DEFAULT_STATE = {
    mode: 'OVERDRIVE',
    enabled: true,
    currentId: 1,
    tasks: [
      { id: 1, title: 'Production readiness sweep', detail: 'Verify owner dashboard, mobile layout, core operations links, and deployment health.', priority: 'P0', status: 'active' },
      { id: 2, title: 'Operations workflow hardening', detail: 'Keep dispatch, scheduling, quotes, invoices, technicians, customers, and equipment flows owner-ready.', priority: 'P0', status: 'queued' },
      { id: 3, title: 'Integration validation', detail: 'Surface blocked integrations and continue through independent work instead of stopping the whole queue.', priority: 'P1', status: 'queued' },
      { id: 4, title: 'Mobile owner review', detail: 'Validate command-center usability on iPhone-sized screens and retain quick access to operations.', priority: 'P1', status: 'queued' },
      { id: 5, title: 'Final production verification', detail: 'Confirm production deployment responds and owner controls persist correctly.', priority: 'P0', status: 'queued' }
    ],
    lastRun: null
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.tasks)) return saved;
    } catch (_) {}
    return structuredClone(DEFAULT_STATE);
  }

  let state = loadState();

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function activeTask() {
    return state.tasks.find((task) => task.status === 'active') || null;
  }

  function nextQueued() {
    const order = { P0: 0, P1: 1, P2: 2 };
    return state.tasks
      .filter((task) => task.status === 'queued')
      .sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9) || a.id - b.id)[0] || null;
  }

  function activateNext() {
    if (activeTask()) return;
    const next = nextQueued();
    if (next) {
      next.status = 'active';
      state.currentId = next.id;
    }
  }

  function setCurrentStatus(status) {
    const current = activeTask();
    if (!current) return;
    current.status = status;
    state.lastRun = new Date().toISOString();
    activateNext();
    save();
    render();
  }

  function reset() {
    state = structuredClone(DEFAULT_STATE);
    save();
    render();
  }

  function render() {
    const root = document.querySelector('#boodaFlowPanel');
    if (!root) return;

    const completed = state.tasks.filter((task) => task.status === 'complete').length;
    const blocked = state.tasks.filter((task) => task.status === 'blocked').length;
    const current = activeTask();
    const pending = state.tasks.filter((task) => ['queued', 'active'].includes(task.status)).length;

    const mode = root.querySelector('#bfMode');
    const enabled = root.querySelector('#bfEnabled');
    const progress = root.querySelector('#bfProgress');
    const currentTitle = root.querySelector('#bfCurrentTitle');
    const currentDetail = root.querySelector('#bfCurrentDetail');
    const queue = root.querySelector('#bfQueue');
    const lastRun = root.querySelector('#bfLastRun');

    mode.textContent = state.mode;
    enabled.textContent = state.enabled ? 'ACTIVE' : 'PAUSED';
    enabled.className = state.enabled ? 'bf-live' : 'bf-paused';
    progress.textContent = `${completed}/${state.tasks.length}`;
    currentTitle.textContent = current ? current.title : 'Queue complete';
    currentDetail.textContent = current ? current.detail : 'All current BoodaFlow tasks are complete or blocked.';
    lastRun.textContent = state.lastRun ? new Date(state.lastRun).toLocaleString() : 'Not run yet';

    root.querySelector('#bfPending').textContent = pending;
    root.querySelector('#bfBlocked').textContent = blocked;

    queue.innerHTML = state.tasks.map((task) => `
      <li class="bf-task ${task.status}">
        <span class="bf-priority">${task.priority}</span>
        <div><strong>${task.title}</strong><small>${task.status.toUpperCase()}</small></div>
      </li>`).join('');

    root.querySelectorAll('[data-bf-action]').forEach((button) => {
      button.disabled = !state.enabled || (!current && button.dataset.bfAction !== 'reset');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('#boodaFlowPanel');
    if (!root) return;

    root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-bf-action]');
      if (!button) return;
      const action = button.dataset.bfAction;
      if (action === 'complete') setCurrentStatus('complete');
      if (action === 'block') setCurrentStatus('blocked');
      if (action === 'reset') reset();
      if (action === 'toggle') {
        state.enabled = !state.enabled;
        state.lastRun = new Date().toISOString();
        save();
        render();
      }
    });

    activateNext();
    save();
    render();
  });
})();
