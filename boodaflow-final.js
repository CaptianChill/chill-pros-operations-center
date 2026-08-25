(() => {
  'use strict';
  const KEY='chillPros:BoodaFlow:final:v1';
  const defaults={mode:'OVERDRIVE',running:true,completed:0,blocked:0,active:0,items:[
    {p:'P0',title:'Dispatch service-call spine',detail:'Intake → schedule → assign → status → completion',state:'active'},
    {p:'P0',title:'Quote machine',detail:'Job context → labor/parts → approval → conversion',state:'queued'},
    {p:'P0',title:'Invoice & payment chain',detail:'Approved quote → invoice → balance → payment history',state:'queued'},
    {p:'P0',title:'AI parts intelligence',detail:'Model/serial/symptom → evidence → part → quote',state:'queued'},
    {p:'P1',title:'Technician workspace',detail:'Assigned jobs, notes, time, photos, parts handoff',state:'queued'},
    {p:'P1',title:'Client workspace',detail:'Request service, approve quote, invoice/receipt history',state:'queued'},
    {p:'QA',title:'End-to-end acceptance',detail:'Service request → payment with no duplicate entry',state:'queued'}
  ]};
  function read(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return structuredClone(defaults)}}
  let s=read();
  const save=()=>localStorage.setItem(KEY,JSON.stringify(s));
  function recalc(){s.completed=s.items.filter(x=>x.state==='done').length;s.blocked=s.items.filter(x=>x.state==='blocked').length;s.active=Math.max(0,s.items.findIndex(x=>x.state==='active'));}
  function render(){
    recalc();
    const status=document.getElementById('bfStatus'); if(status) status.textContent=s.running?`${s.mode} • RUNNING`:`${s.mode} • PAUSED`;
    const done=document.getElementById('bfDone'); if(done) done.textContent=`${s.completed}/${s.items.length}`;
    const blocked=document.getElementById('bfBlocked'); if(blocked) blocked.textContent=String(s.blocked);
    const active=document.getElementById('bfActive'); if(active) active.textContent=s.items.find(x=>x.state==='active')?.title||'Complete';
    const list=document.getElementById('bfList');
    if(list) list.innerHTML=s.items.map((x,i)=>`<div class="workitem"><span class="prio">${x.p}</span><div><strong>${x.title}</strong><small>${x.detail}</small></div><span class="state">${x.state.toUpperCase()}</span></div>`).join('');
    save();
  }
  function advance(block=false){
    const i=s.items.findIndex(x=>x.state==='active'); if(i<0) return;
    s.items[i].state=block?'blocked':'done';
    const next=s.items.findIndex((x,j)=>j>i&&x.state==='queued');
    if(next>=0)s.items[next].state='active';
    render();
  }
  document.addEventListener('click',e=>{
    const t=e.target;
    if(t.matches('[data-bf="advance"]')) advance(false);
    if(t.matches('[data-bf="block"]')) advance(true);
    if(t.matches('[data-bf="toggle"]')){s.running=!s.running;render()}
    if(t.matches('[data-bf="reset"]')){s=structuredClone(defaults);render()}
  });
  window.addEventListener('DOMContentLoaded',render);
})();