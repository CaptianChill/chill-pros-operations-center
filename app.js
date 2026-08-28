(() => {
  'use strict';

  const auth = window.chillProsAuth;
  const db = window.chillProsDb;
  const OWNER_EMAIL = 'chillprostx@gmail.com';
  const BILL_API = 'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/nativeOpsApi';
  const STATUS_OPTIONS = [
    'Needs Review', 'Needs Quote', 'Scheduled', 'Dispatched',
    'In Progress', 'Paused', 'Waiting on Parts', 'Ready to Invoice', 'Completed'
  ];
  const ACTIVE_JOB = new Set(['Scheduled', 'Dispatched', 'In Progress', 'Paused']);
  const BF_KEY = 'chillProsBoodaFlow';
  const BF_DEFAULT = {
    mode: 'OVERDRIVE',
    enabled: true,
    currentId: 1,
    tasks: [
      { id: 1, title: 'Production readiness sweep', detail: 'Verify owner dashboard, mobile layout, core operations links, and deployment health.', priority: 'P0', status: 'active' },
      { id: 2, title: 'Operations workflow hardening', detail: 'Keep dispatch, scheduling, quotes, invoices, technicians, customers, and equipment flows owner-ready.', priority: 'P0', status: 'queued' },
      { id: 3, title: 'Integration validation', detail: 'Surface blocked integrations and continue through independent work instead of stopping the whole queue.', priority: 'P1', status: 'queued' },
      { id: 4, title: 'Mobile owner review', detail: 'Validate command-center usability on phone screens and retain quick access to operations.', priority: 'P1', status: 'queued' },
      { id: 5, title: 'Final production verification', detail: 'Confirm production deployment responds and owner controls persist correctly.', priority: 'P0', status: 'queued' }
    ],
    lastRun: null
  };

  const NAV = [
    { id: 'Dashboard', icon: '⌂', label: 'Dashboard' },
    { id: 'Service Intake', icon: '▤', label: 'Service Intake' },
    { id: 'Dispatch', icon: '▦', label: 'Dispatch / Jobs' },
    { id: 'Office Queue', icon: '◷', label: 'Office Queue' },
    { id: 'Billing', icon: '$', label: 'Quotes & Billing' },
    { id: 'Technicians', icon: '🔧', label: 'Technicians' },
    { id: 'BoodaFlow', icon: '↯', label: 'BoodaFlow' },
    { id: 'Reports', icon: '▥', label: 'Reports' },
    { id: 'Settings', icon: '⚙', label: 'Settings' }
  ];

  let user = null;
  let profile = null;
  let records = [];
  let technicians = [];
  let view = 'Dashboard';
  let bf = loadBf();
  let broOpen = false;
  let billState = { quoteId: '', invoiceId: '', sessionId: '' };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

  function toast(msg) {
    $('.toast')?.remove();
    const n = document.createElement('div');
    n.className = 'toast';
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2200);
  }

  function loadBf() {
    try {
      const s = JSON.parse(localStorage.getItem(BF_KEY));
      if (s && Array.isArray(s.tasks)) return s;
    } catch (_) {}
    return structuredClone(BF_DEFAULT);
  }
  function saveBf() {
    localStorage.setItem(BF_KEY, JSON.stringify(bf));
  }

  function role() {
    if (!user) return null;
    if (profile?.role) return profile.role;
    if (user.email === OWNER_EMAIL) return 'owner';
    return 'office';
  }

  async function loadProfile() {
    if (!user) return;
    try {
      const doc = await db.collection('Users').doc(user.uid).get();
      profile = doc.exists ? doc.data() : null;
    } catch (e) {
      console.warn('Profile load failed', e);
      profile = null;
    }
  }

  async function loadRecords() {
    try {
      const snap = await db.collection('Customers').orderBy('createdAt', 'desc').limit(200).get();
      records = snap.docs.map((d) => ({ ...d.data(), firestoreId: d.id }));
    } catch (e) {
      try {
        const snap = await db.collection('Customers').limit(200).get();
        records = snap.docs.map((d) => ({ ...d.data(), firestoreId: d.id }));
      } catch (e2) {
        records = [];
        toast('Unable to load records');
      }
    }
  }

  async function loadTechnicians() {
    try {
      const snap = await db.collection('Technicians').get();
      technicians = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    } catch (e) {
      technicians = [];
    }
  }

  async function secure(path, body = {}) {
    if (!user) throw new Error('Sign in first');
    const token = await user.getIdToken();
    const res = await fetch(BILL_API + path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function renderLogin(err = '') {
    $('#app').innerHTML = `
      <main class="login-screen">
        <form class="login-card" id="loginForm">
          <img src="chill-pros-official-logo-transparent.png" alt="Chill Pros">
          <h1>Operations Center</h1>
          <p class="tag">License to Chill.</p>
          <input name="email" type="email" autocomplete="username" placeholder="Chill Pros email" required>
          <input name="password" type="password" autocomplete="current-password" placeholder="Password" required>
          <p class="login-error">${esc(err)}</p>
          <button type="submit">SIGN IN</button>
        </form>
      </main>`;
    $('#loginForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      try {
        await auth.signInWithEmailAndPassword(String(fd.get('email')), String(fd.get('password')));
      } catch (x) {
        renderLogin(x.message || 'Sign-in failed');
      }
    };
  }

  function shell() {
    const r = role();
    const name = profile?.displayName || user.email || 'Staff';
    $('#app').innerHTML = `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand-block">
            <img src="chill-pros-official-logo-transparent.png" alt="Chill Pros">
            <small>Ops Command</small>
          </div>
          <p class="nav-label">Workspace</p>
          <nav id="sideNav"></nav>
          <div class="sidebar-footer">
            <div><strong>${esc(r)}</strong></div>
            <div>${esc(name)}</div>
          </div>
        </aside>
        <section class="content">
          <header class="topbar">
            <h1 id="pageTitle">Dashboard</h1>
            <div class="spacer"></div>
            <button class="btn" id="refreshBtn" type="button">↻ Refresh</button>
            <div class="top-user"><b>${esc(name)}</b> · ${esc(r)}</div>
            <button class="btn" id="signOutBtn" type="button">Sign out</button>
          </header>
          <div class="page" id="workspace"></div>
        </section>
        <nav class="mobile-nav" id="mobileNav"></nav>
      </div>
      <button class="chill-bro-fab" id="broFab" type="button" title="Chill Bro">❄</button>
      <aside class="chill-bro-panel" id="broPanel">
        <div class="chill-bro-head">
          <strong>Chill Bro · Side plug-in</strong>
          <button class="btn" type="button" id="broClose">✕</button>
        </div>
        <div class="chill-bro-body" id="broBody">
          <p><strong style="color:var(--ice)">Chill Bro is a side plug-in</strong> — not part of the core Operations Center shell.</p>
          <p>Use this panel for field notes and coaching. Full AI can be wired later without changing core ops.</p>
          <p>Core path stays: intake → queue → dispatch → billing.</p>
        </div>
        <div class="chill-bro-foot">
          <input id="broInput" placeholder="Note for later AI hook…" disabled>
          <button class="btn btn-primary" type="button" disabled>Send</button>
        </div>
      </aside>`;

    buildNav();
    $('#refreshBtn').onclick = async () => {
      await Promise.all([loadRecords(), loadTechnicians()]);
      showView(view);
      toast('Data refreshed');
    };
    $('#signOutBtn').onclick = () => auth.signOut();
    $('#broFab').onclick = () => {
      broOpen = !broOpen;
      $('#broPanel').classList.toggle('open', broOpen);
    };
    $('#broClose').onclick = () => {
      broOpen = false;
      $('#broPanel').classList.remove('open');
    };
    showView('Dashboard');
  }

  function buildNav() {
    const side = $('#sideNav');
    const mob = $('#mobileNav');
    side.innerHTML = '';
    mob.innerHTML = '';
    NAV.forEach((item, i) => {
      if (i === 6) {
        const lab = document.createElement('p');
        lab.className = 'nav-label';
        lab.textContent = 'Control';
        side.appendChild(lab);
      }
      const b = document.createElement('button');
      b.className = 'nav-item';
      b.dataset.view = item.id;
      b.innerHTML = `<span>${item.icon}</span><strong>${item.label}</strong>`;
      b.onclick = () => showView(item.id);
      side.appendChild(b);
    });
    [
      ['Today', 'Dashboard', '⌂'],
      ['Jobs', 'Dispatch', '▦'],
      ['Intake', 'Service Intake', '＋'],
      ['Bill', 'Billing', '$'],
      ['Flow', 'BoodaFlow', '↯']
    ].forEach(([label, id, icon]) => {
      const b = document.createElement('button');
      b.dataset.view = id;
      b.innerHTML = `<b>${icon}</b><span>${label}</span>`;
      b.onclick = () => showView(id);
      mob.appendChild(b);
    });
  }

  function setActiveNav() {
    $$('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    const title = $('#pageTitle');
    if (title) title.textContent = view === 'Billing' ? 'Quotes & Billing' : view;
  }

  function showView(id) {
    view = id;
    setActiveNav();
    const ws = $('#workspace');
    if (!ws) return;
    if (id === 'Dashboard') return renderDashboard(ws);
    if (id === 'Service Intake') return renderIntake(ws);
    if (id === 'Dispatch') return renderList(ws, 'Dispatch / Jobs', records.filter((r) => ACTIVE_JOB.has(r.officeStatus)));
    if (id === 'Office Queue') return renderList(ws, 'Office Queue', records.filter((r) => r.officeStatus !== 'Completed'));
    if (id === 'Billing') return renderBilling(ws);
    if (id === 'Technicians') return renderTechnicians(ws);
    if (id === 'BoodaFlow') return renderBoodaFlow(ws);
    if (id === 'Reports') return renderReports(ws);
    if (id === 'Settings') return renderSettings(ws);
  }

  function counts() {
    const activeJobs = records.filter((r) => ACTIVE_JOB.has(r.officeStatus)).length;
    const queue = records.filter((r) => r.officeStatus && r.officeStatus !== 'Completed').length;
    const techs = new Set(records.map((r) => r.assignedTechnician).filter(Boolean)).size || technicians.length;
    return { activeJobs, queue, techs, total: records.length };
  }

  function renderDashboard(ws) {
    const c = counts();
    const jobs = records.filter((r) => ACTIVE_JOB.has(r.officeStatus)).slice(0, 5);
    const queue = records.filter((r) => r.officeStatus !== 'Completed').slice(0, 4);
    ws.innerHTML = `
      <div class="page-head">
        <div>
          <p class="eyebrow">Operations › Dashboard</p>
          <h2>Chill Pros Command</h2>
          <p class="lead">Live operations · License to Chill.</p>
        </div>
        <div class="form-actions">
          <button class="btn" type="button" data-go="Dispatch">Tech view</button>
          <button class="btn btn-primary" type="button" data-go="Service Intake">＋ New intake</button>
        </div>
      </div>
      <div class="metric-grid">
        <section class="metric-card"><span>Active jobs</span><strong>${c.activeJobs}</strong><small>Live</small></section>
        <section class="metric-card"><span>Office queue</span><strong>${c.queue}</strong><small>Needs action</small></section>
        <section class="metric-card"><span>Technicians</span><strong>${c.techs}</strong><small>Field</small></section>
        <section class="metric-card"><span>Customers</span><strong>${c.total}</strong><small>Records</small></section>
      </div>
      <div class="grid-2">
        <section class="glass-card">
          <div class="section-heading">
            <div><p class="eyebrow">Live</p><h3>Today's dispatch</h3></div>
            <button class="btn" type="button" data-go="Dispatch">Open board →</button>
          </div>
          ${jobs.length ? jobs.map((r) => `
            <div class="job-row">
              <div class="job-info">
                <strong>${esc(r.customerName || 'Customer')}</strong>
                <small>${esc(r.complaint || r.equipmentType || r.officeStatus || '')}</small>
              </div>
              <span class="status-badge">${esc(r.officeStatus || 'Open')}</span>
            </div>`).join('') : '<p style="color:var(--muted);margin:0;font-size:.88rem">No active jobs yet. Schedule from Office Queue.</p>'}
        </section>
        <section class="glass-card">
          <div class="section-heading">
            <div><p class="eyebrow">Needs attention</p><h3>Office queue</h3></div>
            <button class="btn" type="button" data-go="Office Queue">View →</button>
          </div>
          ${queue.length ? queue.map((r) => `
            <div class="queue-item">
              <div class="job-info">
                <strong>${esc(r.customerName || 'Customer')}</strong>
                <small>${esc(r.complaint || r.officeStatus || '')}</small>
              </div>
              <span class="status-badge warn">${esc(r.officeStatus || 'Review')}</span>
            </div>`).join('') : '<p style="color:var(--muted);margin:0;font-size:.88rem">Queue clear.</p>'}
        </section>
      </div>`;
    wireGo(ws);
  }

  function wireGo(root) {
    $$('[data-go]', root).forEach((b) => b.onclick = () => showView(b.dataset.go));
  }

  function renderIntake(ws) {
    ws.innerHTML = `
      <div class="page-head">
        <div>
          <p class="eyebrow">Operations workspace</p>
          <h2>Service Intake</h2>
          <p class="lead">Create a native Chill Pros customer / job record.</p>
        </div>
      </div>
      <section class="glass-card">
        <form class="form-grid" id="intakeForm">
          <label class="field">Customer / company<input name="customerName" required placeholder="Customer name"></label>
          <label class="field">Contact<input name="contactName" placeholder="Contact name"></label>
          <label class="field">Phone<input name="phone" placeholder="Phone"></label>
          <label class="field">Email<input name="email" type="email" placeholder="Email"></label>
          <label class="field wide">Service address<input name="address" placeholder="Full address"></label>
          <label class="field">Equipment type<input name="equipmentType" placeholder="Ice machine, walk-in, etc."></label>
          <label class="field">Manufacturer<input name="manufacturer" placeholder="Manufacturer"></label>
          <label class="field">Model<input name="modelNumber" placeholder="Model number"></label>
          <label class="field">Serial<input name="serialNumber" placeholder="Serial number"></label>
          <label class="field wide">Complaint / requested service<textarea name="complaint" required placeholder="What is the customer reporting?"></textarea></label>
          <label class="field wide">Findings<textarea name="findings" placeholder="Technician findings"></textarea></label>
          <label class="field">Estimated amount<input name="estimatedAmount" inputmode="decimal" placeholder="0.00"></label>
          <label class="field">Assigned technician<input name="assignedTechnician" placeholder="Technician name"></label>
          <div class="form-actions wide">
            <button class="btn btn-primary" type="submit">Save Service Intake</button>
            <button class="btn" type="reset">Clear</button>
          </div>
        </form>
      </section>`;
    $('#intakeForm').onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.currentTarget).entries());
      data.officeStatus = 'Needs Review';
      data.createdAt = new Date().toISOString();
      try {
        await db.collection('Customers').add(data);
        e.currentTarget.reset();
        await loadRecords();
        showView('Office Queue');
        toast('Service intake saved');
      } catch (x) {
        toast(x.message || 'Save failed');
      }
    };
  }

  function statusSelect(current, id) {
    return `<select data-id="${esc(id)}">${STATUS_OPTIONS.map((s) =>
      `<option value="${esc(s)}"${s === current ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>`;
  }

  function renderList(ws, title, list) {
    ws.innerHTML = `
      <div class="page-head">
        <div>
          <p class="eyebrow">Operations workspace</p>
          <h2>${esc(title)}</h2>
          <p class="lead">${list.length} record${list.length === 1 ? '' : 's'}.</p>
        </div>
      </div>
      <section class="glass-card">
        <div class="toolbar">
          <input id="filterRecords" placeholder="Search customers, jobs, equipment…">
        </div>
        <div id="recordList">${listHtml(list)}</div>
      </section>`;
    const all = list;
    $('#filterRecords').oninput = (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = all.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
      $('#recordList').innerHTML = listHtml(filtered);
      wireStatus();
    };
    wireStatus();
  }

  function listHtml(list) {
    if (!list.length) return '<p style="color:var(--muted);margin:0">No matching records.</p>';
    return list.map((r) => `
      <div class="list-row">
        <div>
          <strong>${esc(r.customerName || r.contactName || 'Record')}</strong>
          <small>${esc(r.address || r.phone || '')}</small>
          <small>${esc(r.complaint || r.equipmentType || '')}</small>
        </div>
        ${statusSelect(r.officeStatus || 'Needs Review', r.firestoreId)}
      </div>`).join('');
  }

  function wireStatus() {
    $$('#recordList select').forEach((sel) => {
      sel.onchange = async () => {
        try {
          await db.collection('Customers').doc(sel.dataset.id).set(
            { officeStatus: sel.value, statusUpdatedAt: new Date().toISOString() },
            { merge: true }
          );
          await loadRecords();
          showView(view);
          toast('Status updated');
        } catch (e) {
          toast(e.message || 'Update failed');
        }
      };
    });
  }

  function renderBilling(ws) {
    ws.innerHTML = `
      <div class="page-head">
        <div>
          <p class="eyebrow">Operations workspace</p>
          <h2>Quotes & Billing</h2>
          <p class="lead">Quote → approve → invoice → card/ACH checkout (native Stripe).</p>
        </div>
      </div>
      <section class="glass-card">
        <form class="form-grid" id="billForm">
          <label class="field">Customer / company<input id="bcustomer" placeholder="Customer name"></label>
          <label class="field">Customer email<input id="bemail" type="email" placeholder="email@example.com"></label>
          <label class="field">Job ID (optional)<input id="bjob" placeholder="Job / record id"></label>
          <label class="field">Qty<input id="bqty" type="number" min="1" value="1"></label>
          <label class="field wide">Scope<textarea id="bscope" placeholder="Scope of work"></textarea></label>
          <label class="field wide">Line description<input id="bdesc" placeholder="Repair / service line"></label>
          <label class="field">Unit price<input id="bprice" type="number" min="0" step="0.01" placeholder="0.00"></label>
        </form>
        <div class="form-actions" style="margin-top:12px">
          <button class="btn btn-primary" type="button" data-b="quote">Save draft quote</button>
          <button class="btn" type="button" data-b="approveq">Approve quote</button>
          <button class="btn btn-primary" type="button" data-b="invoice">Create invoice</button>
          <button class="btn" type="button" data-b="approvei">Approve invoice</button>
          <button class="btn btn-primary" type="button" data-b="pay">Card / ACH link</button>
          <button class="btn" type="button" data-b="status">Payment status</button>
        </div>
        <p id="billMeta" style="margin:14px 0 0;color:var(--muted);font-size:.85rem">Native billing ready. Owner approval required for quote approve, invoice approve, and checkout.</p>
      </section>`;
    $$('[data-b]', ws).forEach((b) => {
      b.onclick = () => runBilling(b.dataset.b);
    });
  }

  async function runBilling(action) {
    const meta = $('#billMeta');
    if (!meta) return;
    const ctx = {
      customerName: $('#bcustomer')?.value.trim() || '',
      customerEmail: $('#bemail')?.value.trim() || '',
      jobId: $('#bjob')?.value.trim() || '',
      scope: $('#bscope')?.value.trim() || '',
      description: $('#bdesc')?.value.trim() || '',
      quantity: Number($('#bqty')?.value || 1),
      unitPrice: Number($('#bprice')?.value || 0)
    };
    try {
      if (action === 'quote') {
        if (!ctx.description || !ctx.unitPrice) throw new Error('Enter description and unit price');
        const d = await secure('/quotes', {
          customerName: ctx.customerName,
          customerEmail: ctx.customerEmail,
          jobId: ctx.jobId || undefined,
          scope: ctx.scope,
          lines: [{ description: ctx.description, quantity: ctx.quantity, unitPrice: ctx.unitPrice }]
        });
        billState.quoteId = d.id;
        meta.textContent = `Draft quote saved · $${Number(d.total || 0).toFixed(2)} · ${d.id}`;
        toast('Quote saved');
      }
      if (action === 'approveq') {
        if (!billState.quoteId) throw new Error('Save a quote first');
        await secure(`/quotes/${encodeURIComponent(billState.quoteId)}/approve`, {});
        meta.textContent = 'Quote owner-approved.';
        toast('Quote approved');
      }
      if (action === 'invoice') {
        if (!billState.quoteId) throw new Error('Save a quote first');
        const d = await secure('/invoices', { quoteId: billState.quoteId });
        billState.invoiceId = d.id;
        meta.textContent = `Draft invoice · $${Number(d.total || 0).toFixed(2)} · ${d.id}`;
        toast('Invoice created');
      }
      if (action === 'approvei') {
        if (!billState.invoiceId) throw new Error('Create an invoice first');
        await secure(`/invoices/${encodeURIComponent(billState.invoiceId)}/approve`, {});
        meta.textContent = 'Invoice owner-approved.';
        toast('Invoice approved');
      }
      if (action === 'pay') {
        if (!billState.invoiceId) throw new Error('Create and approve an invoice first');
        const d = await secure('/payments/checkout', { invoiceId: billState.invoiceId });
        billState.sessionId = d.checkoutSessionId || '';
        meta.textContent = 'Secure card/ACH checkout ready.';
        if (d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
        toast('Checkout opened');
      }
      if (action === 'status') {
        if (!billState.sessionId) throw new Error('Create a payment checkout first');
        const d = await secure('/payments/status', { checkoutSessionId: billState.sessionId });
        meta.textContent = `Payment status: ${d.paymentStatus || d.status || 'unknown'}`;
      }
    } catch (e) {
      meta.textContent = e.message || 'Billing action failed';
      toast(e.message || 'Billing failed');
    }
  }

  function renderTechnicians(ws) {
    const fromJobs = [...new Set(records.map((r) => r.assignedTechnician).filter(Boolean))];
    const names = technicians.length
      ? technicians.map((t) => t.name || t.displayName).filter(Boolean)
      : fromJobs;
    ws.innerHTML = `
      <div class="page-head">
        <div>
          <p class="eyebrow">Operations workspace</p>
          <h2>Technicians</h2>
          <p class="lead">Field staff linked to jobs.</p>
        </div>
      </div>
      <section class="glass-card">
        ${names.length ? names.map((n) => {
          const count = records.filter((r) => r.assignedTechnician === n).length;
          return `<div class="list-row"><div><strong>${esc(n)}</strong><small>${count} linked job${count === 1 ? '' : 's'}</small></div></div>`;
        }).join('') : '<p style="color:var(--muted);margin:0">No technicians yet. Assign names on jobs or add below.</p>'}
      </section>
      <section class="glass-card">
        <h3 style="margin:0 0 10px;font-size:1rem">Add technician</h3>
        <form class="form-grid" id="techForm">
          <label class="field">Name<input name="name" required placeholder="Full name"></label>
          <label class="field">Phone<input name="phone" placeholder="Phone"></label>
          <label class="field wide">Email<input name="email" type="email" placeholder="Email"></label>
          <div class="form-actions wide">
            <button class="btn btn-primary" type="submit">Add technician</button>
          </div>
        </form>
      </section>`;
    $('#techForm').onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.currentTarget).entries());
      data.status = 'Active';
      data.createdAt = new Date().toISOString();
      try {
        await db.collection('Technicians').add(data);
        e.currentTarget.reset();
        await loadTechnicians();
        renderTechnicians(ws);
        toast('Technician added');
      } catch (x) {
        toast(x.message || 'Could not add technician');
      }
    };
  }

  function bfActive() {
    return bf.tasks.find((t) => t.status === 'active') || null;
  }
  function bfNext() {
    const order = { P0: 0, P1: 1, P2: 2 };
    return bf.tasks
      .filter((t) => t.status === 'queued')
      .sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9) || a.id - b.id)[0] || null;
  }
  function bfActivateNext() {
    if (bfActive()) return;
    const n = bfNext();
    if (n) {
      n.status = 'active';
      bf.currentId = n.id;
    }
  }
  function bfSetStatus(status) {
    const cur = bfActive();
    if (!cur) return;
    cur.status = status;
    bf.lastRun = new Date().toISOString();
    bfActivateNext();
    saveBf();
    renderBoodaFlow($('#workspace'));
  }

  function renderBoodaFlow(ws) {
    bfActivateNext();
    saveBf();
    const completed = bf.tasks.filter((t) => t.status === 'complete').length;
    const blocked = bf.tasks.filter((t) => t.status === 'blocked').length;
    const pending = bf.tasks.filter((t) => ['queued', 'active'].includes(t.status)).length;
    const current = bfActive();
    ws.innerHTML = `
      <div class="page-head">
        <div class="bf-title-row">
          <h2>BoodaFlow</h2>
          <span class="bf-badge">${esc(bf.mode)}</span>
        </div>
        <p class="lead" style="width:100%">Complete priority work → advance the next safe task → keep blocked work from stopping the queue.</p>
      </div>
      <section class="glass-card bf-panel">
        <div class="bf-metrics">
          <div class="bf-metric"><strong class="${bf.enabled ? 'bf-live' : 'bf-paused'}">${bf.enabled ? 'ACTIVE' : 'PAUSED'}</strong><small>Engine</small></div>
          <div class="bf-metric"><strong>${completed}/${bf.tasks.length}</strong><small>Progress</small></div>
          <div class="bf-metric"><strong>${pending}</strong><small>Pending</small></div>
          <div class="bf-metric"><strong>${blocked}</strong><small>Blocked</small></div>
        </div>
        <div class="bf-grid">
          <div class="bf-current">
            <div class="bf-current-label">Current task</div>
            <h3>${esc(current ? current.title : 'Queue complete')}</h3>
            <p>${esc(current ? current.detail : 'All current BoodaFlow tasks are complete or blocked.')}</p>
            <div class="bf-actions">
              <button class="btn btn-emerald" type="button" data-bf="complete" ${!bf.enabled || !current ? 'disabled' : ''}>Complete</button>
              <button class="btn btn-amber" type="button" data-bf="block" ${!bf.enabled || !current ? 'disabled' : ''}>Block</button>
              <button class="btn btn-ice" type="button" data-bf="toggle">${bf.enabled ? 'Pause' : 'Resume'}</button>
              <button class="btn" type="button" data-bf="reset">Reset queue</button>
            </div>
            <div class="bf-run-meta">Last run: ${bf.lastRun ? esc(new Date(bf.lastRun).toLocaleString()) : 'Not run yet'}</div>
          </div>
          <div class="bf-queue-card">
            <h3 style="margin:0 0 10px;font-size:1rem">Queue</h3>
            <ul class="bf-queue">
              ${bf.tasks.map((t) => `
                <li class="bf-task ${t.status}">
                  <span class="bf-priority">${esc(t.priority)}</span>
                  <div><strong>${esc(t.title)}</strong><small>${esc(t.status.toUpperCase())}</small></div>
                </li>`).join('')}
            </ul>
          </div>
        </div>
      </section>`;
    $$('[data-bf]', ws).forEach((b) => {
      b.onclick = () => {
        const a = b.dataset.bf;
        if (a === 'complete') bfSetStatus('complete');
        if (a === 'block') bfSetStatus('blocked');
        if (a === 'toggle') {
          bf.enabled = !bf.enabled;
          bf.lastRun = new Date().toISOString();
          saveBf();
          renderBoodaFlow(ws);
        }
        if (a === 'reset') {
          bf = structuredClone(BF_DEFAULT);
          saveBf();
          renderBoodaFlow(ws);
          toast('BoodaFlow reset');
        }
      };
    });
  }

  function renderReports(ws) {
    const c = counts();
    const byStatus = {};
    STATUS_OPTIONS.forEach((s) => { byStatus[s] = records.filter((r) => r.officeStatus === s).length; });
    ws.innerHTML = `
      <div class="page-head">
        <div>
          <p class="eyebrow">Operations workspace</p>
          <h2>Reports</h2>
          <p class="lead">Live summary from native records.</p>
        </div>
      </div>
      <div class="metric-grid">
        <section class="metric-card"><span>Customers</span><strong>${c.total}</strong></section>
        <section class="metric-card"><span>Active jobs</span><strong>${c.activeJobs}</strong></section>
        <section class="metric-card"><span>Queue</span><strong>${c.queue}</strong></section>
        <section class="metric-card"><span>Technicians</span><strong>${c.techs}</strong></section>
      </div>
      <section class="glass-card">
        <h3 style="margin:0 0 10px;font-size:1rem">By status</h3>
        ${STATUS_OPTIONS.map((s) => `
          <div class="list-row">
            <strong>${esc(s)}</strong>
            <span class="status-badge">${byStatus[s]}</span>
          </div>`).join('')}
      </section>`;
  }

  function renderSettings(ws) {
    ws.innerHTML = `
      <div class="page-head">
        <div>
          <p class="eyebrow">Operations workspace</p>
          <h2>Settings</h2>
          <p class="lead">Session and company.</p>
        </div>
      </div>
      <section class="glass-card">
        <div class="list-row">
          <div><strong>Signed in</strong><small>${esc(user.email)}</small></div>
          <button class="btn" type="button" id="so2">Sign out</button>
        </div>
        <div class="list-row">
          <div><strong>Role</strong><small>${esc(role())}</small></div>
        </div>
        <div class="list-row">
          <div><strong>Company</strong><small>Chill Pros · License to Chill.</small></div>
        </div>
        <div class="list-row">
          <div><strong>Chill Bro</strong><small>Side plug-in only (❄). Not part of core shell.</small></div>
        </div>
        <div class="list-row">
          <div><strong>BoodaFlow</strong><small>Priority execution · complete → next safe task</small></div>
        </div>
        <div class="list-row">
          <div><strong>Billing API</strong><small>nativeOpsApi · Stripe card + ACH</small></div>
        </div>
      </section>`;
    $('#so2').onclick = () => auth.signOut();
  }

  async function bootAuthed() {
    await loadProfile();
    await Promise.all([loadRecords(), loadTechnicians()]);
    shell();
  }

  function boot() {
    if (!auth || !db) {
      setTimeout(boot, 80);
      return;
    }
    auth.onAuthStateChanged(async (u) => {
      user = u;
      profile = null;
      if (!u) {
        renderLogin();
        return;
      }
      await bootAuthed();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
