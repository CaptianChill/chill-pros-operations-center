(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const nav = [
    ['Dashboard','dashboard','⌂'],
    ['Service Intake','new-customer','▤'],
    ['Dispatch / Jobs','today-jobs','▦'],
    ['Office Queue','office-queue','◷'],
    ['Quotes','__billing_quote','▧'],
    ['Invoices & Payments','__billing_invoice','$'],
    ['AI Parts Intelligence','parts','✦'],
    ['Technicians','technicians','🔧'],
    ['Clients','__clients','◉'],
    ['Equipment','equipment','⬡'],
    ['Maintenance','maintenance','◆'],
    ['Reports','reports','▥'],
    ['BoodaFlow','__boodaflow','↯'],
    ['Settings','settings','⚙']
  ];

  function flash(message) {
    $('.v2-tab-flash')?.remove();
    const el = document.createElement('div');
    el.className = 'v2-tab-flash';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  function setActive(viewId) {
    const view = document.getElementById(viewId);
    if (!view) { flash(`${viewId} is unavailable`); return false; }
    $$('.view').forEach(item => item.classList.toggle('active', item.id === viewId));
    $$('.side-link').forEach(button => button.classList.toggle('active', button.dataset.view === viewId || button.dataset.v2Target === viewId));
    $$('.v2-mobile-nav button').forEach(button => button.classList.toggle('active', button.dataset.v2View === viewId));
    if (viewId === 'office-queue') $('#queueSearch')?.dispatchEvent(new Event('input'));
    if (viewId === 'today-jobs') $('#refreshJobs')?.click();
    if (viewId === 'technicians') $('#technicianDashboardSelect')?.dispatchEvent(new Event('change'));
    window.scrollTo({top:0, behavior:'smooth'});
    return true;
  }

  function waitFor(selector, timeoutMs = 4500, intervalMs = 120) {
    return new Promise(resolve => {
      const started = Date.now();
      const tick = () => {
        const node = $(selector);
        if (node) return resolve(node);
        if (Date.now() - started >= timeoutMs) return resolve(null);
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  }

  async function openChillBro() {
    let launcher = $('#chillBroLauncher');
    if (!launcher) launcher = await waitFor('#chillBroLauncher');
    if (!launcher) { flash('Chill Bro could not initialize'); return false; }
    const panel = $('#chillBroPanel') || await waitFor('#chillBroPanel', 1800);
    if (panel && !panel.classList.contains('open')) launcher.click();
    if (!panel) launcher.click();
    return true;
  }

  async function openBilling(mode = 'quote') {
    const opened = await openChillBro();
    if (!opened) return;
    const billing = $('#chillBroBilling') || await waitFor('#chillBroBilling', 5000);
    const toggle = $('.chill-bro-billing-toggle') || await waitFor('.chill-bro-billing-toggle', 1200);
    if (!billing) { flash('Native billing could not initialize'); return; }
    if (!billing.classList.contains('open')) toggle?.click();
    setTimeout(() => {
      if (mode === 'quote') $('#cbBillCustomer')?.focus();
      else $('#cbBillDescription')?.focus();
    }, 80);
  }

  function handleSpecial(target) {
    if (target === '__billing_quote') return openBilling('quote');
    if (target === '__billing_invoice') return openBilling('invoice');
    if (target === '__clients') {
      setActive('office-queue');
      const search = $('#queueSearch');
      if (search) {
        search.value = '';
        search.placeholder = 'Search clients, company, phone, email, address...';
        search.dispatchEvent(new Event('input'));
        search.focus();
      }
      flash('Client records opened');
      return;
    }
    if (target === '__boodaflow') {
      setActive('dashboard');
      const card = [...$$('h2,h3,strong')].find(el => /BoodaFlow/i.test(el.textContent || ''))?.closest('article,section,.glass-card,.panel');
      if (card) card.scrollIntoView({behavior:'smooth', block:'center'});
      else window.scrollTo({top:document.body.scrollHeight, behavior:'smooth'});
      flash('BoodaFlow command opened');
      return;
    }
    setActive(target);
  }

  function rebuildSidebar() {
    const root = $('.side-nav');
    if (!root || root.dataset.v2Functional === '1') return;
    root.dataset.v2Functional = '1';
    root.innerHTML = '';
    const label1 = document.createElement('div');
    label1.className = 'v2-nav-label';
    label1.textContent = 'Workspace';
    root.appendChild(label1);
    nav.forEach(([label,target,icon], index) => {
      if (index === 10) {
        const label2 = document.createElement('div');
        label2.className = 'v2-nav-label';
        label2.textContent = 'Manage';
        root.appendChild(label2);
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `side-link${target === 'dashboard' ? ' active' : ''}`;
      if (!target.startsWith('__')) button.dataset.view = target;
      button.dataset.v2Target = target;
      button.innerHTML = `<span>${icon}</span><strong class="v2-label-text">${label}</strong>`;
      button.addEventListener('click', event => { event.preventDefault(); handleSpecial(target); });
      root.appendChild(button);
    });
  }

  function improveHeader() {
    const brand = $('.v4-brand');
    if (brand && !brand.dataset.v2Functional) {
      brand.dataset.v2Functional = '1';
      brand.innerHTML = `<img src="chill-pros-official-logo-transparent.png" alt="Chill Pros"><div><b>CHILL PROS</b><small>OPS COMMAND</small></div>`;
    }
    const actions = $('.v4-top-actions');
    if (actions && !actions.dataset.v2Functional) {
      actions.dataset.v2Functional = '1';
      actions.innerHTML = '<button type="button" data-v2-target="office-queue">Office Queue</button><button type="button" class="accent" data-v2-action="chillbro">Chill Bro AI</button>';
      actions.querySelector('[data-v2-target]')?.addEventListener('click', () => setActive('office-queue'));
      actions.querySelector('[data-v2-action="chillbro"]')?.addEventListener('click', () => openChillBro());
    }
  }

  function buildMobileNav() {
    if ($('.v2-mobile-nav')) return;
    const mobile = document.createElement('nav');
    mobile.className = 'v2-mobile-nav';
    mobile.setAttribute('aria-label','Mobile operations navigation');
    const items = [
      ['Today','dashboard','⌂',''],
      ['Jobs','today-jobs','▦',''],
      ['Intake','new-customer','＋','v2-intake'],
      ['Chill Bro','__chillbro','✦',''],
      ['Quote','__billing_quote','▧','']
    ];
    items.forEach(([label,target,icon,cls]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `${target === 'dashboard' ? 'active ' : ''}${cls}`.trim();
      button.dataset.v2View = target.startsWith('__') ? '' : target;
      button.innerHTML = `<b>${icon}</b><span>${label}</span>`;
      button.addEventListener('click', () => target === '__chillbro' ? openChillBro() : handleSpecial(target));
      mobile.appendChild(button);
    });
    document.body.appendChild(mobile);
  }

  function wireDashboardActions() {
    const map = [
      ['#v4TopChillBro', () => openChillBro()],['#v4HeroChillBro', () => openChillBro()],['#v4AiPageOpen', () => openChillBro()],
      ['#v4BillingOpen', () => openBilling('quote')],['#cpQuickInvoice', () => openBilling('quote')],['#v3BillingLauncher', () => openBilling('quote')]
    ];
    map.forEach(([selector,fn]) => {
      const el = $(selector);
      if (el && !el.dataset.v2Wired) {
        el.dataset.v2Wired = '1';
        el.addEventListener('click', event => { event.preventDefault(); fn(); });
      }
    });
    $$('[data-view-target]').forEach(el => {
      if (el.dataset.v2Wired) return;
      el.dataset.v2Wired = '1';
      el.addEventListener('click', event => { event.preventDefault(); setActive(el.dataset.viewTarget); });
    });
  }

  function installGlobalSearch() {
    if ($('#v2GlobalSearch')) return;
    const top = $('.v4-topbar');
    if (!top) return;
    const button = document.createElement('button');
    button.id = 'v2GlobalSearch';
    button.type = 'button';
    button.className = 'secondary-action';
    button.textContent = 'Search';
    button.style.marginLeft = 'auto';
    button.addEventListener('click', openSearch);
    const actions = $('.v4-top-actions');
    top.insertBefore(button, actions || null);
    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
    });
  }

  function openSearch() {
    $('.v2-search-panel')?.remove();
    const panel = document.createElement('div');
    panel.className = 'v2-search-panel';
    panel.innerHTML = '<input type="search" placeholder="Search jobs, clients, equipment, quotes, invoices..."><div class="v2-search-results"></div>';
    document.body.appendChild(panel);
    const input = $('input', panel);
    const results = $('.v2-search-results', panel);
    const options = [
      ['New service intake','new-customer'],['Dispatch / Today’s Jobs','today-jobs'],['Office Queue / Clients','office-queue'],['Quotes','__billing_quote'],['Invoices & Payments','__billing_invoice'],['Equipment','equipment'],['Parts Intelligence','parts'],['Technicians','technicians'],['Maintenance','maintenance'],['Reports','reports'],['Settings','settings'],['Chill Bro','__chillbro']
    ];
    const render = () => {
      const q = input.value.trim().toLowerCase();
      results.innerHTML = '';
      options.filter(([label]) => !q || label.toLowerCase().includes(q)).forEach(([label,target]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', () => { panel.remove(); target === '__chillbro' ? openChillBro() : handleSpecial(target); });
        results.appendChild(b);
      });
    };
    input.addEventListener('input', render);
    input.addEventListener('keydown', event => { if (event.key === 'Escape') panel.remove(); });
    render();
    input.focus();
  }

  function hardenForms() {
    $('#intakeForm')?.setAttribute('autocomplete','on');
    const billing = $('#chillBroBilling');
    if (billing) billing.setAttribute('aria-label','Native quote and invoice workspace');
  }

  function install() {
    document.documentElement.classList.add('v2-functional-runtime');
    rebuildSidebar();
    improveHeader();
    buildMobileNav();
    wireDashboardActions();
    installGlobalSearch();
    hardenForms();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    install();
    if (attempts > 60) clearInterval(timer);
  }, 250);
})();
