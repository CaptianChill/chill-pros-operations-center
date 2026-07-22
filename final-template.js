(() => {
  function buildGuide() {
    if (document.querySelector('.cp-brand-guide')) return;
    const main = document.querySelector('.main-panel');
    if (!main) return;

    const guide = document.createElement('aside');
    guide.className = 'cp-brand-guide';
    guide.innerHTML = `
      <h3>OFFICIAL THEME & BRAND GUIDE</h3>
      <img class="cp-guide-logo" src="chill-pros-official-logo-transparent.png" alt="Chill Pros official logo">
      <strong>COLOR PALETTE</strong>
      <div class="cp-palette">
        <i style="background:#000"></i><i style="background:#042a47"></i><i style="background:#006dff"></i>
        <i style="background:#7edbff"></i><i style="background:#fff"></i><i style="background:#a8b5c6"></i>
      </div>
      <div class="cp-typography"><strong>AA</strong><span>HEADERS: ICE COLD BOLD<br>SUBHEADERS: BRASS NUCLE<br>BODY: INTER</span></div>
      <strong>UI ELEMENTS</strong>
      <div class="cp-ui-sample"><span>PRIMARY BUTTON</span><span>SECONDARY BUTTON</span><span>CARD / CONTAINER</span></div>
      <div class="cp-theme-lock">This is the OFFICIAL aesthetic for Chill Pros Operations Center.<br><br>All future screens, modules and features follow this theme, branding and tone.</div>`;
    main.appendChild(guide);

    const bottom = document.createElement('section');
    bottom.className = 'cp-bottom-grid';
    bottom.innerHTML = `
      <article class="cp-bottom-card"><h4>PLATFORM WORKFLOW</h4><div class="cp-steps">
        <div><span class="cp-step-icon">▣</span>TECH IN FIELD<br><small>Capture data</small></div>
        <div><span class="cp-step-icon">⇧</span>SUBMIT TO OFFICE<br><small>Instant sync</small></div>
        <div><span class="cp-step-icon">▤</span>OFFICE REVIEW<br><small>Create quote</small></div>
        <div><span class="cp-step-icon">✓</span>COMPLETE<br><small>History saved</small></div>
      </div></article>
      <article class="cp-bottom-card"><h4>DEVELOPMENT ROADMAP</h4><div class="cp-roadmap">
        <div><b>PHASE 1</b><br>Dashboard<br>Customer Intake<br>Office Queue</div>
        <div><b>PHASE 2</b><br>Quotes & Invoices<br>Maintenance Plans<br>Reports</div>
        <div><b>PHASE 3</b><br>AI Diagnostics<br>Smart Parts Finder<br>Alerts</div>
        <div><b>PHASE 4</b><br>Jobber Integration<br>QuickBooks Sync<br>Payments</div>
      </div></article>
      <article class="cp-bottom-card cp-next"><h4>NEXT IMMEDIATE STEPS</h4><ol><li>Set theme as global standard</li><li>Build New Customer Intake</li><li>Build Office Queue</li><li>Connect Firebase Database</li><li>Build Login & User Roles</li></ol></article>
      <article class="cp-bottom-card cp-lock"><strong>THEME LOCKED</strong><span>Official look for all Chill Pros Operations Center development.</span></article>`;
    main.appendChild(bottom);
  }

  function repairOwnerDashboard() {
    const session = window.CHILL_PROS_SESSION;
    if (!session || session.role !== 'owner') return false;

    document.querySelectorAll('.side-link').forEach((link) => link.classList.remove('role-hidden'));
    document.querySelectorAll('[data-view-target]').forEach((button) => button.classList.remove('role-hidden'));

    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
      dashboard.classList.remove('role-hidden');
      dashboard.classList.add('active');
      dashboard.style.display = 'block';
      dashboard.style.visibility = 'visible';
      dashboard.style.opacity = '1';
    }

    document.querySelectorAll('.view').forEach((view) => {
      if (view.id !== 'dashboard') view.classList.remove('active');
    });

    const dashLink = document.querySelector('.side-link[data-view="dashboard"]');
    document.querySelectorAll('.side-link').forEach((link) => link.classList.remove('active'));
    dashLink?.classList.add('active');

    document.querySelector('.app-shell')?.style.setProperty('visibility', 'visible');
    document.querySelector('.main-panel')?.style.setProperty('visibility', 'visible');
    return true;
  }

  function initializeFinalTemplate() {
    buildGuide();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (repairOwnerDashboard() || attempts > 40) clearInterval(timer);
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFinalTemplate, { once: true });
  } else {
    initializeFinalTemplate();
  }
})();