const db = window.chillProsDb;
const cfg=window.FIELD_FORGED_CONFIG;
const tenant=cfg.tenant;
const STORAGE_KEY=`fieldForged:${tenant.id}:operations-center:v1`;
let queue=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');

const schedule=[
  {time:'9:00 AM',name:"Joe's Ice House",address:'123 Frosty Way, San Antonio, TX',type:'Ice Machine PM Visit'},
  {time:'11:30 AM',name:"Chili's Grill & Bar",address:'8515 Potranco Rd, San Antonio, TX',type:'Walk-In Cooler Service Call'},
  {time:'2:00 PM',name:'H-E-B #204',address:'1604 & Bandera Rd, San Antonio, TX',type:'Reach-In Cooler Repair'}
];
const activity=[
  {icon:'✓',title:'Job #1248 Completed',detail:'7-Eleven Store #3391',time:'8:45 AM'},
  {icon:'▣',title:'New Intake Submitted',detail:"Tony's Pizza & Pasta",time:'7:32 AM'},
  {icon:'◒',title:'Parts Order Placed',detail:'True 842123 Door Gasket',time:'Yesterday'}
];

const views=document.querySelectorAll('.view');
const navButtons=document.querySelectorAll('.side-link');
function showView(id){
  views.forEach(v=>v.classList.toggle('active',v.id===id));
  navButtons.forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  if(id==='office-queue') renderQueue();
  window.scrollTo({top:0,behavior:'smooth'});
}
navButtons.forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
document.querySelectorAll('[data-view-target]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.viewTarget)));

function renderSchedule(){
  scheduleList.innerHTML='';
  schedule.forEach(j=>{
    const row=document.createElement('div');
    row.className='schedule-row';
    row.innerHTML=`<strong>${j.time}</strong><div><b>${j.name}</b><small>${j.address}</small></div><small>${j.type}</small>`;
    scheduleList.appendChild(row);
  });
}
function renderActivity(){
  activityList.innerHTML='';
  activity.forEach(a=>{
    const row=document.createElement('div');
    row.className='activity-row';
    row.innerHTML=`<span class="activity-dot">${a.icon}</span><div><b>${a.title}</b><small>${a.detail}</small></div><small>${a.time}</small>`;
    activityList.appendChild(row);
  });
}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(queue));updateCounts();renderQueue()}
function updateCounts(){
  queueCount.textContent=Math.max(5,queue.filter(x=>x.officeStatus!=='Completed').length);
}
function toast(msg){
  const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),1700);
}
function getFormData(){return Object.fromEntries(new FormData(intakeForm).entries())}
function summary(r){
  return [`CHILL PROS OPERATIONS CENTER`,`Status: ${r.officeStatus}`,`Customer: ${r.customerName}`,`Contact: ${r.contactName||'-'}`,`Phone: ${r.phone||'-'}`,`Email: ${r.email||'-'}`,`Address: ${r.address||'-'}`,`Equipment: ${r.equipmentType||'-'} | ${r.manufacturer||'-'} | Model ${r.modelNumber||'-'} | Serial ${r.serialNumber||'-'}`,`Asset ID: ${r.assetId||'-'}`,`Site Location: ${r.siteLocation||'-'}`,`Complaint: ${r.complaint||'-'}`,`Findings: ${r.findings||'-'}`,`Recommendation: ${r.recommendation||'-'}`,`Estimated Amount: ${r.estimatedAmount?'$'+Number(r.estimatedAmount).toFixed(2):'-'}`,`Photo Notes: ${r.photoNotes||'-'}`].join('\n');
}
async function copyText(text){
  try{await navigator.clipboard.writeText(text)}catch{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
  toast('Summary copied');
}
intakeForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const d = getFormData();
  d.id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  d.createdAt = new Date().toISOString();

  try {
    await db.collection("Customers").add(d);

    queue.unshift(d);
    persist();

    intakeForm.reset();
    toast('Submitted to office queue');
    showView('office-queue');
  } catch (err) {
    console.error(err);
    toast('Failed to save to Firebase');
  }
});

clearIntake.addEventListener('click',()=>{intakeForm.reset();toast('Form cleared')});
copySummary.addEventListener('click',()=>copyText(summary(getFormData())));
queueSearch.addEventListener('input',renderQueue);
queueFilter.addEventListener('change',renderQueue);

function renderQueue(){
  queueList.innerHTML='';
  const q=queueSearch.value.trim().toLowerCase();
  const f=queueFilter.value;
  const filtered=queue.filter(r=>(!q||JSON.stringify(r).toLowerCase().includes(q))&&(!f||r.officeStatus===f));
  if(!filtered.length){queueList.innerHTML='<div class="simple-view"><h2>No matching records</h2><p>Submit a new customer intake to create the first live office queue record.</p></div>';return}
  filtered.forEach(r=>{
    const node=document.getElementById('queueItemTemplate').content.firstElementChild.cloneNode(true);
    node.querySelector('.queue-customer').textContent=r.customerName;
    node.querySelector('.queue-meta').textContent=`${r.equipmentType||'Equipment'} • ${r.manufacturer||'Manufacturer not set'} • ${new Date(r.createdAt).toLocaleString()}`;
    node.querySelector('.queue-detail').textContent=r.complaint||'';
    node.querySelector('.status-pill').textContent=r.officeStatus||'Needs Review';
    node.querySelector('.copy-item').addEventListener('click',()=>copyText(summary(r)));
    node.querySelector('.delete-item').addEventListener('click',()=>{if(confirm('Delete this office queue record?')){queue=queue.filter(x=>x.id!==r.id);persist();toast('Record deleted')}});
    queueList.appendChild(node);
  });
}
exportQueue.addEventListener('click',()=>{
  const payload={platform:cfg.platform,tenant,exportedAt:new Date().toISOString(),queue};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`chill-pros-office-queue-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);toast('Queue export created');
});
addSampleJob.addEventListener('click',()=>{schedule.push({time:'4:30 PM',name:'Sample Emergency Call',address:'San Antonio, TX',type:'HVAC No-Cool'});renderSchedule();toast('Sample job added')});

renderSchedule();
renderActivity();
renderQueue();
updateCounts();
