
'use strict';

/* ═══ 1. STORAGE — localStorage, falls back to memory ══════════ */
const Store = (() => {
  const KEY = 'chillpros.command.v6';
  let mem = null, usable = true;
  try { localStorage.setItem('__cp', '1'); localStorage.removeItem('__cp'); }
  catch { usable = false; }
  return {
    persistent: usable,
    load() {
      if (mem) return mem;
      if (usable) { try { const r = localStorage.getItem(KEY); if (r) return (mem = JSON.parse(r)); } catch {} }
      return null;
    },
    save(state) {
      mem = state;
      if (!usable) return;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    }
  };
})();

/* ═══ 2. RATE BOOK ══════════════════════════════════════════════ */
const RATES = [
  { c: 'Labor', n: 'Trip charge',                 p: 30 },
  { c: 'Labor', n: 'Service charge / 1st hour',   p: 140 },
  { c: 'Labor', n: 'Hourly rate',                 p: 80 },
  { c: 'Labor', n: 'Hourly rate — follow up',     p: 90 },
  { c: 'Labor', n: 'Hourly — overtime',           p: 127.5 },
  { c: 'Labor', n: 'Return trip charge',          p: 32.5 },
  { c: 'Labor', n: 'Return hourly',               p: 80 },
  { c: 'PM',    n: 'HVAC PM flat rate',           p: 125 },
  { c: 'PM',    n: 'Cold side PM',                p: 80 },
  { c: 'PM',    n: 'PM — walk-in cooler',         p: 45 },
  { c: 'PM',    n: 'Convection oven PM',          p: 185 },
  { c: 'PM',    n: 'Ice machine cleaning',        p: 375 },
  { c: 'PM',    n: 'Coil cleaning',               p: 100 },
  { c: 'PM',    n: 'Drain clear w/ nitrogen',     p: 90 },
  { c: 'PM',    n: 'Filter clean / change',       p: 60 },
  { c: 'Refrigerant', n: 'R-134a (per lb)',       p: 50 },
  { c: 'Refrigerant', n: 'R-404A (per lb)',       p: 60 },
  { c: 'Refrigerant', n: 'R-410A (per lb)',       p: 75.5 },
  { c: 'Refrigerant', n: 'Nitrogen',              p: 90 },
  { c: 'Parts', n: 'Thermostat',                  p: 275 },
  { c: 'Parts', n: 'Contactor / relay',           p: 240 },
  { c: 'Parts', n: 'Starting components',         p: 185 },
  { c: 'Parts', n: 'Fan switch',                  p: 111 },
  { c: 'Parts', n: 'Electrical supplies',         p: 65 },
  { c: 'Parts', n: 'Compressor (installed)',      p: 1860 },
  { c: 'Parts', n: 'Magnetron',                   p: 385 },
  { c: 'Parts', n: 'Gas hose',                    p: 770 },
  { c: 'Parts', n: 'Custom part / material',      p: 0 }
];

/* ═══ 3. CARE PLANS ═════════════════════════════════════════════ */
const PLANS = {
  tiers: {
    Silver:  { visits: 1, label: 'Annual PM' },
    Gold:    { visits: 2, label: 'Semi-annual PM' },
    Diamond: { visits: 4, label: 'Quarterly PM' }
  },
  assets: [
    ['HVAC','Air conditioner / split system','AC',49,79,119],
    ['HVAC','Rooftop unit','RTU',59,99,149],
    ['HVAC','Gas furnace','GF',39,69,99],
    ['HVAC','Mini-split','MS',39,69,109],
    ['HVAC','Package unit','PU',59,99,149],
    ['HVAC','Make-up air unit','MUA',69,109,159],
    ['Refrigeration','Reach-in refrigerator','RIR',49,79,119],
    ['Refrigeration','Reach-in freezer','RIF',59,89,139],
    ['Refrigeration','Walk-in cooler','WIC',79,119,179],
    ['Refrigeration','Walk-in freezer','WIF',89,139,199],
    ['Refrigeration','Undercounter unit','UC',39,69,99],
    ['Refrigeration','Prep table','PT',49,79,119],
    ['Refrigeration','Beverage-Air unit','BA',49,79,119],
    ['Ice Machine','Cube ice machine','IM',49,79,129],
    ['Ice Machine','Nugget ice machine','NIM',59,99,149],
    ['Ice Machine','Flaker ice machine','FIM',59,99,149],
    ['Ice Machine','Ice dispenser','ID',39,59,89],
    ['Kitchen','Range / oven','RO',59,89,129],
    ['Kitchen','Convection oven','CO',59,89,129],
    ['Kitchen','Fryer','FRY',49,79,119],
    ['Kitchen','Griddle / flat top','GRD',49,79,119],
    ['Kitchen','Charbroiler','CB',49,79,119],
    ['Kitchen','Steamer','STM',69,109,159],
    ['Kitchen','Dishwasher','DW',79,119,169],
    ['Kitchen','Hot holding cabinet','HHC',39,59,89],
    ['Kitchen','Food warmer','FW',39,59,89]
  ],
  discount(n) { return n >= 15 ? .15 : n >= 8 ? .10 : n >= 4 ? .05 : 0; }
};

/* ═══ 4. PM CHECKLISTS ═════════════════════════════════════════ */
const CHECKLISTS = {
  'HVAC': [
    ['Filters', 'Filter condition, size and orientation recorded; replaced or cleaned'],
    ['Airflow', 'Return and supply airflow verified; no collapsed flex or blocked returns'],
    ['Evap coil', 'Evaporator coil inspected and cleaned; frost pattern normal'],
    ['Blower', 'Blower wheel cleaned, bearings/motor checked, amp draw within nameplate'],
    ['Condensate', 'Drain flushed, trap correct, float switch tested wet'],
    ['Condenser', 'Condenser coil cleaned, fan blade and motor checked'],
    ['Electrical', 'Contactor, relays, board, transformer inspected for pitting/heat'],
    ['Capacitors', 'Run/start capacitor microfarads measured against rating'],
    ['Voltage', 'Line voltage and control voltage recorded'],
    ['Amps', 'Compressor and fan motor amps recorded vs RLA/FLA'],
    ['Refrigerant', 'Line condition, insulation, suction/head pressures recorded'],
    ['Superheat/subcool', 'Superheat and subcooling measured where operating conditions allow'],
    ['Heat', 'Heat operation, ignition and flame sensor verified'],
    ['Thermostat', 'Thermostat calibration and staging verified'],
    ['Safeties', 'Pressure switches and safety controls verified — none bypassed'],
    ['Full cycle', 'Full cooling and heating cycle run to completion, temps recorded']
  ],
  'Refrigeration': [
    ['Box temp', 'Box temperature recorded at start and after service'],
    ['Gaskets', 'Door gaskets, hinges, closers and sweeps inspected'],
    ['Evap coil', 'Evaporator cleaned; frost pattern even, no flooding or starving'],
    ['Defrost', 'Defrost cycle initiated and verified to terminate correctly'],
    ['Drain line', 'Drain line and pan clear, heater working if fitted'],
    ['Condenser', 'Condenser coil cleaned, fan free and drawing correct amps'],
    ['Refrigerant', 'Suction and head pressures recorded; charge assessed'],
    ['Compressor', 'Compressor amp draw vs RLA; discharge line temperature'],
    ['Electrical', 'Contactor, relay, overload, capacitors and terminals checked'],
    ['Controls', 'Thermostat/controller setpoint and probe verified'],
    ['Full cycle', 'Unit run through complete cycle and pull-down confirmed']
  ],
  'Ice Machine': [
    ['Sanitize', 'Full cleaning and sanitizing per OEM procedure'],
    ['Water filter', 'Water filter condition checked, replaced and dated'],
    ['Scale', 'Evaporator, distribution tube and sump descaled'],
    ['Water level', 'Water level / float or probe operation verified'],
    ['Curtain/harvest', 'Curtain switch and harvest cycle verified'],
    ['Bin control', 'Bin level control verified to shut unit off'],
    ['Condenser', 'Air-cooled condenser cleaned, or water-cooled flow verified'],
    ['Pressures', 'Freeze and harvest pressures recorded'],
    ['Cycle time', 'Full freeze/harvest cycle timed and recorded'],
    ['Production', 'Ice thickness/bridge set, production and quality confirmed']
  ],
  'Kitchen': [
    ['Gas/electric supply', 'Supply pressure or voltage verified at unit'],
    ['Ignition', 'Ignition system, ignitor and flame sense verified'],
    ['Burners', 'Burners cleaned, flame pattern even'],
    ['Thermostat', 'Thermostat calibration checked against measured temperature'],
    ['Safeties', 'High limits and safety shutoffs tested'],
    ['Door/gasket', 'Doors, gaskets and hinges inspected for leaks or hazard'],
    ['Ventilation', 'Hood operation and filters checked'],
    ['Cleaning', 'Interior, grease and debris cleaned per OEM'],
    ['Calibration', 'Recovery time and operating temperature verified']
  ]
};

/* ═══ 5. STATE ═════════════════════════════════════════════════ */
const SEED_CUSTOMERS = [
  'palace mens club','ampm car wash','pizza classics','south texas ice',
  'la fogata','sonic drive in','taqueria el mezquite','the well','yard house'
].map((n, i) => ({ id: 'c' + i, name: n, site: '', city: 'San Antonio, TX', phone: '', email: '', notes: '' }));

const BLANK = {
  jobs: [], customers: SEED_CUSTOMERS, quotes: [], pms: [],
  techs: ['Unassigned', 'Chill', 'Tech 2'], seq: { job: 1000, quote: 500 },
  settings: {
    bizName: 'Chill Pros', bizPhone: '', bizEmail: '', bizAddress: '',
    taxRate: 8.25, notifyNewJob: true, notifyPayment: true, notifyPmDue: true
  }
};

let S = Store.load() || structuredClone(BLANK);
if (!S.settings) S.settings = structuredClone(BLANK.settings);
const save = () => Store.save(S);
const uid = () => Math.random().toString(36).slice(2, 10);
const money = n => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const $ = s => document.querySelector(s);

const TRADES = ['HVAC', 'Refrigeration', 'Ice Machine', 'Kitchen', 'PM'];
const tradeCls = t => ({ 'HVAC': 'hvac', 'Refrigeration': 'refrigeration', 'Ice Machine': 'ice', 'Kitchen': 'kitchen', 'PM': 'pm' }[t] || 'pm');
const STAGES = [
  { k: 'new', t: 'New calls', c: 'c-new' },
  { k: 'dispatched', t: 'Dispatched', c: 'c-dispatched' },
  { k: 'onsite', t: 'On site', c: 'c-onsite' },
  { k: 'complete', t: 'Complete', c: 'c-complete' }
];
const NEXT = { new: 'dispatched', dispatched: 'onsite', onsite: 'complete' };
const NEXT_LBL = { new: 'Dispatch', dispatched: 'Arrived on site', onsite: 'Mark complete' };

function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

/* ═══ 6. MODAL ═════════════════════════════════════════════════ */
function modal({ title, body, actions = [] }) {
  document.querySelector('.scrim')?.remove();
  const s = document.createElement('div');
  s.className = 'scrim';
  s.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <header><h2>${esc(title)}</h2><div style="flex:1"></div><button class="x" data-close aria-label="Close">&times;</button></header>
    <div class="mb">${body}</div>
    ${actions.length ? `<footer>${actions.map((a, i) =>
      `<button class="btn ${a.pri ? 'pri' : ''}" data-act="${i}">${esc(a.label)}</button>`).join('')}</footer>` : ''}
  </div>`;
  const close = () => s.remove();
  s.addEventListener('click', e => {
    if (e.target === s || e.target.closest('[data-close]')) return close();
    const b = e.target.closest('[data-act]');
    if (b) actions[+b.dataset.act].run?.(s, close);
  });
  document.addEventListener('keydown', function esckey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esckey); }
  });
  document.body.appendChild(s);
  s.querySelector('input,textarea,select')?.focus();
  return s;
}

/* ═══ 7. NAV — matches the Chill Pros Operations Center template ═ */
const ICONS = {
  dash: '<path d="M4 11l8-7 8 7M6 10v9h5v-6h2v6h5v-9"/>',
  newcust: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M16 11a3 3 0 100-6M18 20a6 6 0 00-3-5.2"/>',
  jobs: '<path d="M4 5h5v14H4zM10 5h5v9h-5zM16 5h4v6h-4z"/>',
  equip: '<path d="M15.5 6.5a3.5 3.5 0 00-4.9 4.9L4 18l2 2 6.6-6.6a3.5 3.5 0 004.9-4.9l-2.3 2.3-2-2z"/>',
  queue: '<path d="M4 4h16v10l-3 6H7l-3-6z"/><path d="M4 14h4l2 3h4l2-3h4"/>',
  pmagr: '<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  parts: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
  quote: '<path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5"/>',
  ai: '<path d="M12 4l1.8 4.2L18 10l-4.2 1.8L12 16l-1.8-4.2L6 10l4.2-1.8z"/><path d="M5 18l.8 1.9L8 20l-2.2.7L5 23l-.8-2.3L2 20l2.2-.1z"/>',
  assets: '<path d="M20 12l-8 8-9-9V4h7z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  reports: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'
};
const VIEWS = [
  { k: 'dash',    l: 'Dashboard',      t: 'Dashboard',              s: 'Capture it once. We handle the rest.' },
  { k: 'newcust', l: 'New Customer',   t: 'New Customer',           s: 'Capture customer & equipment' },
  { k: 'jobs',    l: 'Jobs',           t: 'Jobs',                   s: 'Every call, from ring to paid' },
  { k: 'equip',   l: 'Equipment',      t: 'Equipment',              s: 'Every unit you service, by customer' },
  { k: 'queue',   l: 'Office Queue',   t: 'Office Queue',           s: 'Send job data to the office' },
  { k: 'pmagr',   l: 'PM / Agreements',t: 'PM & Care Plans',        s: 'Care plans and preventive maintenance' },
  { k: 'parts',   l: 'Parts Orders',   t: 'Parts Orders',           s: 'Find parts & create orders' },
  { k: 'quote',   l: 'Quotes',         t: 'Quotes & Invoices',      s: 'Priced off your real invoice history' },
  { k: 'ai',      l: 'AI Diagnostics', t: 'AI Diagnostics',         s: 'Get help & run diagnostics' },
  { k: 'assets',  l: 'Assets',         t: 'Assets',                 s: 'Systems under a care plan' },
  { k: 'reports', l: 'Reports',        t: 'Reports',                s: 'Performance & activity' },
  { k: 'settings',l: 'Settings',       t: 'Settings',               s: 'Technicians & preferences' }
];

let route = 'dash';
let pendingAsk = null;
function askBro(q) { pendingAsk = q; go('ai'); }

function renderRail() {
  const r = $('#rail');
  r.innerHTML = `<div class="mark">
      <img src="/logo-texas.webp" alt="Chill Pros">
      <small>COMMAND CENTER</small></div>`
    + VIEWS.map(v => `<button class="navbtn" data-go="${v.k}" ${route === v.k ? 'aria-current="page"' : ''}>
        <svg viewBox="0 0 24 24">${ICONS[v.k]}</svg><span>${v.l}</span></button>`).join('')
    + '<div class="rail-sp"></div>';
}

function go(k) {
  route = k;
  const v = VIEWS.find(x => x.k === k);
  $('#vTitle').textContent = v.t;
  $('#vTitle').classList.add('icy-title');
  $('#vSub').textContent = v.s;
  renderRail();
  $('#view').scrollTop = 0;
  RENDER[k]();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  e.preventDefault();
  go(b.dataset.go);
});

/* ═══ 8. VIEWS ═════════════════════════════════════════════════ */
const RENDER = {};

/* ── Dashboard ── */
RENDER.dash = () => {
  $('#topAct').innerHTML = '';
  const jobsToday = S.jobs.filter(j => j.createdAt === today()).length;
  const inProgress = S.jobs.filter(j => j.stage === 'dispatched' || j.stage === 'onsite').length;
  const completedToday = S.jobs.filter(j => j.stage === 'complete' && j.completedAt === today()).length;
  const partsOrders = S.quotes.filter(q => q.isPartsOrder).length;
  const weekAgo = daysAgo(7);
  const pmVisits = S.pms.filter(p => p.date >= weekAgo).length;

  const upcoming = S.jobs.filter(j => j.stage !== 'complete')
    .sort((a, b) => a.priority - b.priority).slice(0, 3);

  const notes = [];
  S.jobs.filter(j => j.stage === 'dispatched' && (!j.tech || j.tech === 'Unassigned')).forEach(j =>
    notes.push({ cls: 'warn', b: `Job #${j.no} needs a tech assigned`, s: j.customer }));
  S.pms.filter(p => p.items.some(i => i.done) && p.items.some(i => !i.done)).forEach(p =>
    notes.push({ cls: 'info', b: `PM checklist in progress`, s: `${p.customer} · ${p.type}` }));
  if (!notes.length) notes.push({ cls: 'ok', b: 'All caught up', s: 'Nothing needs attention right now' });

  const urgent = notes.filter(n => n.cls === 'warn').length;
  $('#view').innerHTML = `
    <div class="card notifbar ${urgent ? 'hot' : ''}">
      <div class="sechd" style="margin-bottom:6px">${urgent ? `NEEDS ATTENTION · ${urgent}` : 'NOTIFICATIONS'}</div>
      ${notes.map(n => `<div class="notif"><span class="dot ${n.cls}"></span><div><b>${esc(n.b)}</b><small>${esc(n.s)}</small></div></div>`).join('')}
    </div>
    <div class="stats">
      <div class="stat"><div class="l">TODAY'S JOBS</div><div class="v">${jobsToday}</div><div class="u">Created today</div></div>
      <div class="stat"><div class="l">IN PROGRESS</div><div class="v">${inProgress}</div><div class="u">Active</div></div>
      <div class="stat"><div class="l">COMPLETED</div><div class="v">${completedToday}</div><div class="u">Today</div></div>
      <div class="stat"><div class="l">OFFICE QUEUE</div><div class="v">—</div><div class="u">Coming soon</div></div>
      <div class="stat"><div class="l">PARTS ORDERS</div><div class="v">${partsOrders}</div><div class="u">Pending</div></div>
      <div class="stat"><div class="l">PM VISITS</div><div class="v">${pmVisits}</div><div class="u">This week</div></div>
    </div>
    <div class="dashgrid2">
      <div class="card">
        <div class="sechd">QUICK ACTIONS</div>
        <button class="qa-rw" data-go="newcust"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M16 11a3 3 0 100-6M18 20a6 6 0 00-3-5.2"/></svg></span><span class="t"><b>New customer intake</b><small>Capture customer & equipment</small></span><span class="chev">›</span></button>
        <button class="qa-rw" data-go="jobs"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h5v14H4zM10 5h5v9h-5zM16 5h4v6h-4z"/></svg></span><span class="t"><b>View today's jobs</b><small>See your scheduled jobs</small></span><span class="chev">›</span></button>
        <button class="qa-rw" data-go="queue"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v10l-3 6H7l-3-6z"/><path d="M4 14h4l2 3h4l2-3h4"/></svg></span><span class="t"><b>Office queue</b><small>Send data to the office</small></span><span class="chev">›</span></button>
        <button class="qa-rw" data-go="ai"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4l1.8 4.2L18 10l-4.2 1.8L12 16l-1.8-4.2L6 10l4.2-1.8z"/></svg></span><span class="t"><b>AI diagnostics</b><small>Get help & run diagnostics</small></span><span class="chev">›</span></button>
        <button class="qa-rw" data-go="equip"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15.5 6.5a3.5 3.5 0 00-4.9 4.9L4 18l2 2 6.6-6.6a3.5 3.5 0 004.9-4.9l-2.3 2.3-2-2z"/></svg></span><span class="t"><b>Equipment records</b><small>View & manage equipment</small></span><span class="chev">›</span></button>
        <button class="qa-rw" data-go="parts"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/></svg></span><span class="t"><b>Parts lookup</b><small>Find parts & create orders</small></span><span class="chev">›</span></button>
      </div>
      <div class="card">
        <div class="sechd">UPCOMING JOBS</div>
        ${upcoming.length ? upcoming.map(j => `<div class="rw" style="margin-bottom:8px">
          <div class="g"><strong>${esc(j.problem)}</strong><small>${esc(j.customer)}${j.site ? ' · ' + esc(j.site) : ''}</small></div>
          <button class="btn sm gho" data-openjob="${j.id}">View</button></div>`).join('')
          : `<div class="muted" style="padding:8px 2px">Nothing on the board yet.</div>`}
      </div>
    </div>`;
};

/* ── New Customer (intake + list) ── */
RENDER.newcust = () => {
  $('#topAct').innerHTML = '';
  const list = [...S.customers].sort((a, b) => a.name.localeCompare(b.name));
  $('#view').innerHTML = `<div class="card" style="max-width:640px;margin-bottom:16px">
      <div class="row2">
        <div class="field"><label>Name</label><input class="inp" id="ncn" placeholder="Name or business" autofocus></div>
        <div class="field"><label>Site / store</label><input class="inp" id="ncs" placeholder="Location or store #"></div>
      </div>
      <div class="row2">
        <div class="field"><label>City</label><input class="inp" id="ncc" placeholder="San Antonio, TX"></div>
        <div class="field"><label>Phone</label><input class="inp" id="ncp" type="tel" placeholder="(210) 555-0100"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Email</label><input class="inp" id="nce" type="email"></div>
        <div class="field"><label>Equipment on file</label><input class="inp" id="ncq" placeholder="True GDM-69, RTU #3…"></div>
      </div>
      <button class="btn pri" id="ncSave">Save customer</button>
    </div>
    <div class="sechd">ALL CUSTOMERS</div>
    <div class="rows">${list.map(c => {
      const n = S.jobs.filter(j => j.customer.toLowerCase() === c.name.toLowerCase()).length;
      return `<div class="rw"><div class="g"><strong>${esc(c.name)}</strong>
        <small>${esc([c.site, c.city, c.phone].filter(Boolean).join(' · ') || 'No contact details yet')}</small></div>
        <span class="muted">${n} job${n === 1 ? '' : 's'}</span>
        <button class="btn sm gho" data-editc="${c.id}">Edit</button></div>`;
    }).join('')}</div>`;
  $('#ncSave').onclick = () => {
    const name = $('#ncn').value.trim();
    if (!name) return toast('Name is required');
    S.customers.push({ id: uid(), name, site: $('#ncs').value.trim(), city: $('#ncc').value.trim(),
      phone: $('#ncp').value.trim(), email: $('#nce').value.trim(), notes: $('#ncq').value.trim() });
    save(); go('newcust'); toast('Customer saved');
  };
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-editc]');
  if (b) editCustomer(b.dataset.editc);
});
function editCustomer(id) {
  const c = S.customers.find(x => x.id === id) || { name: '', site: '', city: '', phone: '', email: '', notes: '' };
  modal({
    title: id ? 'Edit customer' : 'Add customer',
    body: `<div class="field"><label>Name</label><input class="inp" id="cn" value="${esc(c.name)}"></div>
      <div class="row2">
        <div class="field"><label>Site / store</label><input class="inp" id="cs" value="${esc(c.site)}"></div>
        <div class="field"><label>City</label><input class="inp" id="cc" value="${esc(c.city)}"></div></div>
      <div class="row2">
        <div class="field"><label>Phone</label><input class="inp" id="cp" value="${esc(c.phone)}"></div>
        <div class="field"><label>Email</label><input class="inp" id="ce" type="email" value="${esc(c.email)}"></div></div>
      <div class="field"><label>Notes</label><textarea class="inp" id="cno">${esc(c.notes)}</textarea></div>`,
    actions: [
      ...(id ? [{ label: 'Delete', run: (s, cl) => { S.customers = S.customers.filter(x => x.id !== id); save(); cl(); go('newcust'); } }] : []),
      {
        label: 'Save', pri: true, run: (s, cl) => {
          const name = s.querySelector('#cn').value.trim();
          if (!name) return toast('Name is required');
          Object.assign(c, {
            name, site: s.querySelector('#cs').value.trim(), city: s.querySelector('#cc').value.trim(),
            phone: s.querySelector('#cp').value.trim(), email: s.querySelector('#ce').value.trim(),
            notes: s.querySelector('#cno').value
          });
          if (!id) { c.id = uid(); S.customers.push(c); }
          save(); cl(); go('newcust'); toast('Customer saved');
        }
      }
    ]
  });
}

/* ── Jobs (dispatch board) ── */
RENDER.jobs = () => {
  $('#topAct').innerHTML = `<button class="btn pri" id="newJobBtn">+ New job</button>`;
  $('#newJobBtn').onclick = () => newJobModal();
  const open = S.jobs.filter(j => j.stage !== 'complete').length;
  $('#vSub').textContent = open ? `${open} open · ${S.jobs.length} total` : 'Every call, from ring to paid';

  if (!S.jobs.length) {
    $('#view').innerHTML = `<div class="empty"><b>No jobs on the board</b>
      Take the next one that rings and it lands here.
      <div style="margin-top:16px"><button class="btn pri" id="emptyNewJob">Take a call</button></div></div>`;
    $('#emptyNewJob').onclick = () => newJobModal();
    return;
  }
  $('#view').innerHTML = `<div class="board">${STAGES.map(st => {
    const jobs = S.jobs.filter(j => j.stage === st.k);
    return `<section class="col ${st.c}">
      <h3><i></i>${st.t}<b>${jobs.length}</b></h3>
      ${jobs.map(jobCard).join('') || '<div class="muted" style="padding:6px 2px;font-size:12.5px">Nothing here</div>'}
    </section>`;
  }).join('')}</div>`;
};

const jobCard = j => `<article class="job p${j.priority}">
  <h4>${esc(j.problem)}</h4>
  <div class="site">${esc(j.customer)}${j.site ? ' · ' + esc(j.site) : ''}</div>
  <div class="tags">
    <span class="pill ${tradeCls(j.trade)}">${esc(j.trade)}</span>
    <span class="pill p${j.priority}">${['', 'Emergency', 'Same day', 'Scheduled'][j.priority]}</span>
    ${j.tech && j.tech !== 'Unassigned' ? `<span class="pill p3">${esc(j.tech)}</span>` : ''}
  </div>
  <div class="acts">
    ${NEXT[j.stage] ? `<button class="btn sm pri" data-adv="${j.id}">${NEXT_LBL[j.stage]}</button>` : ''}
    <button class="btn sm gho" data-openjob="${j.id}">Open</button>
    <button class="btn sm gho" data-ask="${j.id}">Ask Bro</button>
  </div></article>`;

document.addEventListener('click', e => {
  const adv = e.target.closest('[data-adv]');
  if (adv) {
    const j = S.jobs.find(x => x.id === adv.dataset.adv);
    if (!j) return;
    if (j.stage === 'dispatched' && (!j.tech || j.tech === 'Unassigned')) { openJob(j.id); return toast('Assign a tech first'); }
    j.stage = NEXT[j.stage];
    if (j.stage === 'complete') j.completedAt = today();
    save(); go('jobs'); toast(j.stage === 'complete' ? 'Job complete' : 'Job updated');
  }
  const op = e.target.closest('[data-openjob]');
  if (op) openJob(op.dataset.openjob);
  const ak = e.target.closest('[data-ask]');
  if (ak) {
    const j = S.jobs.find(x => x.id === ak.dataset.ask);
    askBro(`${j.trade} — ${j.problem}${j.equipment ? ' on a ' + j.equipment : ''}`);
  }
});

function newJobModal() {
  modal({
    title: 'New job',
    body: `<div class="row2">
        <div class="field"><label>Customer</label><input class="inp" id="njc" list="custListNJ" placeholder="Name or business">
          <datalist id="custListNJ">${S.customers.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist></div>
        <div class="field"><label>Site / store</label><input class="inp" id="njs" placeholder="Location or store #"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Callback number</label><input class="inp" id="njp" type="tel" placeholder="(210) 555-0100"></div>
        <div class="field"><label>Equipment</label><input class="inp" id="njeq" placeholder="True GDM-69, RTU #3…"></div>
      </div>
      <div class="field"><label>What's it doing?</label>
        <textarea class="inp" id="njprob" placeholder="Walk-in cooler at 52°F, compressor running constantly"></textarea></div>
      <div class="row3">
        <div class="field"><label>Trade</label><select class="inp" id="njtr">${TRADES.map(t => `<option>${t}</option>`).join('')}</select></div>
        <div class="field"><label>Priority</label><select class="inp" id="njpri">
          <option value="2" selected>Same day</option><option value="1">Emergency</option><option value="3">Scheduled</option></select></div>
        <div class="field"><label>Tech</label><select class="inp" id="njt">${S.techs.map(t => `<option>${t}</option>`).join('')}</select></div>
      </div>`,
    actions: [
      { label: 'Save & ask Chill Bro', run: (s, c) => {
          const j = buildJob(s); if (!j) return;
          c(); askBro(`${j.trade} — ${j.problem}${j.equipment ? ' on a ' + j.equipment : ''}`);
        } },
      { label: 'Put on the board', pri: true, run: (s, c) => {
          const j = buildJob(s); if (!j) return;
          c(); go('jobs'); toast(`Job #${j.no} on the board`);
        } }
    ]
  });
}
function buildJob(s) {
  const problem = s.querySelector('#njprob').value.trim(), customer = s.querySelector('#njc').value.trim();
  if (!customer) { toast('Customer name is required'); return null; }
  if (!problem) { toast('Add what the unit is doing'); return null; }
  const j = {
    id: uid(), no: ++S.seq.job, customer, site: s.querySelector('#njs').value.trim(),
    phone: s.querySelector('#njp').value.trim(), equipment: s.querySelector('#njeq').value.trim(),
    problem, trade: s.querySelector('#njtr').value, priority: +s.querySelector('#njpri').value,
    tech: s.querySelector('#njt').value, stage: 'new', notes: '', createdAt: today()
  };
  S.jobs.unshift(j);
  if (!S.customers.some(c => c.name.toLowerCase() === customer.toLowerCase()))
    S.customers.push({ id: uid(), name: customer, site: j.site, city: '', phone: j.phone, email: '', notes: '' });
  save();
  return j;
}

function openJob(id) {
  const j = S.jobs.find(x => x.id === id);
  if (!j) return;
  modal({
    title: `Job #${j.no} · ${j.customer}`,
    body: `<div class="field"><label>Problem reported</label><textarea class="inp" id="jp">${esc(j.problem)}</textarea></div>
      <div class="row2">
        <div class="field"><label>Equipment</label><input class="inp" id="je" value="${esc(j.equipment || '')}" placeholder="Make / model"></div>
        <div class="field"><label>Assigned tech</label><select class="inp" id="jt">${S.techs.map(t =>
          `<option ${t === j.tech ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      </div>
      <div class="row2">
        <div class="field"><label>Stage</label><select class="inp" id="js">${STAGES.map(s =>
          `<option value="${s.k}" ${s.k === j.stage ? 'selected' : ''}>${s.t}</option>`).join('')}</select></div>
        <div class="field"><label>Priority</label><select class="inp" id="jr">
          <option value="1" ${j.priority == 1 ? 'selected' : ''}>Emergency</option>
          <option value="2" ${j.priority == 2 ? 'selected' : ''}>Same day</option>
          <option value="3" ${j.priority == 3 ? 'selected' : ''}>Scheduled</option></select></div>
      </div>
      <div class="field"><label>Field notes &amp; readings</label><textarea class="inp" id="jn" placeholder="Pressures, amps, voltages, parts used…">${esc(j.notes || '')}</textarea></div>`,
    actions: [
      { label: 'Delete', run: (s, c) => { S.jobs = S.jobs.filter(x => x.id !== id); save(); c(); go('jobs'); toast('Job deleted'); } },
      { label: 'Quote this job', run: (s, c) => { c(); quoteFromJob(j); } },
      {
        label: 'Save', pri: true, run: (s, c) => {
          j.problem = s.querySelector('#jp').value.trim() || j.problem;
          j.equipment = s.querySelector('#je').value.trim();
          j.tech = s.querySelector('#jt').value;
          j.stage = s.querySelector('#js').value;
          j.priority = +s.querySelector('#jr').value;
          j.notes = s.querySelector('#jn').value;
          save(); c(); go('jobs'); toast('Job saved');
        }
      }
    ]
  });
}

/* ── Equipment (placeholder, seeded from real job data) ── */
RENDER.equip = () => {
  $('#topAct').innerHTML = '';
  const seen = {};
  S.jobs.filter(j => j.equipment).forEach(j => {
    (seen[j.customer] = seen[j.customer] || []).push(j.equipment);
  });
  const rows = Object.entries(seen);
  $('#view').innerHTML = `<div class="card soon" style="max-width:640px;margin:0 auto 18px;text-align:center">
      <div class="ic"><svg viewBox="0 0 24 24"><path d="M15.5 6.5a3.5 3.5 0 00-4.9 4.9L4 18l2 2 6.6-6.6a3.5 3.5 0 004.9-4.9l-2.3 2.3-2-2z"/></svg></div>
      <b style="display:block;font-size:16px;margin-bottom:6px">Full equipment records are coming soon</b>
      <div class="muted">Every unit you service will show up here automatically — pulled straight from your jobs and care plans, no double entry.</div>
    </div>
    ${rows.length ? `<div class="sechd">EQUIPMENT SEEN SO FAR</div>
    <div class="rows">${rows.map(([cust, eq]) => `<div class="rw"><div class="g"><strong>${esc(cust)}</strong>
      <small>${eq.map(esc).join(' · ')}</small></div></div>`).join('')}</div>` : ''}`;
};

/* ── Office Queue (placeholder) ── */
RENDER.queue = () => {
  $('#topAct').innerHTML = '';
  $('#view').innerHTML = `<div class="card soon" style="max-width:640px;margin:0 auto;text-align:center">
    <div class="ic"><svg viewBox="0 0 24 24"><path d="M4 4h16v10l-3 6H7l-3-6z"/><path d="M4 14h4l2 3h4l2-3h4"/></svg></div>
    <b style="display:block;font-size:16px;margin-bottom:6px">Office Queue is coming soon</b>
    <div class="muted">This is where a completed job's paperwork — notes, photos, signed tickets — will route straight to the office for billing and filing, without a phone call.</div>
  </div>`;
};

/* ── PM / Agreements (care plans + PM checklists, tabbed) ── */
let pmagrTab = 'care';
let planState = { tier: 'Gold', qty: {} };
let currentPM = null;

RENDER.pmagr = () => {
  $('#topAct').innerHTML = pmagrTab === 'pm' ? `<button class="btn pri" id="newPm">+ Start checklist</button>` : '';
  $('#view').innerHTML = `<div class="segw">
      <button class="${pmagrTab === 'care' ? 'on' : ''}" data-seg="care">Care plans</button>
      <button class="${pmagrTab === 'pm' ? 'on' : ''}" data-seg="pm">PM checklists</button>
    </div>
    <div id="pmagrBody"></div>`;
  $('.segw').addEventListener('click', e => {
    const b = e.target.closest('[data-seg]'); if (!b) return;
    pmagrTab = b.dataset.seg; go('pmagr');
  });
  if (pmagrTab === 'care') renderCarePlans(); else renderPMList();
  if (pmagrTab === 'pm') $('#newPm').onclick = () => startPM();
};

function renderCarePlans() {
  const rows = PLANS.assets.map(a => {
    const q = planState.qty[a[2]] || 0;
    const price = { Silver: a[3], Gold: a[4], Diamond: a[5] }[planState.tier];
    return { cat: a[0], name: a[1], code: a[2], q, price, line: q * price };
  });
  const units = rows.reduce((s, r) => s + r.q, 0);
  const gross = rows.reduce((s, r) => s + r.line, 0);
  const disc = PLANS.discount(units);
  const net = gross * (1 - disc);

  $('#pmagrBody').innerHTML = `<div class="grid" style="grid-template-columns:minmax(0,1.3fr) minmax(0,.7fr)">
    <div class="card">
      <div style="display:flex;gap:8px;margin-bottom:16px">${Object.keys(PLANS.tiers).map(t =>
        `<button class="btn ${planState.tier === t ? 'pri' : ''}" data-tier="${t}" style="flex:1">
          ${t}<br><span style="font-size:11px;font-weight:500;opacity:.8">${PLANS.tiers[t].label}</span></button>`).join('')}</div>
      ${['HVAC','Refrigeration','Ice Machine','Kitchen'].map(cat => `
        <div style="margin-bottom:15px"><div class="muted" style="font-weight:700;margin-bottom:6px">${cat}</div>
        ${rows.filter(r => r.cat === cat).map(r => `<div class="lrow">
          <span class="nm">${esc(r.name)}</span>
          <span class="pr">${money(r.price)}/mo</span>
          <input class="inp" type="number" min="0" value="${r.q}" data-qty="${r.code}">
        </div>`).join('')}</div>`).join('')}
    </div>
    <div class="card" style="align-self:start">
      <div style="font-size:12px;color:var(--mute);font-weight:700;margin-bottom:10px">${planState.tier} · ${PLANS.tiers[planState.tier].label} · ${PLANS.tiers[planState.tier].visits} visit${PLANS.tiers[planState.tier].visits > 1 ? 's' : ''}/yr</div>
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span class="muted">Systems covered</span><span class="amt">${units}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span class="muted">Monthly before discount</span><span class="amt">${money(gross)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span class="muted">One Stop Shop discount</span><span class="amt" style="color:var(--mint)">${disc ? '−' + (disc * 100).toFixed(0) + '%' : '—'}</span></div>
      <div style="display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid var(--line-hot);margin-top:7px">
        <strong>Monthly</strong><span class="amt" style="font-size:21px;color:var(--ice)">${money(net)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:3px 0"><span class="muted">Annual, paid monthly</span><span class="amt">${money(net * 12)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:3px 0"><span class="muted">Annual prepay (−5%)</span><span class="amt">${money(net * 12 * .95)}</span></div>
      <button class="btn pri" id="planQuote" style="width:100%;margin-top:16px" ${units ? '' : 'disabled'}>Build proposal</button>
      <div class="muted" style="margin-top:12px;font-size:11.5px">Bundle discount: 4+ systems −5%, 8+ −10%, 15+ −15%. Subject to site survey.</div>
    </div></div>`;

  $('#planQuote').onclick = () => {
    draft = newDraft({
      scope: `Chill Pros One Stop Shop Care Plan — ${planState.tier} tier\n${PLANS.tiers[planState.tier].label}, ${PLANS.tiers[planState.tier].visits} scheduled visit(s) per year, per system.\n${units} systems covered.`,
      items: rows.filter(r => r.q).map(r => ({ id: uid(), n: `${r.name} — ${planState.tier} care plan (monthly)`, qty: r.q, price: r.price, tax: false })),
      taxRate: 0
    });
    if (disc) draft.items.push({ id: uid(), n: `One Stop Shop bundle discount (${(disc * 100).toFixed(0)}%)`, qty: 1, price: -(gross * disc), tax: false });
    go('quote'); toast('Proposal drafted');
  };
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tier]');
  if (t) { planState.tier = t.dataset.tier; renderCarePlans(); }
});
document.addEventListener('change', e => {
  const q = e.target.closest('[data-qty]');
  if (q) { planState.qty[q.dataset.qty] = Math.max(0, parseInt(q.value) || 0); renderCarePlans(); }
});

function renderPMList() {
  if (!S.pms.length) {
    $('#pmagrBody').innerHTML = `<div class="empty"><b>No checklists running</b>
      Start one on site and it saves as you tick.
      <div style="margin-top:16px"><button class="btn pri" id="emptyPm">Start checklist</button></div></div>`;
    $('#emptyPm').onclick = startPM;
    return;
  }
  $('#pmagrBody').innerHTML = `<div class="rows">${S.pms.map(p => {
    const done = p.items.filter(i => i.done).length;
    return `<div class="rw"><div class="g"><strong>${esc(p.customer)} · ${esc(p.type)}</strong>
      <small>${esc(p.date)}${p.equipment ? ' · ' + esc(p.equipment) : ''} — ${done}/${p.items.length} complete</small></div>
      <button class="btn sm gho" data-openpm="${p.id}">Open</button></div>`;
  }).join('')}</div>`;
}
function startPM() {
  modal({
    title: 'Start a PM checklist',
    body: `<div class="field"><label>Customer</label><input class="inp" id="pc" list="custList3">
      <datalist id="custList3">${S.customers.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist></div>
      <div class="row2"><div class="field"><label>Equipment</label><input class="inp" id="pe" placeholder="RTU #3, walk-in cooler…"></div>
      <div class="field"><label>Checklist</label><select class="inp" id="pt">${Object.keys(CHECKLISTS).map(k => `<option>${k}</option>`).join('')}</select></div></div>`,
    actions: [{
      label: 'Start', pri: true, run: (s, c) => {
        const cust = s.querySelector('#pc').value.trim();
        if (!cust) return toast('Customer is required');
        const type = s.querySelector('#pt').value;
        S.pms.unshift({
          id: uid(), customer: cust, equipment: s.querySelector('#pe').value.trim(),
          type, date: today(),
          items: CHECKLISTS[type].map(([t, d]) => ({ id: uid(), t, d, done: false, note: '' }))
        });
        save(); c(); pmagrTab = 'pm'; go('pmagr'); toast('Checklist started');
      }
    }]
  });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-openpm]'); if (b) openPM(b.dataset.openpm);
});
function openPM(id) {
  const p = S.pms.find(x => x.id === id); if (!p) return;
  const done = p.items.filter(i => i.done).length;
  route = 'pmagr';
  renderRail();
  $('#topAct').innerHTML = `<button class="btn gho" data-go="pmagr" id="pmBack">← All checklists</button>`;
  $('#vTitle').textContent = `${p.type} PM`;
  $('#vSub').textContent = `${p.customer}${p.equipment ? ' · ' + p.equipment : ''} — ${done}/${p.items.length} complete`;
  $('#view').innerHTML = `<div style="max-width:760px">
    ${p.items.map(i => `<div class="chk ${i.done ? 'done' : ''}">
      <input type="checkbox" id="k${i.id}" ${i.done ? 'checked' : ''} data-pmk="${i.id}">
      <label for="k${i.id}"><b>${esc(i.t)}</b> — ${esc(i.d)}</label>
      <input class="note" placeholder="Reading" value="${esc(i.note)}" data-pmn="${i.id}"></div>`).join('')}
    <div style="display:flex;gap:9px;margin-top:16px;flex-wrap:wrap">
      <button class="btn pri" id="pmDone">Mark all complete</button>
      <button class="btn" id="pmQuote">Quote follow-up work</button>
      <button class="btn gho" id="pmDel">Delete</button></div></div>`;
  currentPM = p;
  $('#pmDone').onclick = () => { p.items.forEach(i => i.done = true); save(); openPM(id); toast('Checklist complete'); };
  $('#pmDel').onclick = () => { S.pms = S.pms.filter(x => x.id !== id); save(); pmagrTab = 'pm'; go('pmagr'); };
  $('#pmQuote').onclick = () => {
    draft = newDraft({
      customer: p.customer, scope: `${p.type} preventive maintenance — ${p.equipment || 'site equipment'}\n\nFindings:\n` +
        p.items.filter(i => i.note).map(i => `• ${i.t}: ${i.note}`).join('\n'),
      items: [{ id: uid(), n: 'Trip charge', qty: 1, price: 30, tax: false },
              { id: uid(), n: p.type === 'HVAC' ? 'HVAC PM flat rate' : 'Cold side PM', qty: 1, price: p.type === 'HVAC' ? 125 : 80, tax: false }]
    });
    go('quote');
  };
}
document.addEventListener('change', e => {
  const k = e.target.closest('[data-pmk]');
  if (k && currentPM) {
    const it = currentPM.items.find(i => i.id === k.dataset.pmk);
    if (it) { it.done = k.checked; save(); openPM(currentPM.id); }
    return;
  }
  const n = e.target.closest('[data-pmn]');
  if (n && currentPM) {
    const it = currentPM.items.find(i => i.id === n.dataset.pmn);
    if (it) { it.note = n.value; save(); }
  }
});

/* ── Parts Orders ── */
let partsCart = [];
RENDER.parts = () => {
  $('#topAct').innerHTML = '';
  const partsRates = RATES.filter(r => r.c === 'Parts' || r.c === 'Refrigerant');
  const cartTotal = partsCart.reduce((s, i) => s + i.qty * i.price, 0);
  const recent = S.quotes.filter(q => q.isPartsOrder);

  $('#view').innerHTML = `<div class="grid" style="grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr)">
    <div class="card">
      <div class="sechd">PARTS &amp; REFRIGERANT</div>
      ${partsRates.map(r => `<div class="lrow">
        <span class="nm">${esc(r.n)}</span>
        <span class="pr">${money(r.p)}</span>
        <button class="btn sm gho" data-addpart="${esc(r.n)}">+ Add</button>
      </div>`).join('')}
      ${recent.length ? `<div class="sechd">RECENT PARTS ORDERS</div>
      <div class="rows">${recent.map(q => `<div class="rw"><div class="g"><strong>#${q.no} · ${esc(q.customer || 'Unnamed')}</strong>
        <small>${esc(q.date)} · ${esc(q.status)}</small></div><span class="amt">${money(qTotals(q).total)}</span></div>`).join('')}</div>` : ''}
    </div>
    <div class="card" style="align-self:start">
      <div class="sechd">ORDER CART</div>
      ${partsCart.length ? partsCart.map(i => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">
        <span>${i.qty}× ${esc(i.n)}</span><span>${money(i.qty * i.price)}</span></div>`).join('')
        : `<div class="muted" style="padding:6px 0">Nothing added yet</div>`}
      <div style="display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid var(--line-hot);margin-top:9px">
        <strong>Total</strong><span class="amt" style="color:var(--ice)">${money(cartTotal)}</span></div>
      <button class="btn pri" id="createOrder" style="width:100%;margin-top:12px" ${partsCart.length ? '' : 'disabled'}>Create parts order</button>
    </div></div>`;

  $('#view').addEventListener('click', e => {
    const b = e.target.closest('[data-addpart]'); if (!b) return;
    const r = RATES.find(x => x.n === b.dataset.addpart); if (!r) return;
    const ex = partsCart.find(i => i.n === r.n);
    if (ex) ex.qty++; else partsCart.push({ n: r.n, qty: 1, price: r.p });
    RENDER.parts();
  });
  const co = $('#createOrder');
  if (co) co.onclick = () => {
    const q = newDraft({
      customer: '', scope: 'Parts order', taxRate: 8.25, isPartsOrder: true,
      items: partsCart.map(i => ({ id: uid(), n: i.n, qty: i.qty, price: i.price, tax: true }))
    });
    S.quotes.unshift(q); save(); partsCart = [];
    toast(`Parts order #${q.no} created`); draft = q; go('quote');
  };
};

/* ── Quotes & Invoices ── */
let draft = null;

const Q_STATUS = ['Draft', 'Sent', 'Approved', 'Declined', 'Invoiced', 'Paid'];
const Q_CLS = { Draft: 'st-draft', Sent: 'st-sent', Approved: 'st-approved',
  Declined: 'st-declined', Invoiced: 'st-invoiced', Paid: 'st-paid' };
const PAY_METHODS = ['ACH', 'Debit card', 'Credit card', 'Check', 'Cash'];

function newDraft(seed = {}) {
  return {
    id: uid(), no: ++S.seq.quote, date: today(), status: 'Draft',
    customer: '', site: '', email: '', jobRef: '', scope: '',
    items: [], taxRate: S.settings.taxRate, ...seed
  };
}
function refreshQuoteTotals() {
  if (!draft) return;
  const t = qTotals(draft);
  const a = $('#qSubVal'), b = $('#qTaxVal'), c = $('#qTotalVal');
  if (a) a.textContent = money(t.sub);
  if (b) b.textContent = money(t.tax);
  if (c) c.textContent = money(t.total);
}
const qTotals = q => {
  const sub = q.items.reduce((a, i) => a + i.qty * i.price, 0);
  const taxable = q.items.filter(i => i.tax).reduce((a, i) => a + i.qty * i.price, 0);
  const tax = taxable * (q.taxRate / 100);
  return { sub, tax, total: sub + tax };
};

function quoteFromJob(j) {
  draft = newDraft({
    customer: j.customer, site: j.site, jobRef: '#' + j.no,
    scope: j.problem + (j.equipment ? `\nEquipment: ${j.equipment}` : ''),
    items: [
      { id: uid(), n: 'Trip charge', qty: 1, price: 30, tax: false },
      { id: uid(), n: 'Service charge / 1st hour', qty: 1, price: 140, tax: false }
    ]
  });
  go('quote');
}

function syncQuoteFields() {
  if (!draft || !document.getElementById('qc')) return;
  draft.customer = $('#qc').value; draft.email = $('#qe').value;
  draft.site = $('#qs').value; draft.jobRef = $('#qj').value;
  draft.scope = $('#qsc').value; draft.taxRate = parseFloat($('#qtax').value) || 0;
}

RENDER.quote = () => {
  $('#topAct').innerHTML = `<button class="btn pri" id="newQ">+ New quote</button>`;
  $('#newQ').onclick = () => { draft = newDraft(); RENDER.quote(); };

  if (!draft) {
    if (!S.quotes.length) {
      $('#view').innerHTML = `<div class="empty"><b>No quotes yet</b>
        Start one from scratch, or open a job and hit "Quote this job".
        <div style="margin-top:16px"><button class="btn pri" id="emptyQ">New quote</button></div></div>`;
      $('#emptyQ').onclick = () => { draft = newDraft(); RENDER.quote(); };
      return;
    }
    $('#view').innerHTML = `<div class="rows">${S.quotes.map(q => {
      const t = qTotals(q);
      return `<div class="rw"><div class="g"><strong>#${q.no} · ${esc(q.customer || 'Unnamed')}</strong>
        <small>${esc(q.date)}${q.jobRef ? ' · job ' + esc(q.jobRef) : ''}</small></div>
        <span class="pill ${Q_CLS[q.status] || 'st-draft'}">${esc(q.status)}</span>
        <span class="amt">${money(t.total)}</span>
        <button class="btn sm gho" data-editq="${q.id}">Open</button></div>`;
    }).join('')}</div>`;
    return;
  }

  const t = qTotals(draft);
  const locked = draft.status === 'Paid';
  const actionsHtml = qActionButtons(draft.status);

  $('#view').innerHTML = `<div class="grid" style="grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr)">
    <div class="card">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:14px">
        <span class="pill ${Q_CLS[draft.status]}">${esc(draft.status)}</span>
        <span class="muted" style="font-size:12px">#${draft.no} · ${esc(draft.date)}</span>
      </div>
      <div class="row2">
        <div class="field"><label>Customer</label><input class="inp" id="qc" list="custList2" value="${esc(draft.customer)}" ${locked ? 'disabled' : ''}>
          <datalist id="custList2">${S.customers.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist></div>
        <div class="field"><label>Email</label><input class="inp" id="qe" type="email" value="${esc(draft.email)}" ${locked ? 'disabled' : ''}></div>
      </div>
      <div class="row2">
        <div class="field"><label>Site</label><input class="inp" id="qs" value="${esc(draft.site)}" ${locked ? 'disabled' : ''}></div>
        <div class="field"><label>Job reference</label><input class="inp" id="qj" value="${esc(draft.jobRef)}" ${locked ? 'disabled' : ''}></div>
      </div>
      <div class="field"><label>Scope of work</label><textarea class="inp" id="qsc" ${locked ? 'disabled' : ''}>${esc(draft.scope)}</textarea></div>

      <div style="display:flex;align-items:center;gap:9px;margin:16px 0 9px;flex-wrap:wrap">
        <strong style="font-size:13.5px">Line items</strong><div style="flex:1"></div>
        ${locked ? '' : `<select class="inp" id="qpick" style="width:auto;max-width:100%;font-size:13.5px;padding:8px 10px">
          <option value="">Add from rate book…</option>
          ${['Labor','PM','Refrigerant','Parts'].map(c =>
            `<optgroup label="${c}">${RATES.filter(r => r.c === c).map((r, i) =>
              `<option value="${RATES.indexOf(r)}">${esc(r.n)}${r.p ? ' — ' + money(r.p) : ''}</option>`).join('')}</optgroup>`).join('')}
        </select>`}
      </div>
      <div class="tblwrap"><table class="tbl" style="min-width:560px"><thead><tr><th style="min-width:170px">Item</th><th style="width:64px">Qty</th><th style="width:92px">Price</th><th style="width:50px">Tax</th><th style="width:90px" class="n">Amount</th><th style="width:34px"></th></tr></thead>
      <tbody>${draft.items.map(i => `<tr>
        <td><input class="inp" style="padding:7px 9px;font-size:14px;min-width:160px" value="${esc(i.n)}" data-li="${i.id}" data-f="n" ${locked ? 'disabled' : ''}></td>
        <td><input class="inp" style="padding:7px 6px;font-size:14px;text-align:center" type="number" min="0" step="0.5" value="${i.qty}" data-li="${i.id}" data-f="qty" ${locked ? 'disabled' : ''}></td>
        <td><input class="inp" style="padding:7px 6px;font-size:14px;text-align:right" type="number" min="0" step="0.01" value="${i.price}" data-li="${i.id}" data-f="price" ${locked ? 'disabled' : ''}></td>
        <td style="text-align:center"><input type="checkbox" ${i.tax ? 'checked' : ''} data-li="${i.id}" data-f="tax" style="accent-color:#38A9DC;width:18px;height:18px" ${locked ? 'disabled' : ''}></td>
        <td class="n" data-amt="${i.id}">${money(i.qty * i.price)}</td>
        <td>${locked ? '' : `<button class="x" style="width:26px;height:26px;font-size:16px" data-del="${i.id}">&times;</button>`}</td></tr>`).join('')
        || '<tr><td colspan="6" class="muted" style="padding:14px 10px">No line items. Pick one from the rate book above.</td></tr>'}</tbody></table></div>
      ${locked ? '' : '<button class="btn sm gho" id="qadd" style="margin-top:9px">+ Blank line</button>'}
    </div>

    <div class="card" style="align-self:start">
      <div style="display:flex;justify-content:space-between;margin-bottom:7px"><span class="muted">Subtotal</span><span class="amt" id="qSubVal">${money(t.sub)}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
        <span class="muted">Tax <input class="inp" id="qtax" type="number" step="0.01" value="${draft.taxRate}" style="width:60px;padding:4px 6px;font-size:13px;display:inline-block" ${locked ? 'disabled' : ''}>%</span>
        <span class="amt" id="qTaxVal">${money(t.tax)}</span></div>
      <div style="display:flex;justify-content:space-between;padding-top:11px;border-top:1px solid var(--line-hot);margin-top:4px">
        <strong>Total</strong><span class="amt" id="qTotalVal" style="font-size:20px;color:var(--ice)">${money(t.total)}</span></div>
      ${draft.status === 'Paid' ? `<div class="muted" style="margin-top:10px;font-size:12.5px">Paid via ${esc(draft.paymentMethod || '—')}${draft.paymentRef ? ' · ref ' + esc(draft.paymentRef) : ''} on ${esc(draft.paidAt || '')}</div>` : ''}
      <div style="display:grid;gap:8px;margin-top:18px">${actionsHtml}</div>
    </div></div>`;

  const sync = syncQuoteFields;
  const qpick = $('#qpick');
  if (qpick) qpick.onchange = e => {
    const r = RATES[+e.target.value]; if (!r) return;
    sync(); draft.items.push({ id: uid(), n: r.n, qty: 1, price: r.p, tax: r.c === 'Parts' || r.c === 'Refrigerant' });
    RENDER.quote();
  };
  const qadd = $('#qadd');
  if (qadd) qadd.onclick = () => { sync(); draft.items.push({ id: uid(), n: '', qty: 1, price: 0, tax: false }); RENDER.quote(); };
  $('#qtax').addEventListener('input', () => { sync(); refreshQuoteTotals(); });
  $('#qsave').onclick = () => {
    sync();
    if (!draft.customer.trim()) return toast('Add a customer name');
    const i = S.quotes.findIndex(q => q.id === draft.id);
    i >= 0 ? S.quotes[i] = draft : S.quotes.unshift(draft);
    save(); toast(`Quote #${draft.no} saved`);
  };
  const qcancel = $('#qcancel');
  if (qcancel) qcancel.onclick = () => { draft = null; RENDER.quote(); };
  const qsend = $('#qsend');
  if (qsend) qsend.onclick = () => {
    sync();
    if (!draft.items.length) return toast('Add at least one line item');
    if (!draft.customer.trim()) return toast('Add a customer name');
    draft.status = 'Sent'; draft.sentAt = today();
    persistDraft(); toast('Marked sent to customer');
  };
  const qapprove = $('#qapprove');
  if (qapprove) qapprove.onclick = () => { draft.status = 'Approved'; draft.approvedAt = today(); persistDraft(); toast('Marked approved'); };
  const qdecline = $('#qdecline');
  if (qdecline) qdecline.onclick = () => { draft.status = 'Declined'; persistDraft(); toast('Marked declined'); };
  const qresend = $('#qresend');
  if (qresend) qresend.onclick = () => { draft.status = 'Sent'; draft.sentAt = today(); persistDraft(); toast('Re-sent to customer'); };
  const qinv = $('#qinv');
  if (qinv) qinv.onclick = () => {
    sync();
    draft.status = 'Invoiced'; draft.invoicedAt = today();
    persistDraft(); toast(`Invoice #${draft.no} created`);
  };
  const qpay = $('#qpay');
  if (qpay) qpay.onclick = () => recordPayment(draft);
  const qprint = $('#qprint');
  if (qprint) qprint.onclick = () => toast('Print is disabled in this preview');
};

function persistDraft() {
  const i = S.quotes.findIndex(q => q.id === draft.id);
  i >= 0 ? S.quotes[i] = draft : S.quotes.unshift(draft);
  save(); RENDER.quote();
}

function qActionButtons(status) {
  const save = '<button class="btn" id="qsave">Save changes</button>';
  const print = '<button class="btn gho" id="qprint">Print / save as PDF</button>';
  const cancel = '<button class="btn gho" id="qcancel">Close</button>';
  const map = {
    Draft:    `<button class="btn pri" id="qsend">Send to customer</button>${save}${print}${cancel}`,
    Sent:     `<button class="btn pri" id="qapprove">Mark approved</button><button class="btn" id="qdecline">Mark declined</button>${save}${print}${cancel}`,
    Approved: `<button class="btn pri" id="qinv">Convert to invoice</button>${save}${print}${cancel}`,
    Declined: `<button class="btn pri" id="qresend">Re-send to customer</button>${save}${print}${cancel}`,
    Invoiced: `<button class="btn pri" id="qpay">Record payment</button>${print}${cancel}`,
    Paid:     `${print}${cancel}`
  };
  return map[status] || map.Draft;
}

function recordPayment(q) {
  const t = qTotals(q);
  modal({
    title: `Record payment · #${q.no}`,
    body: `<div class="field"><label>Method</label><select class="inp" id="pmMethod">
        ${PAY_METHODS.map(m => `<option>${m}</option>`).join('')}</select></div>
      <div class="row2">
        <div class="field"><label>Amount received</label><input class="inp" id="pmAmt" type="number" step="0.01" value="${t.total.toFixed(2)}"></div>
        <div class="field"><label>Reference / check #</label><input class="inp" id="pmRef" placeholder="Optional"></div>
      </div>
      <div class="muted" style="font-size:12.5px">Total due: ${money(t.total)}</div>`,
    actions: [
      { label: 'Cancel', run: (s, c) => c() },
      { label: 'Confirm payment', pri: true, run: (s, c) => {
          q.paymentMethod = s.querySelector('#pmMethod').value;
          q.paidAmount = parseFloat(s.querySelector('#pmAmt').value) || t.total;
          q.paymentRef = s.querySelector('#pmRef').value.trim();
          q.paidAt = today(); q.status = 'Paid';
          const i = S.quotes.findIndex(x => x.id === q.id);
          i >= 0 ? S.quotes[i] = q : S.quotes.unshift(q);
          save(); c(); toast(`Payment recorded · ${q.paymentMethod}`); RENDER.quote();
        } }
    ]
  });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-editq]');
  if (b) { draft = S.quotes.find(q => q.id === b.dataset.editq); go('quote'); }
});
document.addEventListener('input', e => {
  const li = e.target.closest('[data-li]');
  if (li && draft) {
    const it = draft.items.find(x => x.id === li.dataset.li); if (!it) return;
    const f = li.dataset.f;
    it[f] = f === 'n' ? li.value : (parseFloat(li.value) || 0);
    if (f === 'qty' || f === 'price') {
      const cell = document.querySelector(`[data-amt="${it.id}"]`);
      if (cell) cell.textContent = money(it.qty * it.price);
      refreshQuoteTotals();
    }
  }
});
document.addEventListener('change', e => {
  const li = e.target.closest('[data-li][data-f="tax"]');
  if (li && draft) {
    const it = draft.items.find(x => x.id === li.dataset.li); if (!it) return;
    it.tax = li.checked;
    refreshQuoteTotals();
  }
});
document.addEventListener('click', e => {
  const d = e.target.closest('[data-del]');
  if (d && draft) { syncQuoteFields(); draft.items = draft.items.filter(x => x.id !== d.dataset.del); RENDER.quote(); }
});

/* ── Assets (placeholder) ── */
RENDER.assets = () => {
  $('#topAct').innerHTML = '';
  $('#view').innerHTML = `<div class="card soon" style="max-width:640px;margin:0 auto;text-align:center">
    <div class="ic"><svg viewBox="0 0 24 24"><path d="M20 12l-8 8-9-9V4h7z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg></div>
    <b style="display:block;font-size:16px;margin-bottom:6px">Asset registry is coming soon</b>
    <div class="muted">Every system you sign up for a care plan will land here — one record per unit, with service history and warranty status at a glance.</div>
  </div>`;
};

/* ── Reports ── */
RENDER.reports = () => {
  $('#topAct').innerHTML = '';
  const done = S.jobs.filter(j => j.stage === 'complete').length;
  const invTotal = S.quotes.filter(q => q.status === 'Invoice').reduce((s, q) => s + qTotals(q).total, 0);
  const quoteTotal = S.quotes.reduce((s, q) => s + qTotals(q).total, 0);
  const byTrade = TRADES.map(t => ({ t, n: S.jobs.filter(j => j.trade === t).length })).filter(x => x.n);

  $('#view').innerHTML = `<div class="stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
      <div class="stat"><div class="l">TOTAL JOBS</div><div class="v">${S.jobs.length}</div></div>
      <div class="stat"><div class="l">COMPLETED</div><div class="v">${done}</div></div>
      <div class="stat"><div class="l">INVOICED</div><div class="v">${money(invTotal)}</div></div>
      <div class="stat"><div class="l">ALL QUOTES</div><div class="v">${money(quoteTotal)}</div></div>
    </div>
    <div class="card" style="max-width:520px">
      <div class="sechd">JOBS BY TRADE</div>
      ${byTrade.length ? byTrade.map(x => `<div style="display:flex;justify-content:space-between;padding:5px 0">
        <span class="pill ${tradeCls(x.t)}">${x.t}</span><span class="amt">${x.n}</span></div>`).join('')
        : `<div class="muted">No jobs logged yet</div>`}
    </div>
    <div class="muted" style="margin-top:16px;font-size:12px">Trend charts and exports are coming soon — this snapshot updates live from your data.</div>`;
};

/* ── Settings (manage technicians) ── */
RENDER.settings = () => {
  $('#topAct').innerHTML = '';
  const me = Auth.currentUser();
  const amAdmin = Auth.isAdmin();
  $('#view').innerHTML = `<div class="grid" style="max-width:560px;gap:14px">
    <div class="card">
      <div class="sechd">ACCOUNT</div>
      <div class="rw" style="margin-bottom:4px">
        <div class="g"><strong>${esc(me ? me.email : 'Not signed in')}</strong><small>${me ? (amAdmin ? 'Owner / admin' : 'Worker') : 'Sign in once your account is set up in Firebase'}</small></div>
        ${me ? '<button class="btn sm gho" id="signOutBtn">Sign out</button>' : '<button class="btn sm pri" id="signInBtn">Sign in</button>'}
      </div>
    </div>

    ${amAdmin ? `<div class="card">
      <div class="sechd">MANAGE WORKERS</div>
      <div class="muted" style="font-size:12px;margin-bottom:10px">Adding a worker creates their real login. Removing one revokes their access to this app immediately.</div>
      ${Auth.workers().map(w => `<div class="techrow"><span class="t">${esc(w.name || w.email)}<br><small class="muted">${esc(w.email)}</small></span>
        <button class="btn sm gho" data-rmworker="${esc(w.id)}">Remove</button></div>`).join('') || '<div class="muted" style="padding:6px 0">No workers added yet</div>'}
      <div class="row2" style="margin-top:12px">
        <div class="field"><label>Name</label><input class="inp" id="wName" placeholder="Tech name"></div>
        <div class="field"><label>Email</label><input class="inp" id="wEmail" type="email" placeholder="tech@example.com"></div>
      </div>
      <div class="field"><label>Temporary password</label><input class="inp" id="wPass" type="text" placeholder="At least 6 characters"></div>
      <button class="btn pri sm" id="addWorkerBtn">Add worker</button>
    </div>` : ''}

    <div class="card">
      <div class="sechd">BUSINESS INFO</div>
      <div class="row2">
        <div class="field"><label>Business name</label><input class="inp" id="setBizName" value="${esc(S.settings.bizName)}"></div>
        <div class="field"><label>Phone</label><input class="inp" id="setBizPhone" value="${esc(S.settings.bizPhone)}"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Email</label><input class="inp" id="setBizEmail" type="email" value="${esc(S.settings.bizEmail)}"></div>
        <div class="field"><label>Default tax rate %</label><input class="inp" id="setTaxRate" type="number" step="0.01" value="${S.settings.taxRate}"></div>
      </div>
      <div class="field"><label>Business address</label><input class="inp" id="setBizAddress" value="${esc(S.settings.bizAddress)}"></div>
      <button class="btn pri sm" id="saveBiz">Save business info</button>
    </div>

    <div class="card">
      <div class="sechd">NOTIFICATIONS</div>
      <label class="rw" style="margin-bottom:8px;cursor:pointer">
        <div class="g"><strong>New job needs a tech</strong><small>Show on the dashboard</small></div>
        <input type="checkbox" id="notifyNewJob" ${S.settings.notifyNewJob ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--ice-deep)">
      </label>
      <label class="rw" style="margin-bottom:8px;cursor:pointer">
        <div class="g"><strong>Payment received</strong><small>Show on the dashboard</small></div>
        <input type="checkbox" id="notifyPayment" ${S.settings.notifyPayment ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--ice-deep)">
      </label>
      <label class="rw" style="cursor:pointer">
        <div class="g"><strong>PM checklist in progress</strong><small>Show on the dashboard</small></div>
        <input type="checkbox" id="notifyPmDue" ${S.settings.notifyPmDue ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--ice-deep)">
      </label>
    </div>

    <div class="card">
      <div class="sechd">TECHNICIANS</div>
      ${S.techs.map(t => `<div class="techrow"><span class="t">${esc(t)}</span>
        ${t !== 'Unassigned' ? `<button class="btn sm gho" data-rmtech="${esc(t)}">Remove</button>` : ''}</div>`).join('')}
      <div style="display:flex;gap:8px;margin-top:10px">
        <input class="inp" id="newTech" placeholder="Add technician name">
        <button class="btn pri" id="addTech">Add</button>
      </div>
    </div>
  </div>`;

  $('#addTech').onclick = () => {
    const n = $('#newTech').value.trim();
    if (!n) return toast('Enter a name');
    if (S.techs.includes(n)) return toast('Already on the list');
    S.techs.push(n); save(); go('settings');
  };
  $('#saveBiz').onclick = () => {
    S.settings.bizName = $('#setBizName').value.trim();
    S.settings.bizPhone = $('#setBizPhone').value.trim();
    S.settings.bizEmail = $('#setBizEmail').value.trim();
    S.settings.bizAddress = $('#setBizAddress').value.trim();
    S.settings.taxRate = parseFloat($('#setTaxRate').value) || 0;
    save(); toast('Business info saved');
  };
  ['notifyNewJob', 'notifyPayment', 'notifyPmDue'].forEach(k => {
    $('#' + k).onchange = e => { S.settings[k] = e.target.checked; save(); };
  });
  const signOutBtn = $('#signOutBtn');
  if (signOutBtn) signOutBtn.onclick = () => {
    modal({
      title: 'Sign out?',
      body: '<div class="muted">You can sign back in any time.</div>',
      actions: [
        { label: 'Cancel', run: (s, c) => c() },
        { label: 'Sign out', pri: true, run: () => Auth.signOut() }
      ]
    });
  };
  const signInBtn = $('#signInBtn');
  if (signInBtn) signInBtn.onclick = () => {
    if (!fbReady) return toast('Firebase did not load — check your connection');
    modal({
      title: 'Sign in',
      body: `<div class="field"><label>Email</label><input class="inp" id="siEmail" type="email"></div>
        <div class="field"><label>Password</label><input class="inp" id="siPass" type="password"></div>`,
      actions: [
        { label: 'Cancel', run: (s, c) => c() },
        { label: 'Sign in', pri: true, run: (s, c) => {
            const email = s.querySelector('#siEmail').value.trim();
            const pass = s.querySelector('#siPass').value;
            if (!email || !pass) return toast('Enter email and password');
            Auth.signIn(email, pass).then(() => { c(); toast('Signed in'); setTimeout(() => go('settings'), 500); })
              .catch(err => toast(err.message || 'Could not sign in'));
          } }
      ]
    });
  };
  const addWorkerBtn = $('#addWorkerBtn');
  if (addWorkerBtn) addWorkerBtn.onclick = async () => {
    const name = $('#wName').value.trim(), email = $('#wEmail').value.trim(), pass = $('#wPass').value;
    if (!name || !email || !pass) return toast('Fill in name, email and password');
    if (pass.length < 6) return toast('Password needs at least 6 characters');
    addWorkerBtn.disabled = true; addWorkerBtn.textContent = 'Adding…';
    try {
      await Auth.addWorker(name, email, pass);
      if (!S.techs.includes(name)) { S.techs.push(name); save(); }
      toast(`${name} can now sign in`);
      go('settings');
    } catch (err) {
      toast(err.message || 'Could not add worker');
      addWorkerBtn.disabled = false; addWorkerBtn.textContent = 'Add worker';
    }
  };
};
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-rmworker]'); if (!b) return;
  const w = Auth.workers().find(x => x.id === b.dataset.rmworker); if (!w) return;
  modal({
    title: `Remove ${w.name || w.email}?`,
    body: '<div class="muted">They will be signed out and unable to open the app again until re-added.</div>',
    actions: [
      { label: 'Cancel', run: (s, c) => c() },
      { label: 'Remove', pri: true, run: async (s, c) => {
          await Auth.removeWorker(w.id);
          S.techs = S.techs.filter(t => t !== w.name); save();
          c(); toast('Access revoked'); go('settings');
        } }
    ]
  });
});

/* ── AI Diagnostics: a real page now, not a floating drawer ── */
RENDER.ai = () => {
  $('#topAct').innerHTML = '';
  $('#view').innerHTML = `<div class="ai-page">
      <div class="ai-head">
        <img class="face avatar" id="broFace" src="/bro-head.webp" alt="">
        <div class="hdinfo"><strong>Chill Bro</strong><small><i></i><span id="broStatus">Field brain loaded · works offline</span></small></div>
        <button class="vbtn" id="broVoice" aria-label="Voice on or off" aria-pressed="false"></button>
      </div>
      <div class="bro-thread" id="broThread"></div>
      <div class="bro-chips" id="broChips"></div>
      <div class="bro-cmp">
        <textarea id="broInput" rows="1" placeholder="What's the unit doing?"></textarea>
        <button class="mic" id="broMic" aria-label="Speak" hidden>
          <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>
        </button>
        <button class="snd" id="broSend" aria-label="Send">
          <svg viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg>
        </button>
      </div>
    </div>`;
  Bro.mount();
  if (pendingAsk) { const q = pendingAsk; pendingAsk = null; setTimeout(() => Bro.send(q), 400); }
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-rmtech]'); if (!b) return;
  S.techs = S.techs.filter(t => t !== b.dataset.rmtech); save(); go('settings');
});

/* ═══ 9. CHILL BRO — ice-cube mascot: cap, shades, polo, shaka ═══ */

const BRO_API = '';

/* ── voice: Chill Bro speaks; mic where the browser supports it ── */

/* ── auth: lightweight local session, no backend to check a ── */
/* password against — this personalizes the app and gates the ── */
/* splash screen; it is not real account security.              */
/* ── Firebase project already deployed at this domain — reused ── */
/* here directly (not via the orphaned firebase-config.js, which  */
/* also auto-mounts old broken chill-bro-v3 scripts we removed).  */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBsBEKMggwSUvEmdTTK1rjYOcdPyYCCLOc",
  authDomain: "chill-pros-ice-stream.firebaseapp.com",
  projectId: "chill-pros-ice-stream",
  storageBucket: "chill-pros-ice-stream.firebasestorage.app",
  messagingSenderId: "260000821827",
  appId: "1:260000821827:web:4d65bb9f17a29001eedaf6"
};
let fbApp = null, fbAuth = null, fbDb = null, fbReady = false;
try {
  if (window.firebase && firebase.initializeApp) {
    fbApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    fbReady = true;
  }
} catch (e) { fbReady = false; }

const Auth = (() => {
  let adminEmails = [];
  let workers = [];   // [{email, name}]
  let current = null; // firebase user object once signed in + authorized

  async function loadRoster() {
    if (!fbReady) return;
    const adminsDoc = await fbDb.collection('app_config').doc('admins').get();
    if (adminsDoc.exists) {
      adminEmails = adminsDoc.data().emails || [];
    } else if (current) {
      // first person ever to sign in becomes the owner/admin
      adminEmails = [current.email];
      await fbDb.collection('app_config').doc('admins').set({ emails: adminEmails });
    }
    const snap = await fbDb.collection('workers').get();
    workers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  function isAdmin(email) { return adminEmails.includes((email || '').toLowerCase()); }
  function isAuthorized(email) {
    const e = (email || '').toLowerCase();
    return isAdmin(e) || workers.some(w => (w.email || '').toLowerCase() === e);
  }

  function signIn(email, password) {
    if (!fbReady) return Promise.reject(new Error('Firebase did not load — check your connection and reload.'));
    return fbAuth.signInWithEmailAndPassword(email.trim(), password);
  }
  function signOut() {
    if (fbReady) fbAuth.signOut();
    current = null;
    location.reload();
  }

  /* Creates a worker's login via the Auth REST API directly — this   */
  /* does NOT touch the admin's own signed-in session, unlike the SDK's */
  /* own createUserWithEmailAndPassword (which would sign the admin out */
  /* and into the new account instead).                                 */
  async function addWorker(name, email, password) {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, returnSecureToken: true }) }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message === 'EMAIL_EXISTS' ? 'That email already has a login' : data.error.message);
    await fbDb.collection('workers').doc(data.localId).set({
      name: name.trim(), email: email.trim().toLowerCase(), addedAt: today(), addedBy: current ? current.email : ''
    });
    await loadRoster();
  }

  /* Revokes app access immediately (removed from the authorized roster). */
  /* Their Firebase login credential itself still technically exists —   */
  /* fully deleting it requires a small server-side admin function.       */
  async function removeWorker(id) {
    await fbDb.collection('workers').doc(id).delete();
    await loadRoster();
  }

  function onChange(cb) {
    if (!fbReady) { cb(null); return; }
    fbAuth.onAuthStateChanged(async user => {
      if (!user) { current = null; cb(null); return; }
      current = user;
      await loadRoster();
      if (!isAuthorized(user.email)) {
        await fbAuth.signOut();
        current = null;
        cb('unauthorized');
        return;
      }
      cb(user);
    });
  }

  return {
    signIn, signOut, onChange, addWorker, removeWorker, loadRoster,
    isAdmin: () => current && isAdmin(current.email),
    workers: () => workers,
    currentUser: () => current
  };
})();

const Voice = (() => {
  const KEY = 'chillpros.voice';
  const synth = window.speechSynthesis || null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let on = false, btn = null, mic = null, rec = null, recording = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch {}

  const ON_ICO  = '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9.5a3.5 3.5 0 010 5M19 6.5a8 8 0 010 11"/></svg>';
  const OFF_ICO = '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>';

  function paint() {
    if (!btn) return;
    btn.innerHTML = on ? ON_ICO : OFF_ICO;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'Turn Chill Bro voice off' : 'Turn Chill Bro voice on');
  }

  /* strip markup so the synth reads clean prose, not tag soup */
  function plain(html) {
    return String(html)
      .replace(/<br\s*\/?>/gi, '. ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/[\u2022\u00b7]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim().slice(0, 600);
  }

  function stop() { try { synth && synth.cancel(); } catch {} }

  function speak(html, onTalk) {
    if (!on || !synth) return false;
    const text = plain(html);
    if (!text) return false;
    stop();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.03; u.pitch = 0.85;
    u.onstart = () => onTalk && onTalk(true);
    u.onend = () => onTalk && onTalk(false);
    u.onerror = () => onTalk && onTalk(false);
    try { synth.speak(u); return true; } catch { return false; }
  }

  function mount(o) {
    btn = o.btn; mic = o.mic;
    if (!synth && btn) { btn.hidden = true; }
    paint();
    btn && btn.addEventListener('click', () => {
      on = !on;
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {}
      if (!on) stop();
      paint();
      toast(on ? 'Chill Bro will talk out loud' : 'Chill Bro muted');
    });

    if (SR && mic) {
      mic.hidden = false;
      rec = new SR();
      rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = e => { const t = e.results[0][0].transcript; if (t) o.onText(t); };
      rec.onend = () => { recording = false; mic.classList.remove('rec'); };
      rec.onerror = () => { recording = false; mic.classList.remove('rec'); };
      mic.addEventListener('click', () => {
        if (recording) { try { rec.stop(); } catch {} return; }
        try { rec.start(); recording = true; mic.classList.add('rec'); }
        catch { toast('Could not start the mic'); }
      });
    }
  }

  return { mount, speak, stop, enabled: () => on && !!synth };
})();



const Bro = (() => {
  const el = {}; let msgs = [], busy = false, talkTimer = null;

  const CHIPS = [
    ['Walk me through a PM', 'Walk me through an HVAC PM'],
    ['Price this job', 'What should I charge for a service call with one hour of labor?'],
    ['Contactor won\'t pull in', 'Condenser contactor is not pulling in'],
    ['Find a part', 'How do I source the right part number?'],
    ['Superheat help', 'Explain superheat and subcooling readings']
  ];

  function bubble(role, html) {
    const d = document.createElement('div');
    d.className = 'msg ' + (role === 'me' ? 'me' : 'bro');
    d.innerHTML = html;
    el.thread.appendChild(d);
    el.thread.scrollTop = el.thread.scrollHeight;
    return d;
  }

  function typing() {
    const d = document.createElement('div');
    d.className = 'msg bro typing';
    d.innerHTML = '<i></i><i></i><i></i>';
    el.thread.appendChild(d);
    el.thread.scrollTop = el.thread.scrollHeight;
    return d;
  }

  function setTalking(on, ms) {
    document.querySelectorAll('.avatar').forEach(a => a.classList.toggle('talking', on));
    clearTimeout(talkTimer);
    if (on && ms) talkTimer = setTimeout(() => setTalking(false), ms);
  }

  function score(q, entry) {
    const t = q.toLowerCase();
    let s = 0;
    for (const kw of entry.k) if (t.includes(kw)) s += kw.length > 6 ? 3 : 2;
    return s;
  }

  function localAnswer(q) {
    const t = q.toLowerCase();

    if (/\b(charge|price|quote|cost|bill|how much|rate)\b/.test(t)) {
      const hits = RATES.filter(r => r.p && t.split(/\W+/).some(w => w.length > 3 && r.n.toLowerCase().includes(w)));
      const show = (hits.length ? hits : RATES.filter(r => r.c === 'Labor')).slice(0, 7);
      return { html: `Here's what you've actually been billing, straight off your invoice history:\n\n`
        + show.map(r => `• <b>${esc(r.n)}</b> — ${money(r.p)}`).join('\n')
        + `\n\nTypical service call lands at trip charge + first hour = <b>${money(170)}</b> before parts. Open <b>Quotes</b> and pick these off the rate book — the math and the printable invoice are already wired.`,
        src: 'Median unit pricing from 267 Chill Pros invoices' };
    }
    if (/\b(checklist|pm |preventive|preventative|maintenance)\b/.test(t)) {
      const type = /refrig|cooler|freezer|walk/.test(t) ? 'Refrigeration'
        : /ice|cube|nugget|flaker/.test(t) ? 'Ice Machine'
        : /fry|oven|griddle|steam|dish|kitchen/.test(t) ? 'Kitchen' : 'HVAC';
      return { html: `${type} PM, the order that keeps you off a callback:\n\n`
        + CHECKLISTS[type].map((c, i) => `${i + 1}. <b>${esc(c[0])}</b> — ${esc(c[1])}`).join('\n')
        + `\n\nHit <b>PM / Agreements → PM checklists → Start checklist</b> and pick ${type}.`,
        src: 'Chill Pros PM library' };
    }
    const KB = [
      { id:'gdm69', k:['gdm','gdm-69','true','restriction','cap tube','capillary','drier','filter drier','near vacuum','suction vacuum','134a','box warm','not cooling reach in'],
        title:'True GDM-69 — warm box, suction near vacuum',
        body:`R-134a reach-in. Box climbing toward 50°F with suction pulled near vacuum is a <b>sealed-system restriction</b> until proven otherwise — filter drier and capillary tube are the top two suspects.\n\nWork it in this order:\n1. Record suction and head pressure together, not suction alone.\n2. Compressor amp draw vs nameplate RLA. A restricted system usually runs <b>low</b> amps.\n3. Feel for a temperature drop across the drier.\n4. Read the evaporator frost pattern — partial frost that dies part-way down the coil says starved.\n\nOEM references on file: capillary tube <code>851142</code>, filter drier <code>800806</code>.`,
        src:'Chill Pros field case — True GDM-69' },
      { id:'e1', k:['e1','kool-it','kgm','kgm-75','error code e1','probe','thermistor','display cooler','sensor fault','alarm'],
        title:'Kool-It KGM-75 — E1 alarm',
        body:`E1 on this box points at the <b>temperature probe circuit</b> before it points at refrigeration.\n\nRanked, evidence-first:\n1. Inspect the probe and its full wire run.\n2. Ohm the probe vs the OEM temp/resistance chart.\n3. Wiring and connectors at the controller.\n4. Controller itself.\n5. Refrigeration last.`,
        src:'Chill Pros field case — Kool-It KGM-75' },
      { id:'control', k:['contactor','not pulling in','no call','y to c','24v at contactor','pressure switch','safety','open switch','condenser wont start','wont kick on','control circuit'],
        title:"Control circuit — condenser won't pull in",
        body:`Standard order:\n1. Confirm the thermostat is calling — measure <b>Y to C at the condenser</b>.\n2. Measure across the contactor coil, <b>A1 to A2</b>.\n3. No voltage at the coil? Measure across each pressure switch/safety — the one reading full voltage is open.\n4. Never leave a switch bypassed. Confirm the pressure condition first.\n5. Record readings and photo the wiring for the file.`,
        src:'Chill Pros control-circuit standard' },
      { id:'parts', k:['part number','parts','order','supplier','sourcing','cross reference','supersede','where to buy','oem'],
        title:'Parts sourcing',
        body:`1. Data plate — model <b>and</b> serial.\n2. OEM parts catalog for that serial range.\n3. OEM distributor cross-reference.\n4. Parts Town / SupplyHouse / Johnstone for stock.\n5. Call OEM tech support before ordering anything expensive on a guess.`,
        src:'CP_PS_001 True Refrigeration OEM parts sourcing guide' },
      { id:'super', k:['superheat','subcool','subcooling','charge','charging','txv','piston','how much charge','undercharged','overcharged'],
        title:'Superheat and subcooling',
        body:`• <b>Low superheat / high subcooling</b> → overcharge.\n• <b>High superheat / low subcooling</b> → undercharge or restriction.\n• <b>High superheat / high subcooling</b> → restriction after the condenser.\n• <b>Low superheat / low subcooling</b> → compressor not pumping.\n\nFixed orifice: charge by superheat. TXV: charge by subcooling, usually 10–12°F.`,
        src:'Chill Pros field method' }
    ];
    const ranked = KB.map(e => ({ e, s: score(q, e) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
    if (ranked.length) {
      const top = ranked[0].e;
      return { html: `<b>${esc(top.title)}</b>\n\n${top.body}`, src: top.src };
    }
    return { html: `Ay, don't have that exact one filed yet — no sense guessing on it.\n\nGive me the <b>make and model</b>, <b>refrigerant</b>, <b>pressures and amps</b>, and <b>what changed right before it broke</b>, and I'll get sharper fast.`,
      src: null };
  }

  async function answer(q) {
    if (!BRO_API) return localAnswer(q);
    return localAnswer(q);
  }

  async function send(text) {
    const q = (text || el.input.value).trim();
    if (!q || busy) return;
    busy = true; el.send.disabled = true;
    el.input.value = ''; el.input.style.height = 'auto';
    bubble('me', esc(q));
    msgs.push({ role: 'user', content: q });
    const dots = typing();
    el.status.textContent = 'Thinking…';
    setTalking(true);
    await new Promise(r => setTimeout(r, 500));
    const a = await answer(q);
    dots.remove();
    bubble('bro', a.html + (a.src ? `<span class="src">${esc(a.src)}</span>` : ''));
    if (!Voice.speak(a.html, v => setTalking(v))) {
      setTalking(true, Math.min(4200, Math.max(1200, a.html.length * 12)));
    }
    msgs.push({ role: 'assistant', content: a.html });
    el.status.textContent = 'Field brain loaded · works offline';
    busy = false; el.send.disabled = false;
    el.input.focus();
  }

  function mount() {
    el.thread = $('#broThread'); el.input = $('#broInput');
    el.send = $('#broSend'); el.status = $('#broStatus'); el.chips = $('#broChips');
    if (!el.thread) return;

    el.chips.innerHTML = CHIPS.map(([l, q]) =>
      `<button class="chip" data-chip="${esc(q)}">${esc(l)}</button>`).join('');
    el.chips.addEventListener('click', e => {
      const c = e.target.closest('[data-chip]');
      if (c) send(c.dataset.chip);
    });

    el.send.addEventListener('click', () => send());
    el.input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    el.input.addEventListener('input', () => {
      el.input.style.height = 'auto';
      el.input.style.height = Math.min(el.input.scrollHeight, 92) + 'px';
    });

    Voice.mount({
      btn: $('#broVoice'),
      mic: $('#broMic'),
      onText: t => { el.input.value = t; send(); }
    });

    setTalking(true, 1400);
    bubble('bro', `Yoooo, what it do. Chill Bro in the building — cap on, shades on, ice for a head.\n\nI got your field cases loaded: True GDM-69 restrictions, Kool-It E1 probes, control circuit troubleshooting, parts sourcing, superheat/subcool, plus every PM checklist and your real rate book.\n\nRun it — make, model, what it's doing.`);
    el.input.focus();
  }

  return { mount, send };
})();

/* ── splash → real Firebase sign-in gate → app ───── */
(function () {
  const s = document.getElementById('splash');

  function enterApp() {
    go('dash');
    if (!Store.persistent) {
      setTimeout(() => toast('Private/incognito mode — data resets on reload. Persists once deployed.'), 900);
    }
    if (!s) return;
    s.classList.add('gone');
    setTimeout(() => s.remove(), 600);
  }

  function showSignIn(msg) {
    if (!s) { enterApp(); return; }
    s.innerHTML = `
      <img class="bro" src="/bro-full.jpg" alt="Chill Bro">
      <div class="cap icy-title" style="font-size:26px">CHILL PROS</div>
      <div class="cap" style="font-size:11px;margin-top:-10px">COMMAND CENTER</div>
      <div class="signin-form">
        ${msg ? `<div class="signin-msg">${esc(msg)}</div>` : ''}
        <input class="inp" id="signinEmail" type="email" placeholder="Email" autocomplete="username">
        <input class="inp" id="signinPass" type="password" placeholder="Password" autocomplete="current-password">
        <button class="btn pri" id="signinBtn">Sign in</button>
        <div class="muted" style="font-size:11.5px;text-align:center">Ask your owner to add your login if you don't have one yet.</div>
      </div>`;
    const emailInput = document.getElementById('signinEmail');
    const passInput = document.getElementById('signinPass');
    const btn = document.getElementById('signinBtn');
    const submit = () => {
      const email = emailInput.value.trim(), pass = passInput.value;
      if (!email || !pass) { (email ? passInput : emailInput).focus(); return; }
      btn.disabled = true; btn.textContent = 'Signing in…';
      Auth.signIn(email, pass).catch(err => {
        btn.disabled = false; btn.textContent = 'Sign in';
        const friendly = /invalid|wrong|password|credential/i.test(err.code || err.message)
          ? 'Wrong email or password' : (err.message || 'Could not sign in');
        showSignIn(friendly);
      });
      // success is handled by Auth.onChange below — no need to call enterApp() here
    };
    btn.addEventListener('click', submit);
    passInput.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    setTimeout(() => emailInput.focus(), 300);
  }

  const minShow = new Promise(r => setTimeout(r, 1100));
  const loaded = document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise(r => window.addEventListener('load', r, { once: true }));

  /* Sign-in is not required to open the app right now — it opens     */
  /* straight to the dashboard regardless. Real Firebase sign-in is    */
  /* still fully wired and stays available from Settings for whenever  */
  /* an account has been created in the Firebase console and it's      */
  /* ready to be turned into an actual gate.                           */
  Promise.all([minShow, loaded]).then(enterApp);

  if (fbReady) Auth.onChange(() => {}); // keeps roster/admin state current in the background
})();
