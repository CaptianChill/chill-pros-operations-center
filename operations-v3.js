(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function activateView(viewId) {
    $$('.view').forEach((view) => view.classList.toggle('active', view.id === viewId));
    $$('.side-link,.mob-nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewId));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openBilling() {
    if (typeof window.openNativeBilling === 'function') window.openNativeBilling();
    else $('#nativeBillingLauncher')?.click();
  }

  function removeLegacyAssistantUi() {
    [
      '#v4TopChillBro',
      '#v4HeroChillBro',
      '#v4AiPageOpen',
      '#cpTapToSpeak',
      '#cpQuickInvoice',
      '#chillBroLauncher',
      '#chillBroPanel'
    ].forEach((selector) => $(selector)?.remove());
    $$('.v4-ai-card').forEach((card) => card.remove());
  }

  function addCommandHeader() {
    const main = $('.main-panel');
    const hero = $('.hero-banner');
    if (!main || !hero || $('#v3CommandHeader')) return;

    const header = el('section', 'v3-command-header', `
      <div class="v3-command-brand">
        <span class="v3-kicker">CHILL PROS • FIELD COMMAND</span>
        <strong>Operations Center V3</strong>
        <small>Dispatch • Service • Billing • Equipment Intelligence</small>
      </div>
      <div class="v3-command-actions">
        <button data-v3-view="new-customer">+ NEW CALL</button>
        <button data-v3-view="today-jobs">TODAY'S JOBS</button>
        <button data-v3-view="office-queue">OFFICE QUEUE</button>
        <button data-v3-billing="true" class="v3-ai-action">QUOTE / INVOICE</button>
      </div>
    `);
    header.id = 'v3CommandHeader';
    main.insertBefore(header, hero);
  }

  function addStatusRail() {
    const dashboard = $('#dashboard');
    const metrics = $('.metrics-grid', dashboard);
    if (!dashboard || !metrics || $('#v3StatusRail')) return;
    const rail = el('section', 'v3-status-rail', `
      <div><span class="v3-status-dot online"></span><small>System</small><strong>ONLINE</strong></div>
      <div><span class="v3-status-dot pay"></span><small>Billing</small><strong>NATIVE</strong></div>
      <div><span class="v3-status-dot pay"></span><small>Payments</small><strong>ACH + CARD</strong></div>
      <div><span class="v3-status-dot secure"></span><small>Security</small><strong>STAFF AUTH</strong></div>
      <div class="v3-status-wide"><small>Command Priority</small><strong>Calls → Dispatch → Diagnose → Quote → Collect</strong></div>
    `);
    rail.id = 'v3StatusRail';
    dashboard.insertBefore(rail, metrics);
  }

  function addQuickOps() {
    const dashboard = $('#dashboard');
    const lower = $('.lower-grid', dashboard);
    if (!dashboard || !lower || $('#v3QuickOps')) return;
    const section = el('section', 'v3-quick-ops', `
      <div class="v3-section-heading">
        <div><span>LIVE WORKSPACE</span><h2>Run the day from one screen</h2></div>
        <small>Native Chill Pros workflow • no Jobber dependency</small>
      </div>
      <div class="v3-ops-grid">
        <button class="v3-op-card" data-v3-view="today-jobs"><i>01</i><b>Dispatch Board</b><span>See active jobs, technician status and field progress.</span><em>OPEN JOBS →</em></button>
        <button class="v3-op-card" data-v3-view="equipment"><i>02</i><b>Equipment Intelligence</b><span>Assets, service history, model/serial and diagnostic context.</span><em>OPEN ASSETS →</em></button>
        <button class="v3-op-card" data-v3-view="parts"><i>03</i><b>Parts Command</b><span>OEM verification, cross-reference and order tracking.</span><em>OPEN PARTS →</em></button>
        <button class="v3-op-card" data-v3-billing="true"><i>04</i><b>Quotes & Collections</b><span>Native quotes, invoices, ACH/card payment workflow.</span><em>OPEN BILLING →</em></button>
      </div>
    `);
    section.id = 'v3QuickOps';
    dashboard.insertBefore(section, lower);
  }

  function upgradePlaceholder(viewId, eyebrow, title, subtitle, cards) {
    const view = document.getElementById(viewId);
    if (!view || view.dataset.v3Upgraded === '1') return;
    view.dataset.v3Upgraded = '1';
    view.classList.add('v3-module-view');
    view.innerHTML = `
      <div class="v3-module-head">
        <div><span>${eyebrow}</span><h2>${title}</h2><p>${subtitle}</p></div>
      </div>
      <div class="v3-module-grid">
        ${cards.map((card) => `<article class="v3-module-card"><div class="v3-module-icon">${card.icon}</div><div><small>${card.kicker}</small><h3>${card.title}</h3><p>${card.copy}</p></div><button ${card.view ? `data-v3-view="${card.view}"` : card.billing ? 'data-v3-billing="true"' : 'disabled'}>${card.action}</button></article>`).join('')}
      </div>
    `;
  }

  function upgradeModules() {
    upgradePlaceholder('maintenance','PREVENTIVE MAINTENANCE','Maintenance Command','PM agreements, due visits, recurring service and care-plan visibility.',[
      {icon:'PM',kicker:'SCHEDULE',title:'Visits Due',copy:'Track upcoming preventive maintenance work and recurring obligations.',action:'VIEW SCHEDULE',view:'today-jobs'},
      {icon:'CP',kicker:'CARE PLANS',title:'Agreement Coverage',copy:'Organize Silver, Gold and Diamond maintenance coverage by customer and equipment.',action:'OPEN CUSTOMERS',view:'office-queue'},
      {icon:'✓',kicker:'COMPLETION',title:'Field Proof',copy:'Keep technician findings, completion status and service history together.',action:'OPEN EQUIPMENT',view:'equipment'}
    ]);
    upgradePlaceholder('equipment','ASSET INTELLIGENCE','Equipment Command','Every unit stays attached to its customer, location and service history.',[
      {icon:'ID',kicker:'ASSETS',title:'Model + Serial',copy:'Centralize manufacturer, model, serial, asset ID, site location and equipment type.',action:'NEW EQUIPMENT',view:'new-customer'},
      {icon:'HX',kicker:'HISTORY',title:'Service History',copy:'Use native Chill Pros records to retrieve prior complaints, findings and repairs.',action:'OPEN QUEUE',view:'office-queue'},
      {icon:'JOB',kicker:'CONTEXT',title:'Job Connection',copy:'Keep equipment records tied directly to dispatch and field work.',action:'OPEN JOBS',view:'today-jobs'}
    ]);
    upgradePlaceholder('parts','PARTS INTELLIGENCE','Parts Command','Find, verify and track the parts required to finish the call correctly.',[
      {icon:'OEM',kicker:'VERIFY',title:'OEM Lookup',copy:'Use manufacturer/model/serial context and preserve source confidence.',action:'OPEN EQUIPMENT',view:'equipment'},
      {icon:'XR',kicker:'CROSS-REFERENCE',title:'Replacement Options',copy:'Research compatible replacements while preserving OEM evidence.',action:'OPEN PARTS',view:'parts'},
      {icon:'PO',kicker:'ORDER FLOW',title:'Parts Queue',copy:'Keep required parts tied to the customer, job and equipment record.',action:'OPEN QUEUE',view:'office-queue'}
    ]);
    upgradePlaceholder('ai','IONOS ASSISTANT','Assistant Integration','The previous custom Chill Bro runtime has been retired. The IONOS AI Receptionist web widget will provide the replacement assistant once its account-specific widget script is configured.',[
      {icon:'AI',kicker:'REPLACEMENT',title:'IONOS AI Receptionist',copy:'Assistant chat and voice are handled by IONOS instead of the retired custom bot.',action:'FLOATING WIDGET'},
      {icon:'KB',kicker:'KNOWLEDGE',title:'Business Training',copy:'Train the IONOS assistant on Chill Pros website content and configured business knowledge.',action:'IONOS PORTAL'},
      {icon:'↗',kicker:'ESCALATION',title:'Call Routing',copy:'Use IONOS workflows and escalation settings for customer handoff.',action:'IONOS PORTAL'}
    ]);
    upgradePlaceholder('reports','OWNER INTELLIGENCE','Reports & Performance','A cleaner owner view for operational workload, billing progress and field activity.',[
      {icon:'$',kicker:'REVENUE',title:'Billing Pipeline',copy:'Follow draft → approved → payment status across native Chill Pros records.',action:'OPEN BILLING',billing:true},
      {icon:'FT',kicker:'FIELD TEAM',title:'Technician Activity',copy:'Use technician assignment and job status for a practical field-performance view.',action:'OPEN TECHS',view:'technicians'},
      {icon:'OPS',kicker:'WORKLOAD',title:'Office Queue',copy:'Surface what needs review, quote, parts, invoicing or follow-up.',action:'OPEN QUEUE',view:'office-queue'}
    ]);
    upgradePlaceholder('settings','SYSTEM CONTROL','Operations Settings','Staff access, company configuration and secure service connections.',[
      {icon:'ID',kicker:'ACCESS',title:'Staff Authentication',copy:'Owner and technician access stays behind Firebase authentication.',action:'TECHNICIANS',view:'technicians'},
      {icon:'AI',kicker:'ASSISTANT',title:'IONOS Receptionist',copy:'The replacement assistant is isolated from core Chill Pros operational records until explicitly configured.',action:'IONOS WIDGET'},
      {icon:'$',kicker:'PAYMENTS',title:'Stripe Settlement',copy:'Card and ACH collection stays tokenized through Stripe; no bank passwords are stored.',action:'OPEN BILLING',billing:true}
    ]);
  }

  function wireActions() {
    document.addEventListener('click', (event) => {
      const viewButton = event.target.closest('[data-v3-view]');
      if (viewButton) activateView(viewButton.dataset.v3View);
      if (event.target.closest('[data-v3-billing]')) openBilling();
    });
  }

  function markShell() {
    document.documentElement.classList.add('operations-v3');
    const hero = $('.hero-banner');
    if (hero) hero.dataset.v3 = 'command';
    $$('.feature-card').forEach((card, index) => card.dataset.v3Index = String(index + 1).padStart(2,'0'));
  }

  function install() {
    removeLegacyAssistantUi();
    markShell();
    addCommandHeader();
    addStatusRail();
    addQuickOps();
    upgradeModules();
    wireActions();
    const observer = new MutationObserver(() => removeLegacyAssistantUi());
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
