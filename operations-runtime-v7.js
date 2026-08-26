(() => {
'use strict';

const V0='https://chill-pros-operation-ceneter-v2.vercel.app';
const BILL='https://us-central1-chill-pros-ice-stream.cloudfunctions.net/nativeOpsApi';
const CACHE_KEY='chillPros:ops:records:v7';
const PENDING_KEY='chillPros:ops:pending:v7';
const IONOS_KEY='chillPros:ionos:v1';
const ACTIVE_STATUSES=new Set(['Scheduled','Dispatched','In Progress','Paused']);
const STATUS_OPTIONS=['Needs Review','Needs Quote','Scheduled','Dispatched','In Progress','Paused','Waiting on Parts','Ready to Invoice','Completed'];
const fbCfg={apiKey:'AIzaSyBsBEKMggwSUvEmdTTK1rjYOcdPyYCCLOc',authDomain:'chill-pros-ice-stream.firebaseapp.com',projectId:'chill-pros-ice-stream',storageBucket:'chill-pros-ice-stream.firebasestorage.app',messagingSenderId:'260000821827',appId:'1:260000821827:web:4d65bb9f17a29001eedaf6'};

let db=null;
let records=[];
let active='Dashboard';
let dataState='loading';
let lastDataError='';
let pending=[];

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const uid=()=>crypto.randomUUID?.()||`local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function readJson(key,fallback){try{const x=JSON.parse(localStorage.getItem(key)||'null');return x??fallback}catch{return fallback}}
function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function loadCachedRecords(){const value=readJson(CACHE_KEY,[]);return Array.isArray(value)?value:[]}
function cacheRecords(value){writeJson(CACHE_KEY,value)}
function loadPending(){const value=readJson(PENDING_KEY,[]);return Array.isArray(value)?value:[]}
function savePending(){writeJson(PENDING_KEY,pending)}
function toast(m){$('.runtime-toast')?.remove();const n=document.createElement('div');n.className='runtime-toast';n.textContent=m;Object.assign(n.style,{position:'fixed',right:'14px',bottom:'calc(170px + env(safe-area-inset-bottom,0px))',zIndex:100000,background:'#061827',border:'1px solid #35aaff88',color:'#dff6ff',padding:'11px 14px',borderRadius:'11px',boxShadow:'0 14px 40px #000b',maxWidth:'320px'});document.body.appendChild(n);setTimeout(()=>n.remove(),2600)}
function normalizeRecord(data={},firestoreId=''){return {...data,firestoreId:firestoreId||data.firestoreId||'',id:data.id||firestoreId||uid(),officeStatus:data.officeStatus||'Needs Review',assignedTechnician:data.assignedTechnician||'',scheduledDate:data.scheduledDate||'',scheduledTime:data.scheduledTime||'',createdAt:data.createdAt||new Date().toISOString()}}

function restoreIonosConfig(){const cfg=readJson(IONOS_KEY,null);if(cfg?.src&&cfg?.clientSecret)window.CHILL_PROS_IONOS_RECEPTIONIST=cfg}
restoreIonosConfig();

function initFirebase(){
  if(!window.firebase)return false;
  if(!firebase.apps.length)firebase.initializeApp(fbCfg);
  db=firebase.firestore();
  try{db.settings({experimentalAutoDetectLongPolling:true,useFetchStreams:false})}catch(e){console.info('Firestore transport already initialized',e?.message||'')}
  try{db.enablePersistence?.({synchronizeTabs:true}).catch(()=>{})}catch{}
  window.chillProsDb=db;
  return true;
}

async function secure(base,path,body={}){
  const u=firebase.auth().currentUser;
  if(!u)throw Error('Sign in to Chill Pros first.');
  const token=await u.getIdToken();
  const r=await fetch(base+path,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.error||'Request failed.');
  return d;
}

function dataStateMarkup(){
  const cls=dataState==='live'?'':dataState==='cached'?'cached':'offline';
  const label=dataState==='live'?'Live data':dataState==='cached'?'Cached data':dataState==='loading'?'Connecting':'No live data';
  return `<span class="data-state ${cls}">${label}</span>`;
}

function shell(){
  document.body.innerHTML=`<main class="app-shell"><aside class="sidebar"><div class="brand-lockup"><img src="${V0}/chill-pros-logo.png" alt="Chill Pros"><div><strong>CHILL PROS</strong><span>OPS COMMAND</span></div></div><div class="workspace-switcher"><span class="live-dot"></span> Operations HQ</div><nav class="nav-list" id="navList"></nav></aside><section class="content-area"><header class="topbar"><div class="mobile-brand"><img src="${V0}/chill-pros-logo.png" alt="Chill Pros"><strong>OPS COMMAND</strong></div><div class="desktop-brand"><img src="${V0}/chill-pros-command-center.png" alt="Chill Pros Command Center"></div><div class="search-box" id="globalSearch"><span>Search jobs, clients, equipment...</span><kbd>⌘ K</kbd></div><div class="top-actions"><button class="icon-button" id="refreshAll" aria-label="Refresh operations">↻</button><span class="top-user">CP</span></div></header><div class="page-content" id="workspace"></div></section><nav class="mobile-nav" id="mobileNav"></nav></main><button class="chill-bro-launch pending" id="chillBroLaunch" aria-label="Open Chill Bro"><img src="/chill-bro-launcher-v7.svg" alt=""></button><section class="chill-bro-dock" id="chillBroDock" aria-hidden="true"><div class="chill-bro-dock-head"><img src="/chill-bro-launcher-v7.svg" alt=""><div><strong>CHILL BRO</strong><small id="chillBroStatus">IONOS connection pending</small></div><button class="chill-bro-dock-close" id="chillBroClose" aria-label="Close Chill Bro">×</button></div><div class="chill-bro-dock-body"><p>Chill Bro is the Chill Pros face. IONOS handles the actual AI conversation and voice.</p><div class="assistant-status" id="assistantStatus"></div><div class="chill-bro-dock-actions"><button class="primary" id="openIonos">Open assistant</button><button id="assistantSettings">Assistant settings</button></div></div></section>`;
  buildNav();
  wireAssistantShell();
  $('#refreshAll').onclick=()=>loadRecords(true);
  $('#globalSearch').onclick=()=>showView('Clients');
  showView('Dashboard');
}

const nav=[['Dashboard','⌂'],['Service Intake','▤'],['Dispatch / Jobs','▦'],['Office Queue','◷'],['Quotes','▧'],['Invoices & Payments','$'],['Parts Intelligence','✦'],['Technicians','🔧'],['Clients','◉'],['Equipment','⬡'],['Maintenance','◆'],['Reports','▥'],['BoodaFlow','↯'],['Settings','⚙']];
function buildNav(){
  const n=$('#navList');n.innerHTML='<p class="nav-label">Workspace</p>';
  nav.forEach(([l,i],x)=>{if(x===10)n.insertAdjacentHTML('beforeend','<p class="nav-label nav-spaced">Manage</p>');const b=document.createElement('button');b.className='nav-item';b.dataset.view=l;b.innerHTML=`<span>${i}</span><strong>${l}</strong>`;b.onclick=()=>showView(l);n.appendChild(b)});
  const m=$('#mobileNav');[['Today','Dashboard','⌂'],['Jobs','Dispatch / Jobs','▦'],['Intake','Service Intake','＋'],['Quote','Quotes','▧'],['Clients','Clients','◉']].forEach(([l,v,i])=>{const b=document.createElement('button');b.dataset.view=v;b.innerHTML=`<b>${i}</b><span>${l}</span>`;b.onclick=()=>showView(v);m.appendChild(b)});
}
function setActive(){$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===active))}

async function fetchCustomers(){
  const query=db.collection('Customers').limit(100);
  try{return await query.get({source:'server'})}catch(first){
    try{return await query.get()}catch(second){second.cause=first;throw second}
  }
}
async function loadRecords(manual=false){
  if(!db)return;
  dataState='loading';
  if(active==='Dashboard')renderDashboard();
  try{
    const s=await fetchCustomers();
    records=s.docs.map(d=>normalizeRecord(d.data(),d.id));
    cacheRecords(records);
    dataState='live';lastDataError='';
    await syncPending();
    if(manual)toast('Operations data refreshed');
  }catch(e){
    console.error('Operations refresh failed',e);
    lastDataError=String(e?.message||e?.code||'Firestore connection failed');
    const cached=loadCachedRecords();
    if(cached.length){records=cached.map(r=>normalizeRecord(r,r.firestoreId));dataState='cached';if(manual)toast('Live refresh failed — using cached records')}
    else{records=[];dataState='offline';if(manual)toast('Live records unavailable')}
  }
  showView(active);
}

async function syncPending(){
  pending=loadPending();
  if(!pending.length||dataState!=='live')return;
  const remaining=[];
  for(const item of pending){
    try{
      if(item.action==='create')await db.collection('Customers').add(item.data);
      else if(item.action==='update'&&item.id)await db.collection('Customers').doc(item.id).set(item.data,{merge:true});
    }catch{remaining.push(item)}
  }
  pending=remaining;savePending();
}

function showView(v){
  active=v;setActive();
  if(v==='Dashboard')return renderDashboard();
  if(v==='Service Intake')return renderIntake();
  if(v==='Quotes'||v==='Invoices & Payments')return renderBilling();
  if(v==='Settings')return renderSettings();
  renderList(v);
}

function renderDashboard(){
  const jobs=records.filter(r=>ACTIVE_STATUSES.has(r.officeStatus)).length;
  const queue=records.filter(r=>r.officeStatus&&r.officeStatus!=='Completed').length;
  const techs=new Set(records.map(r=>r.assignedTechnician).filter(Boolean)).size;
  const source=dataState==='live'?'Live':dataState==='cached'?'Cached':'Unavailable';
  $('#workspace').innerHTML=`<div class="page-title-row"><div><div class="breadcrumb">Operations › Dashboard</div><div class="hero-title"><img class="dashboard-title-logo" src="${V0}/chill-pros-title.png" alt="Chill Pros"></div><p class="subhead">Chill Pros operations ${dataStateMarkup()}</p></div><div class="title-actions"><button class="secondary-button" data-go="Dispatch / Jobs">Tech view</button><button class="neon-button" data-go="Service Intake">＋ New intake</button></div></div><div class="metric-grid"><section class="glass-card metric-card"><div class="metric-top"><span>Active jobs</span><b>🔧</b></div><strong>${jobs}</strong><div class="metric-source">${source}</div></section><section class="glass-card metric-card"><div class="metric-top"><span>Awaiting dispatch</span><b>◷</b></div><strong>${queue}</strong><div class="metric-source">${source}</div></section><section class="glass-card metric-card"><div class="metric-top"><span>Technicians in field</span><b>◉</b></div><strong>${techs}</strong><div class="metric-source">${source}</div></section><section class="glass-card metric-card"><div class="metric-top"><span>Quotes</span><b>▧</b></div><strong>Native</strong><div class="metric-change">Ready</div></section><section class="glass-card metric-card"><div class="metric-top"><span>Invoices / payments</span><b>$</b></div><strong>Live</strong><div class="metric-change">Card + ACH</div></section><section class="glass-card metric-card"><div class="metric-top"><span>Parts intelligence</span><b>✦</b></div><strong>Ready</strong><div class="metric-change">Equipment linked</div></section></div><div class="dashboard-grid"><section class="glass-card dispatch-card"><div class="section-heading"><div><p class="eyebrow">Operations</p><h2>Today's dispatch</h2></div><button class="link-button" data-go="Dispatch / Jobs">Open full board →</button></div><div class="jobs-table">${dashboardRows()}</div></section><div class="side-stack"><section class="glass-card"><div class="section-heading"><div><p class="eyebrow">Needs attention</p><h2>Office queue</h2></div><button class="link-button" data-go="Office Queue">View queue →</button></div><div class="queue-list">${queueRows()}</div></section><section class="glass-card intel-card"><div class="intel-heading"><div><p class="eyebrow">Equipment workspace</p><h2>Parts Intelligence</h2></div><span class="ai-live">Ready</span></div><p>Use customer, equipment, model and serial records to organize parts research and service context.</p><button class="secondary-button full" data-go="Parts Intelligence">Open Parts Intelligence →</button></section></div></div><div class="lower-grid"><section class="glass-card"><div class="section-heading"><div><p class="eyebrow">Financial pulse</p><h2>Quotes & Collections</h2></div></div><p class="subhead">Create quotes, approve invoices and launch secure card/ACH collection.</p><button class="neon-button" data-go="Quotes">Open billing</button></section><section class="glass-card booda-card"><div class="booda-heading"><div><p class="eyebrow">Operations control</p><h2>BoodaFlow</h2></div><span>↯</span></div><p>Complete priority work, advance safe tasks, keep blocked work from stopping unrelated progress.</p></section></div>`;
  wireGos();
}
function dashboardRows(){
  const a=records.filter(r=>ACTIVE_STATUSES.has(r.officeStatus)||r.scheduledDate||r.scheduledTime).slice(0,4);
  if(!a.length)return `<div class="empty-live-state"><div><strong>${dataState==='offline'?'Live dispatch unavailable':'No dispatch records yet'}</strong><span>${dataState==='offline'?'Refresh when the connection returns.':'Schedule a job and it will appear here.'}</span></div></div>`;
  return a.map(r=>`<article class="job-row"><div class="job-time">${esc(r.scheduledTime||'—')}</div><div class="job-info"><strong>${esc(r.customerName||'Customer')}</strong><small>${esc(r.complaint||r.equipmentType||'Service')}</small></div><span class="status-badge status-blue">${esc(r.officeStatus||'Open')}</span></article>`).join('');
}
function queueRows(){
  const a=records.filter(r=>r.officeStatus!=='Completed').slice(0,3);
  if(!a.length)return `<div class="empty-live-state"><div><strong>${dataState==='offline'?'Queue unavailable':'Office queue clear'}</strong><span>${dataState==='offline'?'No cached records are available.':'New intake items will appear here.'}</span></div></div>`;
  return a.map(r=>`<div class="queue-item"><div><strong>${esc(r.customerName||'Customer')}</strong><span>${esc(r.complaint||r.officeStatus||'Needs review')}</span></div><div class="queue-meta"><b>${esc(r.officeStatus||'Review')}</b></div></div>`).join('');
}
function wireGos(){$$('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go))}
function header(title,lead){return `<div class="functional-panel"><div class="workspace-page-head"><div><p class="eyebrow">Operations workspace</p><h1>${esc(title)}</h1><p class="lead">${esc(lead)} ${dataStateMarkup()}</p></div></div>`}

function renderIntake(){
  $('#workspace').innerHTML=header('Service Intake','Create a Chill Pros customer/job record.')+`<form class="functional-form" id="intakeForm"><input name="customerName" required placeholder="Customer / company"><input name="contactName" placeholder="Contact name"><input name="phone" placeholder="Phone"><input name="email" type="email" placeholder="Email"><input class="wide" name="address" placeholder="Service address"><input name="equipmentType" placeholder="Equipment type"><input name="manufacturer" placeholder="Manufacturer"><input name="modelNumber" placeholder="Model number"><input name="serialNumber" placeholder="Serial number"><textarea class="wide" name="complaint" required placeholder="Customer complaint / requested service"></textarea><textarea class="wide" name="findings" placeholder="Technician findings"></textarea><input name="estimatedAmount" inputmode="decimal" placeholder="Estimated amount"><input name="assignedTechnician" placeholder="Assigned technician"><button class="primary wide" type="submit">Save Service Intake</button></form></div>`;
  $('#intakeForm').onsubmit=saveIntake;
}
async function saveIntake(e){
  e.preventDefault();const f=e.currentTarget;const d=normalizeRecord(Object.fromEntries(new FormData(f)));d.officeStatus='Needs Review';d.createdAt=new Date().toISOString();
  try{const ref=await db.collection('Customers').add(d);d.firestoreId=ref.id;records.unshift(d);cacheRecords(records);dataState='live';f.reset();showView('Office Queue');toast('Service intake saved')}
  catch(x){d.firestoreId='';records.unshift(d);cacheRecords(records);pending.push({action:'create',data:d});savePending();dataState='cached';f.reset();showView('Office Queue');toast('Saved on this device — will sync when online')}
}

function renderList(v){
  let list=records;
  if(v==='Dispatch / Jobs')list=records.filter(r=>ACTIVE_STATUSES.has(r.officeStatus));
  if(v==='Equipment'||v==='Parts Intelligence')list=records.filter(r=>r.equipmentType||r.modelNumber||r.serialNumber);
  if(v==='Maintenance')list=records.filter(r=>/maintenance|pm/i.test(`${r.complaint||''} ${r.officeStatus||''}`));
  if(v==='Technicians'){
    const ts=[...new Set(records.map(r=>r.assignedTechnician).filter(Boolean))];
    $('#workspace').innerHTML=header('Technicians','Assigned field staff from service records.')+`<div class="functional-list">${ts.length?ts.map(t=>`<div class="functional-row"><div><strong>${esc(t)}</strong><span>${records.filter(r=>r.assignedTechnician===t).length} linked records</span></div></div>`).join(''):'<div class="functional-row"><div><strong>No technician assignments yet</strong></div></div>'}</div></div>`;return;
  }
  if(v==='Reports'){
    const jobs=records.filter(r=>ACTIVE_STATUSES.has(r.officeStatus)).length;
    $('#workspace').innerHTML=header('Reports','Operational summary from available records.')+`<div class="metric-grid"><section class="glass-card metric-card"><span>Customers</span><strong>${records.length}</strong></section><section class="glass-card metric-card"><span>Active jobs</span><strong>${jobs}</strong></section><section class="glass-card metric-card"><span>Equipment</span><strong>${records.filter(r=>r.modelNumber||r.serialNumber).length}</strong></section></div></div>`;return;
  }
  if(v==='BoodaFlow'){$('#workspace').innerHTML=header('BoodaFlow','Operations control and execution discipline.')+`<section class="glass-card functional-row"><div><strong>BoodaFlow active</strong><span>Complete priority work → advance the next safe task → keep blocked work moving around.</span></div></section></div>`;return}
  const status=v==='Office Queue'||v==='Dispatch / Jobs';
  $('#workspace').innerHTML=header(v,`${list.length} available record${list.length===1?'':'s'}.`)+`<div class="functional-toolbar"><input id="filterRecords" placeholder="Search customers, jobs, equipment..."></div><div class="functional-list" id="recordList">${recordHtml(list,status)}</div></div>`;
  $('#filterRecords').oninput=e=>{$('#recordList').innerHTML=recordHtml(list.filter(r=>JSON.stringify(r).toLowerCase().includes(e.target.value.toLowerCase())),status);wireStatus()};wireStatus();
}
function statusOptions(current){return STATUS_OPTIONS.map(s=>`<option${s===current?' selected':''}>${esc(s)}</option>`).join('')}
function recordHtml(list,status){if(!list.length)return '<div class="functional-row"><div><strong>No matching records yet.</strong></div></div>';return list.map(r=>`<div class="functional-row"><div><strong>${esc(r.customerName||r.contactName||'Chill Pros record')}</strong><span>${esc(r.address||r.email||r.phone||'No address entered')}</span><small>${esc(r.complaint||r.equipmentType||r.modelNumber||r.officeStatus||'')}</small></div>${status?`<select data-id="${esc(r.firestoreId||r.id)}" data-local="${r.firestoreId?'0':'1'}">${statusOptions(r.officeStatus)}</select>`:'›'}</div>`).join('')}
function wireStatus(){$$('#recordList select').forEach(s=>s.onchange=async()=>{const r=records.find(x=>(x.firestoreId||x.id)===s.dataset.id);if(!r)return;const previous=r.officeStatus;r.officeStatus=s.value;cacheRecords(records);if(!r.firestoreId){pending.push({action:'create',data:r});savePending();toast('Status saved locally');return}try{await db.collection('Customers').doc(r.firestoreId).set({officeStatus:s.value,statusUpdatedAt:new Date().toISOString()},{merge:true});toast('Status updated')}catch(e){r.officeStatus=s.value;pending.push({action:'update',id:r.firestoreId,data:{officeStatus:s.value,statusUpdatedAt:new Date().toISOString()}});savePending();dataState='cached';toast('Status queued for sync')}})}

function renderBilling(){
  $('#workspace').innerHTML=header('Quotes & Collections','Native Chill Pros quote → invoice → card/ACH workflow.')+`<div class="functional-form" id="billForm"><input id="bcustomer" placeholder="Customer / company"><input id="bemail" type="email" placeholder="Customer email"><input id="bjob" placeholder="Job ID (optional)"><input id="bqty" type="number" min="1" value="1" placeholder="Qty"><textarea class="wide" id="bscope" placeholder="Scope of work"></textarea><input class="wide" id="bdesc" placeholder="Line item / repair description"><input id="bprice" type="number" min="0" step="0.01" placeholder="Unit price"></div><div class="billing-actions"><button class="primary" data-b="quote">Save Draft Quote</button><button data-b="approveq">Approve Quote</button><button class="primary" data-b="invoice">Create Invoice</button><button data-b="approvei">Approve Invoice</button><button class="primary" data-b="pay">Card / ACH Link</button><button data-b="status">Payment Status</button></div><div class="billing-meta" id="billMeta">Native Chill Pros billing ready.</div></div>`;
  const st={q:'',i:'',s:''};$$('[data-b]').forEach(b=>b.onclick=()=>billingAction(b.dataset.b,st));
}
async function billingAction(a,st){
  const meta=$('#billMeta'),ctx={customerName:$('#bcustomer').value.trim(),customerEmail:$('#bemail').value.trim(),jobId:$('#bjob').value.trim(),scope:$('#bscope').value.trim(),description:$('#bdesc').value.trim(),quantity:Number($('#bqty').value||1),unitPrice:Number($('#bprice').value||0)};
  try{
    if(a==='quote'){if(!ctx.description||!ctx.unitPrice)throw Error('Enter a description and price first.');const d=await secure(BILL,'/quotes',{customerName:ctx.customerName,customerEmail:ctx.customerEmail,jobId:ctx.jobId||undefined,scope:ctx.scope,lines:[{description:ctx.description,quantity:ctx.quantity,unitPrice:ctx.unitPrice}]});st.q=d.id;meta.textContent=`Draft quote saved • $${Number(d.total||0).toFixed(2)} • ${st.q}`}
    if(a==='approveq'){if(!st.q)throw Error('Save a quote first.');await secure(BILL,`/quotes/${encodeURIComponent(st.q)}/approve`,{});meta.textContent='Quote owner-approved.'}
    if(a==='invoice'){if(!st.q)throw Error('Save a quote first.');const d=await secure(BILL,'/invoices',{quoteId:st.q});st.i=d.id;meta.textContent=`Draft invoice created • $${Number(d.total||0).toFixed(2)} • ${st.i}`}
    if(a==='approvei'){if(!st.i)throw Error('Create an invoice first.');await secure(BILL,`/invoices/${encodeURIComponent(st.i)}/approve`,{});meta.textContent='Invoice owner-approved.'}
    if(a==='pay'){if(!st.i)throw Error('Create and approve an invoice first.');const d=await secure(BILL,'/payments/checkout',{invoiceId:st.i});st.s=d.checkoutSessionId;meta.textContent='Secure card/ACH checkout ready.';if(d.url)window.open(d.url,'_blank','noopener,noreferrer')}
    if(a==='status'){if(!st.s)throw Error('Create a payment checkout first.');const d=await secure(BILL,'/payments/status',{checkoutSessionId:st.s});meta.textContent=`Payment status: ${d.paymentStatus||d.status||'unknown'}`}
  }catch(e){meta.textContent=e.message||'Billing action failed.'}
}

function parseIonosScript(raw){
  const value=String(raw||'').trim();if(!value)throw Error('Paste the complete IONOS Widget Script.');
  const doc=new DOMParser().parseFromString(value,'text/html');
  const script=doc.querySelector('script[name="web-chat"],script[src*="ionos.ai-voice-receptionist.com"]');
  if(!script)throw Error('That does not look like an IONOS web-chat widget script.');
  const src=String(script.getAttribute('src')||'').trim();
  const clientSecret=String(script.getAttribute('data-client-secret')||script.dataset?.clientSecret||'').trim();
  let url;try{url=new URL(src,location.href)}catch{throw Error('IONOS widget URL is invalid.');}
  if(url.hostname!=='ionos.ai-voice-receptionist.com')throw Error('Unexpected widget host. Use the script copied from IONOS.');
  if(!clientSecret)throw Error('The IONOS client secret is missing from the widget script.');
  return {src:url.href,clientSecret};
}
function saveIonosFromTextarea(){
  const status=$('#ionosConfigStatus');
  try{
    const cfg=parseIonosScript($('#ionosWidgetScript').value);writeJson(IONOS_KEY,cfg);window.CHILL_PROS_IONOS_RECEPTIONIST=cfg;
    const installed=window.installIonosReceptionist?.(cfg);updateAssistantState();
    status.className='good';status.textContent=installed===false?'IONOS saved. Reload once to activate.':'IONOS saved and activated on this device.';
    toast('IONOS assistant configured');
  }catch(e){status.className='warn';status.textContent=e.message||'Unable to save IONOS widget.'}
}
function clearIonos(){localStorage.removeItem(IONOS_KEY);delete window.CHILL_PROS_IONOS_RECEPTIONIST;$('#ionosWidgetScript').value='';$('#ionosConfigStatus').className='warn';$('#ionosConfigStatus').textContent='IONOS not configured on this device.';toast('IONOS device configuration cleared');updateAssistantState()}
function renderSettings(){
  const cfg=readJson(IONOS_KEY,null);const configured=Boolean(cfg?.src&&cfg?.clientSecret);
  $('#workspace').innerHTML=header('Settings','Secure Operations Center session.')+`<div class="functional-row"><div><strong>Signed in</strong><span>${esc(firebase.auth().currentUser?.email||'Chill Pros user')}</span></div><button class="secondary-button" id="signOut">Sign out</button></div><div class="functional-row"><div><strong>Operations data</strong><span>${dataState==='live'?'Connected to Firestore':dataState==='cached'?'Using cached records':'Live connection unavailable'}${lastDataError?` • ${esc(lastDataError)}`:''}</span></div></div><section class="ionos-settings"><h3>Chill Bro • IONOS AI Receptionist</h3><p>Paste the full IONOS Widget Script from AI Frontdesk → Customer Portal → Attributes → Chat. The app extracts the widget URL and client secret automatically.</p><textarea id="ionosWidgetScript" placeholder="<script src=&quot;https://ionos.ai-voice-receptionist.com/.../web-chat.js&quot; name=&quot;web-chat&quot; data-client-secret=&quot;...&quot;></script>"></textarea><div class="ionos-row"><button class="primary" id="saveIonos">Save & Activate IONOS</button><button id="clearIonos">Clear device setup</button></div><p id="ionosConfigStatus" class="${configured?'good':'warn'}">${configured?'IONOS is configured on this device.':'IONOS is awaiting the widget script.'}</p><div class="ionos-note">The widget credential is stored in this browser/PWA only. It is not committed to the public GitHub repository.</div></section></div>`;
  $('#signOut').onclick=()=>firebase.auth().signOut();$('#saveIonos').onclick=saveIonosFromTextarea;$('#clearIonos').onclick=clearIonos;
}

function currentIonosConfig(){const c=window.CHILL_PROS_IONOS_RECEPTIONIST||readJson(IONOS_KEY,null);return c?.src&&c?.clientSecret?c:null}
function findAndOpenIonos(){
  const own=$('#chillBroLaunch');
  const nodes=$$('button,[role="button"],a').filter(el=>el!==own&&!el.closest('#chillBroDock'));
  const target=nodes.find(el=>/chat|message|assistant|reception|ionos/i.test(`${el.getAttribute('aria-label')||''} ${el.getAttribute('title')||''} ${el.textContent||''}`));
  if(target){target.click();return true}
  const frame=$$('iframe').find(f=>/ionos|voice-receptionist|chat/i.test(`${f.src} ${f.title}`));
  if(frame){try{frame.focus()}catch{};return false}
  return false;
}
function updateAssistantState(){
  const cfg=currentIonosConfig();const launch=$('#chillBroLaunch');const status=$('#chillBroStatus');const box=$('#assistantStatus');if(!launch||!status||!box)return;
  launch.classList.toggle('online',Boolean(cfg));launch.classList.toggle('pending',!cfg);
  status.textContent=cfg?'IONOS AI Receptionist configured':'IONOS connection pending';
  box.innerHTML=cfg?'<b>IONOS connected.</b> Chill Bro branding is active. The IONOS widget handles chat and voice.':'<b>One setup item remains.</b> Paste the IONOS Widget Script in Settings to activate the real voice/chat engine.';
}
function wireAssistantShell(){
  const launch=$('#chillBroLaunch'),dock=$('#chillBroDock');
  const toggle=()=>{const open=!dock.classList.contains('open');dock.classList.toggle('open',open);dock.setAttribute('aria-hidden',String(!open));updateAssistantState()};
  launch.onclick=()=>{if(currentIonosConfig()&&findAndOpenIonos())return;toggle()};
  $('#chillBroClose').onclick=()=>{dock.classList.remove('open');dock.setAttribute('aria-hidden','true')};
  $('#assistantSettings').onclick=()=>{dock.classList.remove('open');showView('Settings')};
  $('#openIonos').onclick=()=>{if(!currentIonosConfig()){dock.classList.remove('open');showView('Settings');return}if(!findAndOpenIonos())toast('IONOS is connected. Use its chat control if it appears beside Chill Bro.')};
  updateAssistantState();
  const observer=new MutationObserver(()=>updateAssistantState());observer.observe(document.body,{childList:true,subtree:true});
}

function login(){document.body.innerHTML=`<main class="login-screen"><form class="login-card"><img src="${V0}/chill-pros-official.png" alt="Chill Pros"><input name="email" type="email" autocomplete="username" placeholder="Chill Pros email" required><input name="password" type="password" autocomplete="current-password" placeholder="Password" required><p class="login-error"></p><button>SIGN IN</button></form></main>`;$('.login-card').onsubmit=async e=>{e.preventDefault();const d=new FormData(e.currentTarget);try{await firebase.auth().signInWithEmailAndPassword(String(d.get('email')),String(d.get('password')))}catch(x){$('.login-error').textContent=x.message||'Sign-in failed.'}}}
function boot(){if(!initFirebase())return setTimeout(boot,100);pending=loadPending();firebase.auth().onAuthStateChanged(u=>{if(!u)return login();records=loadCachedRecords().map(r=>normalizeRecord(r,r.firestoreId));dataState=records.length?'cached':'loading';shell();loadRecords(false)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
