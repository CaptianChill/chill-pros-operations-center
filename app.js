/* Chill Pros Operations Center v5
   Single-file vanilla app. No framework, no build step, no proxy.
   Deploy: drop index.html + app.js + knowledge.js on any static host. */
'use strict';

/* ═══ 1. STORAGE ════════════════════════════════════════════════
   Tries localStorage; falls back to memory if the host blocks it
   (sandboxed preview, private mode). Never throws, never blocks. */
const Store = (() => {
  const KEY = 'chillpros.ops.v5';
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

/* ═══ 2. RATE BOOK ══════════════════════════════════════════════
   Median unit prices recovered from 267 Jobber invoices (168 field jobs). */
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

/* ═══ 3. CARE PLANS — CP-MA-000 master pricing ═════════════════ */
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
  // One Stop Shop bundle discount by total system count
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
  techs: ['Unassigned', 'Chill', 'Tech 2'], seq: { job: 1000, quote: 500 }
};

let S = Store.load() || structuredClone(BLANK);
const save = () => Store.save(S);
const uid = () => Math.random().toString(36).slice(2, 10);
const money = n => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const today = () => new Date().toISOString().slice(0, 10);
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

/* ═══ 7. NAV ═══════════════════════════════════════════════════ */
const ICONS = {
  board: '<path d="M4 5h5v14H4zM10 5h5v9h-5zM16 5h4v6h-4z"/>',
  call: '<path d="M12 5v14M5 12h14"/>',
  cust: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M16 11a3 3 0 100-6M18 20a6 6 0 00-3-5.2"/>',
  quote: '<path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5"/>',
  plan: '<path d="M12 3l2.3 5.6 6 .5-4.6 4 1.4 5.9L12 15.9 6.9 19l1.4-5.9-4.6-4 6-.5z"/>',
  pm: '<path d="M9 11l2 2 4-4"/><path d="M5 4h14v16H5z"/>'
};
const VIEWS = [
  { k: 'board', l: 'Dispatch', t: 'Dispatch', s: 'Every call, from ring to paid' },
  { k: 'call', l: 'New call', t: 'Take a call', s: 'Sixty seconds from ring to dispatched' },
  { k: 'cust', l: 'Customers', t: 'Customers', s: 'Sites, contacts and history' },
  { k: 'quote', l: 'Quotes', t: 'Quotes & invoices', s: 'Priced off your real invoice history' },
  { k: 'plan', l: 'Care plans', t: 'Care plans', s: 'CP-MA-000 master pricing' },
  { k: 'pm', l: 'PM', t: 'Preventive maintenance', s: 'Run a checklist, capture the readings' }
];

let route = 'board';

function renderRail() {
  const r = $('#rail');
  r.innerHTML = `<div class="mark">
      <svg viewBox="0 0 24 24" fill="none" stroke="#7FD4F5" stroke-width="1.6" stroke-linecap="round">
        <path d="M12 2v20M12 12l7-4M12 12l-7-4M12 12l7 4M12 12l-7 4"/>
        <path d="M12 2l-2.6 2.6M12 2l2.6 2.6M12 22l-2.6-2.6M12 22l2.6-2.6"/>
      </svg></div>`
    + VIEWS.map(v => `<button class="navbtn" data-go="${v.k}" ${route === v.k ? 'aria-current="page"' : ''}>
        <svg viewBox="0 0 24 24">${ICONS[v.k]}</svg><span>${v.l}</span></button>`).join('')
    + '<div class="rail-sp"></div>';
}

function go(k) {
  route = k;
  const v = VIEWS.find(x => x.k === k);
  $('#vTitle').textContent = v.t;
  $('#vSub').textContent = v.s;
  renderRail();
  $('#view').scrollTop = 0;
  RENDER[k]();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b) { e.preventDefault(); go(b.dataset.go); }
});

/* ═══ 8. VIEWS ═════════════════════════════════════════════════ */
const RENDER = {};

/* ── Dispatch board ── */
RENDER.board = () => {
  $('#topAct').innerHTML = `<button class="btn pri" data-go="call">+ New call</button>`;
  const open = S.jobs.filter(j => j.stage !== 'complete').length;
  $('#vSub').textContent = open ? `${open} open · ${S.jobs.length} total` : 'Every call, from ring to paid';

  if (!S.jobs.length) {
    $('#view').innerHTML = `<div class="empty"><b>No calls on the board</b>
      Take the next one that rings and it lands here.
      <div style="margin-top:16px"><button class="btn pri" data-go="call">Take a call</button></div></div>`;
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
    save(); go('board'); toast(j.stage === 'complete' ? 'Job complete' : 'Job updated');
  }
  const op = e.target.closest('[data-openjob]');
  if (op) openJob(op.dataset.openjob);
  const ak = e.target.closest('[data-ask]');
  if (ak) {
    const j = S.jobs.find(x => x.id === ak.dataset.ask);
    Bro.open();
    Bro.ask(`${j.trade} — ${j.problem}${j.equipment ? ' on a ' + j.equipment : ''}`);
  }
});

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
      { label: 'Delete', run: (s, c) => { S.jobs = S.jobs.filter(x => x.id !== id); save(); c(); go('board'); toast('Job deleted'); } },
      { label: 'Quote this job', run: (s, c) => { c(); quoteFromJob(j); } },
      {
        label: 'Save', pri: true, run: (s, c) => {
          j.problem = s.querySelector('#jp').value.trim() || j.problem;
          j.equipment = s.querySelector('#je').value.trim();
          j.tech = s.querySelector('#jt').value;
          j.stage = s.querySelector('#js').value;
          j.priority = +s.querySelector('#jr').value;
          j.notes = s.querySelector('#jn').value;
          save(); c(); go('board'); toast('Job saved');
        }
      }
    ]
  });
}

/* ── New call intake ── */
RENDER.call = () => {
  $('#topAct').innerHTML = '';
  $('#view').innerHTML = `<div class="card" style="max-width:640px">
    <div class="row2">
      <div class="field"><label>Customer</label>
        <input class="inp" id="nCust" list="custList" placeholder="Name or business" autofocus>
        <datalist id="custList">${S.customers.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist></div>
      <div class="field"><label>Site / store</label><input class="inp" id="nSite" placeholder="Location or store #"></div>
    </div>
    <div class="row2">
      <div class="field"><label>Callback number</label><input class="inp" id="nPhone" type="tel" placeholder="(210) 555-0100"></div>
      <div class="field"><label>Equipment</label><input class="inp" id="nEquip" placeholder="True GDM-69, RTU #3…"></div>
    </div>
    <div class="field"><label>What's it doing?</label>
      <textarea class="inp" id="nProb" placeholder="Walk-in cooler at 52°F, compressor running constantly"></textarea></div>
    <div class="row3">
      <div class="field"><label>Trade</label><select class="inp" id="nTrade">${TRADES.map(t => `<option>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Priority</label><select class="inp" id="nPri">
        <option value="2" selected>Same day</option><option value="1">Emergency</option><option value="3">Scheduled</option></select></div>
      <div class="field"><label>Tech</label><select class="inp" id="nTech">${S.techs.map(t => `<option>${t}</option>`).join('')}</select></div>
    </div>
    <div style="display:flex;gap:9px;margin-top:6px;flex-wrap:wrap">
      <button class="btn pri" id="nSave">Put it on the board</button>
      <button class="btn" id="nSaveAsk">Save &amp; ask Chill Bro</button>
    </div>
  </div>`;

  const build = () => {
    const problem = $('#nProb').value.trim(), customer = $('#nCust').value.trim();
    if (!customer) { $('#nCust').focus(); toast('Customer name is required'); return null; }
    if (!problem) { $('#nProb').focus(); toast('Add what the unit is doing'); return null; }
    const j = {
      id: uid(), no: ++S.seq.job, customer, site: $('#nSite').value.trim(),
      phone: $('#nPhone').value.trim(), equipment: $('#nEquip').value.trim(),
      problem, trade: $('#nTrade').value, priority: +$('#nPri').value,
      tech: $('#nTech').value, stage: 'new', notes: '', createdAt: today()
    };
    S.jobs.unshift(j);
    if (!S.customers.some(c => c.name.toLowerCase() === customer.toLowerCase()))
      S.customers.push({ id: uid(), name: customer, site: j.site, city: '', phone: j.phone, email: '', notes: '' });
    save();
    return j;
  };
  $('#nSave').onclick = () => { const j = build(); if (j) { go('board'); toast(`Job #${j.no} on the board`); } };
  $('#nSaveAsk').onclick = () => {
    const j = build(); if (!j) return;
    go('board'); Bro.open(); Bro.ask(`${j.trade} — ${j.problem}${j.equipment ? ' on a ' + j.equipment : ''}`);
  };
};

/* ── Customers ── */
RENDER.cust = () => {
  $('#topAct').innerHTML = `<button class="btn pri" id="addCust">+ Add customer</button>`;
  $('#addCust').onclick = () => editCustomer(null);
  const list = [...S.customers].sort((a, b) => a.name.localeCompare(b.name));
  $('#view').innerHTML = `<div class="rows">${list.map(c => {
    const n = S.jobs.filter(j => j.customer.toLowerCase() === c.name.toLowerCase()).length;
    return `<div class="rw"><div class="g"><strong>${esc(c.name)}</strong>
      <small>${esc([c.site, c.city, c.phone].filter(Boolean).join(' · ') || 'No contact details yet')}</small></div>
      <span class="muted">${n} job${n === 1 ? '' : 's'}</span>
      <button class="btn sm gho" data-editc="${c.id}">Edit</button></div>`;
  }).join('')}</div>`;
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
      ...(id ? [{ label: 'Delete', run: (s, cl) => { S.customers = S.customers.filter(x => x.id !== id); save(); cl(); go('cust'); } }] : []),
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
          save(); cl(); go('cust'); toast('Customer saved');
        }
      }
    ]
  });
}

/* ── Quotes & invoices ── */
let draft = null;

function newDraft(seed = {}) {
  return {
    id: uid(), no: ++S.seq.quote, date: today(), status: 'Draft',
    customer: '', site: '', email: '', jobRef: '', scope: '',
    items: [], taxRate: 8.25, ...seed
  };
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
        Start one from scratch, or open a job and hit “Quote this job”.
        <div style="margin-top:16px"><button class="btn pri" id="emptyQ">New quote</button></div></div>`;
      $('#emptyQ').onclick = () => { draft = newDraft(); RENDER.quote(); };
      return;
    }
    $('#view').innerHTML = `<div class="rows">${S.quotes.map(q => {
      const t = qTotals(q);
      return `<div class="rw"><div class="g"><strong>#${q.no} · ${esc(q.customer || 'Unnamed')}</strong>
        <small>${esc(q.date)} · ${esc(q.status)}${q.jobRef ? ' · job ' + esc(q.jobRef) : ''}</small></div>
        <span class="amt">${money(t.total)}</span>
        <button class="btn sm gho" data-editq="${q.id}">Open</button></div>`;
    }).join('')}</div>`;
    return;
  }

  const t = qTotals(draft);
  $('#view').innerHTML = `<div class="grid" style="grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr)">
    <div class="card">
      <div class="row2">
        <div class="field"><label>Customer</label><input class="inp" id="qc" list="custList2" value="${esc(draft.customer)}">
          <datalist id="custList2">${S.customers.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist></div>
        <div class="field"><label>Email</label><input class="inp" id="qe" type="email" value="${esc(draft.email)}"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Site</label><input class="inp" id="qs" value="${esc(draft.site)}"></div>
        <div class="field"><label>Job reference</label><input class="inp" id="qj" value="${esc(draft.jobRef)}"></div>
      </div>
      <div class="field"><label>Scope of work</label><textarea class="inp" id="qsc">${esc(draft.scope)}</textarea></div>

      <div style="display:flex;align-items:center;gap:9px;margin:16px 0 9px">
        <strong style="font-size:13.5px">Line items</strong><div style="flex:1"></div>
        <select class="inp" id="qpick" style="width:auto;max-width:230px;font-size:12.5px;padding:6px 9px">
          <option value="">Add from rate book…</option>
          ${['Labor','PM','Refrigerant','Parts'].map(c =>
            `<optgroup label="${c}">${RATES.filter(r => r.c === c).map((r, i) =>
              `<option value="${RATES.indexOf(r)}">${esc(r.n)}${r.p ? ' — ' + money(r.p) : ''}</option>`).join('')}</optgroup>`).join('')}
        </select>
      </div>
      <table class="tbl"><thead><tr><th>Item</th><th style="width:58px">Qty</th><th style="width:96px">Price</th><th style="width:46px">Tax</th><th style="width:88px" class="n">Amount</th><th style="width:30px"></th></tr></thead>
      <tbody>${draft.items.map(i => `<tr>
        <td><input class="inp" style="padding:5px 8px;font-size:13px" value="${esc(i.n)}" data-li="${i.id}" data-f="n"></td>
        <td><input class="inp" style="padding:5px 6px;font-size:13px" type="number" min="0" step="0.5" value="${i.qty}" data-li="${i.id}" data-f="qty"></td>
        <td><input class="inp" style="padding:5px 6px;font-size:13px" type="number" min="0" step="0.01" value="${i.price}" data-li="${i.id}" data-f="price"></td>
        <td style="text-align:center"><input type="checkbox" ${i.tax ? 'checked' : ''} data-li="${i.id}" data-f="tax" style="accent-color:#38A9DC;width:16px;height:16px"></td>
        <td class="n">${money(i.qty * i.price)}</td>
        <td><button class="x" style="width:24px;height:24px;font-size:16px" data-del="${i.id}">&times;</button></td></tr>`).join('')
        || '<tr><td colspan="6" class="muted" style="padding:14px 10px">No line items. Pick one from the rate book above.</td></tr>'}</tbody></table>
      <button class="btn sm gho" id="qadd" style="margin-top:9px">+ Blank line</button>
    </div>

    <div class="card" style="align-self:start">
      <div style="display:flex;justify-content:space-between;margin-bottom:7px"><span class="muted">Subtotal</span><span class="amt">${money(t.sub)}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
        <span class="muted">Tax <input class="inp" id="qtax" type="number" step="0.01" value="${draft.taxRate}" style="width:64px;padding:3px 6px;font-size:12px;display:inline-block">%</span>
        <span class="amt">${money(t.tax)}</span></div>
      <div style="display:flex;justify-content:space-between;padding-top:11px;border-top:1px solid var(--line-hot);margin-top:4px">
        <strong>Total</strong><span class="amt" style="font-size:20px;color:var(--ice)">${money(t.total)}</span></div>
      <div style="display:grid;gap:8px;margin-top:18px">
        <button class="btn pri" id="qsave">Save quote</button>
        <button class="btn" id="qinv">Convert to invoice</button>
        <button class="btn gho" id="qprint">Print / save as PDF</button>
        <button class="btn gho" id="qcancel">Close without saving</button>
      </div>
      <div class="muted" style="margin-top:14px;font-size:12px">Status: ${esc(draft.status)}${Store.persistent ? '' : ' · storage unavailable in preview'}</div>
    </div></div>`;

  const sync = syncQuoteFields;
  $('#qpick').onchange = e => {
    const r = RATES[+e.target.value]; if (!r) return;
    sync(); draft.items.push({ id: uid(), n: r.n, qty: 1, price: r.p, tax: r.c === 'Parts' || r.c === 'Refrigerant' });
    RENDER.quote();
  };
  $('#qadd').onclick = () => { sync(); draft.items.push({ id: uid(), n: '', qty: 1, price: 0, tax: false }); RENDER.quote(); };
  $('#qtax').onchange = () => { sync(); RENDER.quote(); };
  $('#qsave').onclick = () => {
    sync();
    if (!draft.customer.trim()) return toast('Add a customer name');
    const i = S.quotes.findIndex(q => q.id === draft.id);
    i >= 0 ? S.quotes[i] = draft : S.quotes.unshift(draft);
    save(); toast(`Quote #${draft.no} saved`); draft = null; RENDER.quote();
  };
  $('#qinv').onclick = () => {
    sync();
    if (!draft.items.length) return toast('Add at least one line item');
    draft.status = 'Invoice'; draft.invoicedAt = today();
    const i = S.quotes.findIndex(q => q.id === draft.id);
    i >= 0 ? S.quotes[i] = draft : S.quotes.unshift(draft);
    save(); toast(`Invoice #${draft.no} created`); RENDER.quote();
  };
  $('#qprint').onclick = () => { sync(); printDoc(draft); };
  $('#qcancel').onclick = () => { draft = null; RENDER.quote(); };
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-editq]');
  if (b) { draft = S.quotes.find(q => q.id === b.dataset.editq); go('quote'); }
});

function printDoc(q) {
  const t = qTotals(q);
  const w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups to print');
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${q.status} ${q.no}</title>
  <style>body{font:14px/1.5 system-ui,sans-serif;color:#111;max-width:740px;margin:40px auto;padding:0 22px}
  h1{font-size:22px;margin:0}header{display:flex;justify-content:space-between;align-items:flex-start;
  border-bottom:2px solid #38A9DC;padding-bottom:14px;margin-bottom:22px}
  .sub{color:#38A9DC;font-weight:600;font-size:12px;letter-spacing:.08em}
  table{width:100%;border-collapse:collapse;margin-top:18px}th{text-align:left;font-size:11px;color:#666;
  border-bottom:1px solid #ccc;padding:7px 6px}td{padding:8px 6px;border-bottom:1px solid #eee}
  .n{text-align:right}.tot{font-size:19px;font-weight:700}.sc{background:#f5f9fc;padding:12px;border-radius:7px;white-space:pre-wrap}
  @media print{body{margin:0}}</style>
  <header><div><h1>CHILL PROS</h1><div class="sub">HVAC · REFRIGERATION · ICE · COMMERCIAL KITCHEN</div>
  <div style="color:#666;font-size:12px;margin-top:5px">San Antonio, Texas</div></div>
  <div style="text-align:right"><div style="font-size:17px;font-weight:700">${q.status === 'Invoice' ? 'Invoice' : 'Quote'} #${q.no}</div>
  <div style="color:#666;font-size:12px">${q.date}</div></div></header>
  <div style="display:flex;gap:36px;margin-bottom:16px"><div><div style="font-size:11px;color:#666">Bill to</div>
  <strong>${esc(q.customer)}</strong><br>${esc(q.site || '')}<br>${esc(q.email || '')}</div>
  ${q.jobRef ? `<div><div style="font-size:11px;color:#666">Job</div><strong>${esc(q.jobRef)}</strong></div>` : ''}</div>
  ${q.scope ? `<div class="sc">${esc(q.scope)}</div>` : ''}
  <table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit</th><th class="n">Amount</th></tr></thead><tbody>
  ${q.items.map(i => `<tr><td>${esc(i.n)}</td><td class="n">${i.qty}</td><td class="n">${money(i.price)}</td><td class="n">${money(i.qty * i.price)}</td></tr>`).join('')}
  </tbody></table>
  <div style="margin-top:18px;margin-left:auto;width:250px">
  <div style="display:flex;justify-content:space-between;padding:5px 0"><span>Subtotal</span><span>${money(t.sub)}</span></div>
  <div style="display:flex;justify-content:space-between;padding:5px 0"><span>Tax (${q.taxRate}%)</span><span>${money(t.tax)}</span></div>
  <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #38A9DC" class="tot"><span>Total</span><span>${money(t.total)}</span></div></div>
  <p style="color:#888;font-size:11px;margin-top:34px">Pricing subject to site verification. Model- and serial-dependent parts confirmed against installed equipment before ordering.</p>`);
  w.document.close(); setTimeout(() => w.print(), 260);
}

/* ── Care plans ── */
let planState = { tier: 'Gold', qty: {} };
RENDER.plan = () => {
  $('#topAct').innerHTML = '';
  const rows = PLANS.assets.map(a => {
    const q = planState.qty[a[2]] || 0;
    const price = { Silver: a[3], Gold: a[4], Diamond: a[5] }[planState.tier];
    return { cat: a[0], name: a[1], code: a[2], q, price, line: q * price };
  });
  const units = rows.reduce((s, r) => s + r.q, 0);
  const gross = rows.reduce((s, r) => s + r.line, 0);
  const disc = PLANS.discount(units);
  const net = gross * (1 - disc);

  $('#view').innerHTML = `<div class="grid" style="grid-template-columns:minmax(0,1.3fr) minmax(0,.7fr)">
    <div class="card">
      <div style="display:flex;gap:8px;margin-bottom:16px">${Object.keys(PLANS.tiers).map(t =>
        `<button class="btn ${planState.tier === t ? 'pri' : ''}" data-tier="${t}" style="flex:1">
          ${t}<br><span style="font-size:11px;font-weight:500;opacity:.8">${PLANS.tiers[t].label}</span></button>`).join('')}</div>
      ${['HVAC','Refrigeration','Ice Machine','Kitchen'].map(cat => `
        <div style="margin-bottom:15px"><div class="muted" style="font-weight:700;margin-bottom:6px">${cat}</div>
        ${rows.filter(r => r.cat === cat).map(r => `<div style="display:flex;align-items:center;gap:10px;padding:5px 0">
          <span style="flex:1;font-size:13.5px">${esc(r.name)}</span>
          <span class="muted" style="font-size:12px;width:64px;text-align:right">${money(r.price)}/mo</span>
          <input class="inp" type="number" min="0" value="${r.q}" data-qty="${r.code}" style="width:62px;padding:5px 7px;font-size:13px">
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
};

/* ── PM checklists ── */
let currentPM = null;
RENDER.pm = () => {
  $('#topAct').innerHTML = `<button class="btn pri" id="newPm">+ Start checklist</button>`;
  $('#newPm').onclick = () => startPM();
  if (!S.pms.length) {
    $('#view').innerHTML = `<div class="empty"><b>No checklists running</b>
      Start one on site and it saves as you tick.
      <div style="margin-top:16px"><button class="btn pri" id="emptyPm">Start checklist</button></div></div>`;
    $('#emptyPm').onclick = startPM;
    return;
  }
  $('#view').innerHTML = `<div class="rows">${S.pms.map(p => {
    const done = p.items.filter(i => i.done).length;
    return `<div class="rw"><div class="g"><strong>${esc(p.customer)} · ${esc(p.type)}</strong>
      <small>${esc(p.date)}${p.equipment ? ' · ' + esc(p.equipment) : ''} — ${done}/${p.items.length} complete</small></div>
      <button class="btn sm gho" data-openpm="${p.id}">Open</button></div>`;
  }).join('')}</div>`;
};
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
        save(); c(); go('pm'); toast('Checklist started');
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
  $('#topAct').innerHTML = `<button class="btn gho" data-go="pm">← All checklists</button>`;
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
  $('#pmDel').onclick = () => { S.pms = S.pms.filter(x => x.id !== id); save(); go('pm'); };
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

/* ── delegated input/change handlers — bound exactly once ── */
document.addEventListener('input', e => {
  const li = e.target.closest('[data-li]');
  if (li && draft) {
    const it = draft.items.find(x => x.id === li.dataset.li); if (!it) return;
    const f = li.dataset.f;
    it[f] = f === 'tax' ? li.checked : f === 'n' ? li.value : (parseFloat(li.value) || 0);
    if (f !== 'n') { syncQuoteFields(); RENDER.quote(); }
  }
});
document.addEventListener('change', e => {
  const q = e.target.closest('[data-qty]');
  if (q) { planState.qty[q.dataset.qty] = Math.max(0, parseInt(q.value) || 0); RENDER.plan(); return; }
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
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tier]');
  if (t) { planState.tier = t.dataset.tier; RENDER.plan(); return; }
  const d = e.target.closest('[data-del]');
  if (d && draft) { syncQuoteFields(); draft.items = draft.items.filter(x => x.id !== d.dataset.del); RENDER.quote(); }
});

/* ═══ 9. CHILL BRO ══════════════════════════════════════════════
   Slide-out field copilot. Local knowledge base built from the
   Chill Pros Field Memory Bank — answers with zero network.
   If BRO_API is set, live model answers layer on top; if that call
   fails for any reason the local brain answers instead. */

const BRO_API = '';   // e.g. '/api/chill-bro' once you wire a backend

/* Original mascot art — cool-guy field tech, not a likeness of any real person */
const BRO_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1B3A5C"/><stop offset="1" stop-color="#0B1730"/></linearGradient>
  <linearGradient id="cap" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7FD4F5"/><stop offset="1" stop-color="#2A87B4"/></linearGradient></defs>
  <rect width="64" height="64" fill="url(#bg)"/>
  <circle cx="32" cy="35" r="15" fill="#8D6247"/>
  <path d="M17 30a15 15 0 0130 0z" fill="url(#cap)"/>
  <path d="M15 30h20a4 4 0 01-4 4H17a2 2 0 01-2-2z" fill="#2A87B4"/>
  <rect x="20" y="32" width="10" height="7" rx="2.5" fill="#0A1626"/>
  <rect x="34" y="32" width="10" height="7" rx="2.5" fill="#0A1626"/>
  <path d="M30 35h4" stroke="#0A1626" stroke-width="2"/>
  <rect x="21" y="33" width="4" height="2" rx="1" fill="#7FD4F5" opacity=".65"/>
  <rect x="35" y="33" width="4" height="2" rx="1" fill="#7FD4F5" opacity=".65"/>
  <path d="M27 44q5 3.5 10 0" stroke="#F2D9C8" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M18 52a14 14 0 0128 0z" fill="#16304E"/>
  <path d="M28 50h8v4h-8z" fill="#E9F4FB" opacity=".9"/>
</svg>`;

const KB = [
  { id:'gdm69', k:['gdm','gdm-69','true','restriction','cap tube','capillary','drier','filter drier','near vacuum','suction vacuum','134a','box warm','not cooling reach in'],
    title:'True GDM-69 — warm box, suction near vacuum',
    body:`R-134a reach-in. Box climbing toward 50°F with suction pulled near vacuum is a <b>sealed-system restriction</b> until proven otherwise — filter drier and capillary tube are the top two suspects.

Work it in this order:
1. Record suction and head pressure together, not suction alone.
2. Compressor amp draw vs nameplate RLA. A restricted system usually runs <b>low</b> amps.
3. Feel for a temperature drop across the drier. A cold or sweating drier outlet is your restriction.
4. Read the evaporator frost pattern — partial frost that dies part-way down the coil says starved.

OEM references on file for this model: capillary tube <code>851142</code>, filter drier <code>800806</code>. Verify against the data plate before you order.`,
    src:'Chill Pros field case — True GDM-69' },

  { id:'e1', k:['e1','kool-it','kgm','kgm-75','error code e1','probe','thermistor','display cooler','sensor fault','alarm'],
    title:'Kool-It KGM-75 — E1 alarm',
    body:`E1 on this box points at the <b>temperature probe circuit</b> before it points at refrigeration. On the case in your file, the probe was physically cut.

Ranked, evidence-first:
1. Inspect the probe and its full wire run — pinches, rodent damage, cuts at the pass-through.
2. Ohm the probe and compare to the OEM temp/resistance chart at a known box temp.
3. Wiring and connectors at the controller.
4. Controller itself.
5. Refrigeration last — only after the sensing circuit is proven good.

Diagnostic trick from the case: a 10 kΩ resistor across the probe terminals confirms whether the controller is happy with a valid signal. <b>That is a test only.</b> The fix is an OEM probe, then confirm the alarm clears and the box pulls down.`,
    src:'Chill Pros field case — Kool-It KGM-75' },

  { id:'goodman', k:['goodman','gsx140','after compressor','compressor replacement','410a','high suction','suction 300','pressure differential','no differential','head 350','low amps'],
    title:'Goodman GSX140301KC — suction ~300 / head ~350 after a compressor swap',
    body:`R-410A, ~90°F ambient, compressor RLA 12.8 A / LRA 64 A, recorded amps 5.3–7.4 A. Unit was still cooling and <b>not</b> over-amping.

A ~50 psi split with low amps means the compressor is not pumping the way it should — but before you condemn a brand-new compressor, clear these:
1. Gauges and hoses. Swap in a second set. A stuck or cross-ported manifold has faked this exact reading more than once.
2. Service valves — fully back-seated? A partly closed liquid valve moves both numbers.
3. Charge. Weigh it in; don't chase pressures.
4. Compressor application — right compressor for the refrigerant and the tonnage? A mis-picked replacement pumps like this all day.
5. Metering device. TXV bulb contact or a piston that got swapped.

Verify all five before changing another component or adding charge.`,
    src:'Chill Pros field case — Goodman GSX140301KC' },

  { id:'overvolt', k:['200v','overvoltage','24v','low voltage','transformer','blew transformer','pf1mnc','payne','carrier','fried board','high voltage on low voltage','line voltage on control'],
    title:'Line voltage dumped onto the 24 V circuit',
    body:`Payne/Carrier PF1MNC036 case: roughly 200 V hit a nominal 24 V circuit. High-confidence casualties were the <b>indoor fan/blower control board</b> and the <b>24 V transformer</b>.

Controlled recovery — do not just swap parts and power it up:
1. Isolate every low-voltage branch at the board. Thermostat, condenser, safeties, accessories — all landed loose.
2. Install the replacement transformer and power it <b>unloaded</b>. You want 24–28 VAC.
3. Reconnect one branch at a time. After each one: check voltage, check current, check the fuse.
4. The branch that drops voltage or pops the fuse is your fault. Find it before you go further.

OEM examples on file: fan/blower control board <code>HK61EA006</code>, transformer <code>HT01CN241</code>. Other affected parts are model- and configuration-dependent.`,
    src:'Chill Pros field case — Payne/Carrier PF1MNC036' },

  { id:'dmw', k:['dmw','r400','frozen beverage','barrel','beater','slush','icee','margarita machine','intermittent','solenoid','404a','one side not freezing'],
    title:'DMW R400 — one barrel intermittently won\'t freeze',
    body:`Serial 25204, R-404A. Right barrel dropping out while the left ran fine. Beater current told the story: left 0.92 A with thick product, right 0.10 A with liquid.

Found defect: a <b>broken terminal connector at the right refrigerant solenoid coil</b>, with product residue around it. Unreliable continuity at that terminal explained the intermittent loss of refrigeration completely.

When you get an intermittent on one barrel, check the electrical connection at the solenoid coil before you touch the charge. Wiggle-test it energized with a meter on the coil. Final solenoid part number is model/serial/coil-label dependent — read the coil label.`,
    src:'Chill Pros field case — DMW R400 #25204' },

  { id:'steamer', k:['steamer','sterling','spg6','door gasket','steam leak','ignition','gas lighting','wo 2834','burn hazard','water level'],
    title:'Sterling SPG6-AF steamer — gasket leak + ignition',
    body:`Work order #2834, school kitchen. Complaint was excessive door-gasket steam leak flagged as a burn hazard, plus a gas-lighting problem.

Manufacturer direction: replace the inner door assembly / lower gasket, then troubleshoot ignition separately.

Parts evidence captured on that work order: ignition control, ignitor assembly, water-level controller, probe, and DP main contactor. On a school site treat the burn hazard as the priority line item and document it — that's what gets the PO approved fast.`,
    src:'Chill Pros work order #2834' },

  { id:'control', k:['contactor','not pulling in','no call','y to c','24v at contactor','pressure switch','safety','open switch','condenser won\'t start','won\'t kick on','control circuit'],
    title:'Control circuit — condenser won\'t pull in',
    body:`Standard Chill Pros method, in order:
1. Confirm the thermostat is actually calling. Measure <b>Y to C at the condenser</b>, not at the stat.
2. Measure directly across the contactor coil, <b>A1 to A2</b>. Voltage there and no pull-in means the coil is dead.
3. No voltage at the coil? Measure <b>across</b> each pressure switch and safety in the string. The one reading full voltage across it is the open device.
4. Never leave a pressure switch bypassed. Confirm the actual pressure condition before you condemn the switch — an open low-pressure switch is usually telling the truth about the charge.
5. Record the readings and shoot photos of the wiring and controls for the case file.`,
    src:'Chill Pros control-circuit standard' },

  { id:'pm', k:['pm','preventive','preventative','maintenance','checklist','scheduled maintenance','tune up','service agreement'],
    title:'Preventive maintenance program',
    body:`Your PM library covers HVAC, refrigeration, ice, and cooking equipment. The HVAC form runs: filters, coils, blower/motor/wiring and airflow, condensate drains and float switches, contactors/relays/boards/transformers/capacitors, line and control voltage and amperage, condenser cleaning and fan operation, refrigerant line condition and pressures, superheat/subcooling where conditions allow, heating and thermostat and safety operation, then a final full-cycle verification.

Open the <b>PM tab</b> and I'll run the live checklist with you — it saves readings as you tick, and turns findings straight into a quote.`,
    src:'Chill Pros PM library' },

  { id:'parts', k:['part number','parts','order','supplier','sourcing','cross reference','supersede','where to buy','partstown','true parts','oem'],
    title:'Parts sourcing',
    body:`Sourcing order that's worked for you:
1. Data plate first — model <b>and</b> serial. Serial splits the build variant on True, Manitowoc and Goodman constantly.
2. OEM parts catalog for that serial range.
3. OEM distributor cross-reference for supersessions.
4. Parts Town / SupplyHouse / Johnstone for stock and lead time.
5. Call OEM tech support before ordering anything expensive on a guess.

On file you have the True Refrigeration OEM sourcing guide and the general Chill Pros parts sourcing reference. Never order a model-dependent part off a photo alone — verify against the installed equipment.`,
    src:'CP_PS_001 True Refrigeration OEM parts sourcing guide' },

  { id:'super', k:['superheat','subcool','subcooling','charge','charging','txv','piston','how much charge','undercharged','overcharged'],
    title:'Superheat and subcooling',
    body:`Quick read on what the numbers mean:
• <b>Low superheat / high subcooling</b> → overcharge, or a metering device feeding too much.
• <b>High superheat / low subcooling</b> → undercharge, or a restriction. A restriction usually shows a temperature drop across the drier; an undercharge doesn't.
• <b>High superheat / high subcooling</b> → restriction between the condenser outlet and the metering device.
• <b>Low superheat / low subcooling</b> → compressor not pumping.

On a fixed-orifice system charge by superheat. On a TXV charge by subcooling, usually 10–12°F unless the plate says otherwise. Weigh in on any system you opened.`,
    src:'Chill Pros field method' }
];

const Bro = (() => {
  const el = {}; let msgs = [], busy = false, bound = false;

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

  /* ── local brain ── */
  function score(q, entry) {
    const t = q.toLowerCase();
    let s = 0;
    for (const kw of entry.k) if (t.includes(kw)) s += kw.length > 6 ? 3 : 2;
    return s;
  }

  function localAnswer(q) {
    const t = q.toLowerCase();

    // pricing intent
    if (/\b(charge|price|quote|cost|bill|how much|rate)\b/.test(t)) {
      const hits = RATES.filter(r => r.p && t.split(/\W+/).some(w => w.length > 3 && r.n.toLowerCase().includes(w)));
      const show = (hits.length ? hits : RATES.filter(r => r.c === 'Labor')).slice(0, 7);
      return { html: `Here's what you've actually been billing, straight off your invoice history:\n\n`
        + show.map(r => `• <b>${esc(r.n)}</b> — ${money(r.p)}`).join('\n')
        + `\n\nTypical service call lands at trip charge + first hour = <b>${money(170)}</b> before parts. Open the <b>Quotes</b> tab and pick these off the rate book — the math and the printable invoice are already wired.`,
        src: 'Median unit pricing from 267 Chill Pros invoices' };
    }
    // checklist intent
    if (/\b(checklist|pm |preventive|preventative|maintenance)\b/.test(t)) {
      const type = /refrig|cooler|freezer|walk/.test(t) ? 'Refrigeration'
        : /ice|cube|nugget|flaker/.test(t) ? 'Ice Machine'
        : /fry|oven|griddle|steam|dish|kitchen/.test(t) ? 'Kitchen' : 'HVAC';
      return { html: `${type} PM, the order that keeps you off a callback:\n\n`
        + CHECKLISTS[type].map((c, i) => `${i + 1}. <b>${esc(c[0])}</b> — ${esc(c[1])}`).join('\n')
        + `\n\nHit <b>PM → Start checklist</b> and pick ${type}. It saves your readings as you tick and rolls findings into a quote when you're done.`,
        src: 'Chill Pros PM library' };
    }
    // knowledge base
    const ranked = KB.map(e => ({ e, s: score(q, e) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
    if (ranked.length) {
      const top = ranked[0].e;
      const also = ranked.slice(1, 3).map(x => x.e.title);
      return { html: `<b>${esc(top.title)}</b>\n\n${top.body}`
        + (also.length ? `\n\nAlso close in your files: ${also.map(esc).join(' · ')}` : ''),
        src: top.src };
    }
    // fallback
    return { html: `I don't have that one in the memory bank yet, so let's not guess on it.

Give me any of these and I'll get sharper: <b>make and model</b>, <b>refrigerant</b>, <b>what the pressures and amps read</b>, and <b>what changed right before it broke</b>.

What I've got loaded right now: ${KB.map(k => k.title.split('—')[0].trim()).join(' · ')}, plus your full PM checklists and your real rate book.`,
      src: null };
  }

  /* ── optional live model, local brain always backs it up ── */
  async function answer(q) {
    if (!BRO_API) return localAnswer(q);
    try {
      const ctl = new AbortController();
      const kill = setTimeout(() => ctl.abort(), 20000);   // never hangs the UI
      const r = await fetch(BRO_API, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        signal: ctl.signal,
        body: JSON.stringify({ question: q, history: msgs.slice(-8) })
      });
      clearTimeout(kill);
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      if (!d?.answer) throw new Error('empty');
      return { html: esc(d.answer), src: d.source || null };
    } catch {
      const local = localAnswer(q);
      local.src = (local.src ? local.src + ' · ' : '') + 'answered offline';
      return local;
    }
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
    const a = await answer(q);
    dots.remove();
    bubble('bro', a.html + (a.src ? `<span class="src">${esc(a.src)}</span>` : ''));
    msgs.push({ role: 'assistant', content: a.html });
    el.status.textContent = BRO_API ? 'Ready' : 'Field brain loaded · works offline';
    busy = false; el.send.disabled = false;
    el.input.focus();
  }

  function init() {
    if (bound) return;
    bound = true;
    el.panel = $('#bro'); el.thread = $('#broThread'); el.input = $('#broInput');
    el.send = $('#broSend'); el.status = $('#broStatus'); el.chips = $('#broChips');
    $('#broFace').innerHTML = BRO_SVG;
    $('#broTabFace').innerHTML = BRO_SVG;

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
      el.input.style.height = Math.min(el.input.scrollHeight, 110) + 'px';
    });

    $('#broTab').addEventListener('click', toggle);
    $('#broClose').addEventListener('click', close);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && el.panel.classList.contains('open')) close();
    });

    bubble('bro', `Yo. Chill Bro here — diagnostics, parts, PM, pricing, whatever you're standing in front of.

I've got your field cases loaded: True GDM-69 restrictions, Kool-It E1 probes, post-compressor pressure splits, the 200 V-on-24 V recovery, DMW barrel dropouts, the Sterling steamer, plus every PM checklist and your real rate book.

Tell me the make, the model, and what it's doing.`);
  }

  function open() { init(); el.panel.classList.add('open'); el.panel.setAttribute('aria-hidden', 'false'); setTimeout(() => el.input.focus(), 260); }
  function close() { el.panel.classList.remove('open'); el.panel.setAttribute('aria-hidden', 'true'); }
  function toggle() { init(); el.panel.classList.contains('open') ? close() : open(); }

  return { mount: init, open, close, toggle, ask: q => { open(); setTimeout(() => send(q), 340); } };
})();

/* ═══ 10. BOOT ═════════════════════════════════════════════════ */
Bro.mount();
go('board');
if (!Store.persistent) {
  setTimeout(() => toast('Preview mode — data resets on reload. Persists once deployed.'), 900);
}
