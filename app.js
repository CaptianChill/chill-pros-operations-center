const STORAGE_KEY = 'chillProsOverlayRecordsV02';
let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

const views = document.querySelectorAll('.view');
const navButtons = document.querySelectorAll('.nav-btn');
const form = document.getElementById('intakeForm');
const template = document.getElementById('recordTemplate');

function showView(id){
  views.forEach(v => v.classList.toggle('active', v.id === id));
  navButtons.forEach(b => b.classList.toggle('active', b.dataset.view === id));
  if(id === 'records') renderRecords();
  if(id === 'dashboard') renderDashboard();
  window.scrollTo({top:0, behavior:'smooth'});
}
navButtons.forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
document.querySelectorAll('[data-open-intake]').forEach(btn => btn.addEventListener('click', () => showView('intake')));

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  renderDashboard();
  renderRecords();
}
function toast(message){
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}
function formObject(){
  return Object.fromEntries(new FormData(form).entries());
}
function summary(r){
  return [
    `CHILL PROS FIELD RECORD`,
    `Type: ${r.recordType}`,
    `Priority: ${r.priority}`,
    `Status: ${r.officeStatus}`,
    `Customer: ${r.customerName}`,
    `Contact: ${r.contactName || '-'}`,
    `Phone: ${r.phone || '-'}`,
    `Email: ${r.email || '-'}`,
    `Address: ${r.address || '-'}`,
    `Equipment: ${r.equipmentType || '-'} | ${r.manufacturer || '-'} | Model ${r.modelNumber || '-'} | Serial ${r.serialNumber || '-'}`,
    `Asset ID: ${r.assetId || '-'}`,
    `Site Location: ${r.equipmentLocation || '-'}`,
    `Complaint: ${r.complaint || '-'}`,
    `Findings: ${r.findings || '-'}`,
    `Recommendation: ${r.recommendation || '-'}`,
    `Estimated Amount: ${r.estimatedAmount ? '$' + Number(r.estimatedAmount).toFixed(2) : '-'}`,
    `Photo Notes: ${r.photoNotes || '-'}`,
    `Created: ${new Date(r.createdAt).toLocaleString()}`
  ].join('\n');
}
async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  }catch{
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Copied to clipboard');
  }
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const data = formObject();
  data.id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  data.createdAt = new Date().toISOString();
  records.unshift(data);
  save();
  form.reset();
  toast('Record saved');
  showView('records');
});

document.getElementById('copySummary').addEventListener('click', () => {
  const data = formObject();
  data.createdAt = new Date().toISOString();
  copyText(summary(data));
});
document.getElementById('clearForm').addEventListener('click', () => {
  form.reset();
  toast('Form cleared');
});

function renderDashboard(){
  document.getElementById('totalRecords').textContent = records.length;
  document.getElementById('quoteCount').textContent = records.filter(r => r.officeStatus === 'Needs Quote').length;
  document.getElementById('invoiceCount').textContent = records.filter(r => r.officeStatus === 'Ready to Invoice').length;
  const recent = document.getElementById('recentRecords');
  recent.innerHTML = '';
  if(!records.length){ recent.className='empty'; recent.textContent='No records yet.'; return; }
  recent.className='';
  records.slice(0,5).forEach(r => recent.appendChild(recordNode(r, false)));
}

function recordNode(r, withDelete=true){
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector('.record-title').textContent = `${r.customerName} — ${r.recordType}`;
  node.querySelector('.record-meta').textContent = `${r.equipmentType || 'Equipment not set'} • ${r.manufacturer || 'Manufacturer not set'} • ${new Date(r.createdAt).toLocaleString()}`;
  node.querySelector('.record-detail').textContent = r.complaint || '';
  node.querySelector('.badge').textContent = r.officeStatus || 'Needs Review';
  node.querySelector('.copy-record').addEventListener('click', () => copyText(summary(r)));
  const del = node.querySelector('.delete-record');
  if(withDelete){
    del.addEventListener('click', () => {
      if(confirm('Delete this record?')){
        records = records.filter(x => x.id !== r.id);
        save();
        toast('Record deleted');
      }
    });
  }else{
    del.remove();
  }
  return node;
}

function renderRecords(){
  const list = document.getElementById('recordsList');
  const q = document.getElementById('searchRecords').value.trim().toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const filtered = records.filter(r => {
    const haystack = JSON.stringify(r).toLowerCase();
    return (!q || haystack.includes(q)) && (!status || r.officeStatus === status);
  });
  list.innerHTML='';
  if(!filtered.length){ list.className='empty'; list.textContent='No matching records.'; return; }
  list.className='';
  filtered.forEach(r => list.appendChild(recordNode(r)));
}
document.getElementById('searchRecords').addEventListener('input', renderRecords);
document.getElementById('statusFilter').addEventListener('change', renderRecords);

document.getElementById('exportRecords').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(records, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chill-pros-overlay-records-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Export created');
});

renderDashboard();
renderRecords();
