(() => {
  const VIEW_ID = 'payroll';
  const PAYROLL_ROLES = new Set(['owner','payroll']);

  function session(){ return window.CHILL_PROS_SESSION || {}; }
  function canUsePayroll(){ return PAYROLL_ROLES.has(String(session().role || '').toLowerCase()); }
  function canApprovePayroll(){ return String(session().role || '').toLowerCase() === 'owner'; }

  function money(value){
    return Number(value || 0).toLocaleString('en-US',{style:'currency',currency:'USD'});
  }

  function ensureView(){
    if (document.getElementById(VIEW_ID)) return document.getElementById(VIEW_ID);
    const host = document.querySelector('main, .main-panel, .content, .workspace, .app-main') || document.body;
    const view = document.createElement('section');
    view.id = VIEW_ID;
    view.className = 'view payroll-view role-hidden';
    view.innerHTML = `
      <div class="payroll-shell">
        <div class="payroll-head">
          <div><p class="payroll-kicker">OWNER FINANCE</p><h1>Payroll</h1><p>Review hours, prepare payroll, approve funding, and keep a complete audit trail.</p></div>
          <div class="payroll-status">INTERNAL ENGINE · PHASE 1</div>
        </div>

        <div class="payroll-metrics">
          <article><span>Next Payday</span><strong id="payrollNextPayday">Not scheduled</strong></article>
          <article><span>Gross Payroll</span><strong id="payrollGross">$0.00</strong></article>
          <article><span>Estimated Taxes</span><strong id="payrollTaxes">$0.00</strong></article>
          <article><span>Net Payroll</span><strong id="payrollNet">$0.00</strong></article>
        </div>

        <div class="payroll-grid">
          <article class="payroll-card">
            <div class="payroll-card-head"><h2>Current Pay Period</h2><span class="payroll-pill">DRAFT</span></div>
            <div class="payroll-fields">
              <label>Period Start<input id="payrollPeriodStart" type="date"></label>
              <label>Period End<input id="payrollPeriodEnd" type="date"></label>
              <label>Pay Date<input id="payrollPayDate" type="date"></label>
            </div>
            <div class="payroll-actions">
              <button type="button" id="payrollReviewBtn">Review Timecards</button>
              <button type="button" id="payrollPrepareBtn">Prepare Payroll</button>
              <button type="button" id="payrollApproveBtn" class="payroll-primary">Approve Payroll</button>
            </div>
            <p id="payrollNotice" class="payroll-notice">No payroll has been prepared yet.</p>
          </article>

          <article class="payroll-card">
            <div class="payroll-card-head"><h2>Access & Controls</h2></div>
            <div class="payroll-permissions">
              <div><strong>Owner</strong><span>Full access, compensation, final approval, integrations</span></div>
              <div><strong>Payroll Administrator</strong><span>Review hours, employee payroll setup, prepare runs, reports</span></div>
              <div><strong>Office</strong><span>Timecard review only</span></div>
              <div><strong>Employee</strong><span>Own hours, PTO, paystubs, pay history</span></div>
            </div>
          </article>
        </div>

        <article class="payroll-card payroll-table-card">
          <div class="payroll-card-head"><h2>Employees</h2><button type="button" id="payrollAddEmployee">Add Payroll Profile</button></div>
          <div class="payroll-empty" id="payrollEmployeesEmpty">No payroll profiles yet. Employee records will populate here after payroll onboarding.</div>
        </article>

        <article class="payroll-card">
          <div class="payroll-card-head"><h2>Provider Connection</h2><span class="payroll-pill payroll-muted">NOT CONNECTED</span></div>
          <p>Chill Bros will own the payroll workflow and records. ACH transfers, tax remittance, and statutory filings will connect through a licensed payroll provider after the Neon migration is complete and verified.</p>
        </article>
      </div>`;
    host.appendChild(view);
    return view;
  }

  function ensureNav(){
    if (document.querySelector('.side-link[data-view="payroll"]')) return;
    const nav = document.querySelector('.sidebar nav, .side-nav, .sidebar, [class*="sidebar"]');
    if (!nav) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'side-link role-hidden';
    button.dataset.view = 'payroll';
    button.innerHTML = '<span>Payroll</span>';
    button.addEventListener('click', () => {
      if (typeof window.showView === 'function') window.showView('payroll');
      else {
        document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'payroll'));
        document.querySelectorAll('.side-link').forEach(v => v.classList.toggle('active', v.dataset.view === 'payroll'));
      }
    });
    nav.appendChild(button);
  }

  function setAccess(){
    const view = ensureView();
    ensureNav();
    const button = document.querySelector('.side-link[data-view="payroll"]');
    const allowed = canUsePayroll();
    view.classList.toggle('role-hidden', !allowed);
    if (button) button.classList.toggle('role-hidden', !allowed);
    const approve = document.getElementById('payrollApproveBtn');
    if (approve) {
      approve.disabled = !canApprovePayroll();
      approve.title = canApprovePayroll() ? 'Final owner approval' : 'Owner approval required';
    }
  }

  function bind(){
    const notice = document.getElementById('payrollNotice');
    document.getElementById('payrollReviewBtn')?.addEventListener('click', () => {
      notice.textContent = 'Timecard review opened. Payroll will use approved clocked hours only.';
    });
    document.getElementById('payrollPrepareBtn')?.addEventListener('click', () => {
      notice.textContent = 'Payroll draft prepared. No money has moved. Owner approval is still required.';
    });
    document.getElementById('payrollApproveBtn')?.addEventListener('click', () => {
      if (!canApprovePayroll()) return;
      notice.textContent = 'Owner approval recorded locally. ACH submission remains disabled until a licensed provider is connected.';
    });
    document.getElementById('payrollAddEmployee')?.addEventListener('click', () => {
      notice.textContent = 'Payroll profile onboarding will use the existing employee record and add pay rate, tax, direct-deposit, PTO, and filing fields.';
    });
  }

  function hydrateDates(){
    const today = new Date();
    const iso = d => d.toISOString().slice(0,10);
    const start = new Date(today); start.setDate(today.getDate() - 13);
    const pay = new Date(today); pay.setDate(today.getDate() + 3);
    const s = document.getElementById('payrollPeriodStart');
    const e = document.getElementById('payrollPeriodEnd');
    const p = document.getElementById('payrollPayDate');
    if (s && !s.value) s.value = iso(start);
    if (e && !e.value) e.value = iso(today);
    if (p && !p.value) p.value = iso(pay);
    const next = document.getElementById('payrollNextPayday');
    if (next) next.textContent = p?.value || 'Not scheduled';
  }

  function boot(){
    ensureView();
    ensureNav();
    setAccess();
    bind();
    hydrateDates();
    const observer = new MutationObserver(setAccess);
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
