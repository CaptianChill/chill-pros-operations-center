(() => {
  'use strict';

  const BILL = 'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/nativeOpsApi';
  const CHILL_BRO = 'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/chillBroApi';
  let quoteState = { quoteId: '', invoiceId: '' };
  let chillBroSessionId = '';
  let authPromptPromise = null;
  let recognition = null;
  let speakReplies = true;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money = (n) => Number(n || 0).toLocaleString('en-US', { style:'currency', currency:'USD' });

  function friendlyAuthError(error) {
    const code = String(error?.code || error?.message || '');
    if (/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD/i.test(code)) return 'Email or password is incorrect.';
    if (/TOO_MANY_ATTEMPTS/i.test(code)) return 'Too many attempts. Try again shortly.';
    if (/AbortError|timeout/i.test(code)) return 'Sign-in timed out. Check the connection and retry.';
    return error?.message || 'Sign-in failed.';
  }

  function openAuthModal() {
    if (window.chillProsAuth?.currentUser) return Promise.resolve(window.chillProsAuth.currentUser);
    if (authPromptPromise) return authPromptPromise;
    authPromptPromise = new Promise((resolve, reject) => {
      const old = document.getElementById('cpCanonicalAuth'); if (old) old.remove();
      const back = document.createElement('div');
      back.id = 'cpCanonicalAuth'; back.className = 'cp-overlay-backdrop';
      back.innerHTML = `<section class="cp-overlay-card cp-auth-card"><header><div><small>SECURE OPERATIONS</small><h2>Sign in to continue</h2></div><button type="button" class="cp-overlay-close" aria-label="Close">×</button></header><form id="cpAuthForm"><img src="https://chill-pros-operation-ceneter-v2.vercel.app/chill-pros-command-center.png" alt="Chill Pros Command Center"><input name="email" type="email" autocomplete="username" placeholder="Chill Pros email" required><input name="password" type="password" autocomplete="current-password" placeholder="Password" required><div class="cp-overlay-error" id="cpAuthError"></div><button class="cp-overlay-primary" id="cpAuthButton" type="submit">SIGN IN</button></form></section>`;
      document.body.appendChild(back);
      const cancel = () => { back.remove(); authPromptPromise = null; reject(new Error('Sign-in required.')); };
      back.querySelector('.cp-overlay-close').onclick = cancel;
      back.addEventListener('click', e => { if (e.target === back) cancel(); });
      back.querySelector('#cpAuthForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = back.querySelector('#cpAuthButton'); const err = back.querySelector('#cpAuthError'); const fd = new FormData(e.currentTarget);
        btn.disabled = true; btn.textContent = 'SIGNING IN…'; err.textContent = '';
        try {
          const result = await window.chillProsAuth.signInWithEmailAndPassword(String(fd.get('email')||'').trim(), String(fd.get('password')||''));
          back.remove(); authPromptPromise = null; resolve(result.user);
        } catch (error) { err.textContent = friendlyAuthError(error); btn.disabled = false; btn.textContent = 'SIGN IN'; }
      });
    });
    return authPromptPromise;
  }

  async function secure(base, path, body = {}) {
    const user = window.chillProsAuth?.currentUser || await openAuthModal();
    const token = await user.getIdToken();
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 18000);
    try {
      const response = await fetch(base + path, { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body:JSON.stringify(body), signal:ctl.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      return data;
    } finally { clearTimeout(timer); }
  }

  function openQuoteWorkspace() {
    document.getElementById('cpQuoteOverlay')?.remove();
    const back = document.createElement('div'); back.id='cpQuoteOverlay'; back.className='cp-overlay-backdrop';
    back.innerHTML = `<section class="cp-overlay-card cp-quote-card"><header><div><small>NATIVE BILLING</small><h2>Quotes & Collections</h2></div><button class="cp-overlay-close" type="button">×</button></header><div class="cp-quote-grid"><section class="cp-form-stack"><label>Customer / company<input id="cqCustomer"></label><label>Customer email<input id="cqEmail" type="email"></label><label>Job / reference<input id="cqJob"></label><label>Scope of work<textarea id="cqScope"></textarea></label><label>Line item<input id="cqDescription"></label><div class="cp-quote-row"><label>Quantity<input id="cqQty" type="number" min="1" value="1"></label><label>Unit price<input id="cqPrice" type="number" min="0" step="0.01" inputmode="decimal"></label></div><div class="cp-overlay-actions"><button class="cp-overlay-primary" id="cqSave">SAVE DRAFT</button><button class="cp-overlay-secondary" id="cqApprove" disabled>Approve Quote</button><button class="cp-overlay-primary" id="cqInvoice" disabled>Create Invoice</button><button class="cp-overlay-secondary" id="cqApproveInvoice" disabled>Approve Invoice</button><button class="cp-overlay-primary" id="cqPay" disabled>Card / ACH Link</button></div><div class="cp-overlay-status" id="cqStatus">Secure native billing ready.</div></section><section class="cp-quote-preview" id="cqPreview"></section></div></section>`;
    document.body.appendChild(back);
    back.querySelector('.cp-overlay-close').onclick=()=>back.remove(); back.addEventListener('click',e=>{if(e.target===back)back.remove();});
    const data=()=>({customerName:back.querySelector('#cqCustomer').value.trim(),customerEmail:back.querySelector('#cqEmail').value.trim(),jobId:back.querySelector('#cqJob').value.trim(),scope:back.querySelector('#cqScope').value.trim(),description:back.querySelector('#cqDescription').value.trim(),quantity:Math.max(1,Number(back.querySelector('#cqQty').value||1)),unitPrice:Number(back.querySelector('#cqPrice').value||0)});
    const preview=()=>{const d=data(),total=d.quantity*d.unitPrice;back.querySelector('#cqPreview').innerHTML=`<div class="cp-preview-head"><div><strong>CHILL PROS</strong><span>Professional Service Quote</span></div><div>${new Date().toLocaleDateString()}</div></div><h3>${esc(d.customerName||'Customer')}</h3><p>${esc(d.customerEmail||'')}</p><div class="cp-preview-scope">${esc(d.scope||'Scope of work')}</div><div class="cp-preview-line"><strong>${esc(d.description||'Service / repair')}</strong><span>Qty ${d.quantity}</span><span>${money(d.unitPrice)}</span></div><div class="cp-preview-total">Total ${money(total)}</div>`;};
    back.querySelectorAll('input,textarea').forEach(el=>el.addEventListener('input',preview)); preview();
    const status=(t,bad=false)=>{const n=back.querySelector('#cqStatus');n.textContent=t;n.dataset.bad=bad?'1':'0';};
    back.querySelector('#cqSave').onclick=async()=>{const d=data();if(!d.description||!d.unitPrice)return status('Enter a line item and price first.',true);try{const out=await secure(BILL,'/quotes',{customerName:d.customerName,customerEmail:d.customerEmail,jobId:d.jobId||undefined,scope:d.scope,lines:[{description:d.description,quantity:d.quantity,unitPrice:d.unitPrice}]});quoteState.quoteId=out.id;back.querySelector('#cqApprove').disabled=false;status(`Draft saved • ${money(out.total)}`);}catch(e){status(e.message,true);}};
    back.querySelector('#cqApprove').onclick=async()=>{try{await secure(BILL,`/quotes/${encodeURIComponent(quoteState.quoteId)}/approve`,{});back.querySelector('#cqInvoice').disabled=false;status('Quote approved.');}catch(e){status(e.message,true);}};
    back.querySelector('#cqInvoice').onclick=async()=>{try{const out=await secure(BILL,'/invoices',{quoteId:quoteState.quoteId});quoteState.invoiceId=out.id;back.querySelector('#cqApproveInvoice').disabled=false;status(`Invoice created • ${money(out.total)}`);}catch(e){status(e.message,true);}};
    back.querySelector('#cqApproveInvoice').onclick=async()=>{try{await secure(BILL,`/invoices/${encodeURIComponent(quoteState.invoiceId)}/approve`,{});back.querySelector('#cqPay').disabled=false;status('Invoice approved.');}catch(e){status(e.message,true);}};
    back.querySelector('#cqPay').onclick=async()=>{try{const out=await secure(BILL,'/payments/checkout',{invoiceId:quoteState.invoiceId});status('Secure card / ACH checkout created.');if(out.url)window.open(out.url,'_blank','noopener,noreferrer');}catch(e){status(e.message,true);}};
  }

  function speak(text){if(!speakReplies||!window.speechSynthesis||!text)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=1.03;u.pitch=.94;speechSynthesis.speak(u);}
  function addMsg(thread,kind,text){const n=document.createElement('div');n.className=`cp-msg ${kind}`;n.textContent=text;thread.appendChild(n);thread.scrollTop=thread.scrollHeight;}
  function openChillBro(){
    let panel=document.getElementById('cpChillBroPanel');
    if(!panel){panel=document.createElement('section');panel.id='cpChillBroPanel';panel.className='cp-chill-panel';panel.innerHTML=`<header><img src="/chill-bro-approved.webp" alt="Chill Bro"><div><strong>CHILL BRO</strong><small>Voice • Diagnostics • Parts • Training</small></div><button class="cp-overlay-close" type="button">×</button></header><div class="cp-overlay-status" id="cbStatus">Secure field copilot ready</div><div class="cp-chill-thread" id="cbThread"></div><div class="cp-chill-compose"><textarea id="cbInput" placeholder="Tell Chill Bro what the unit is doing…"></textarea><div class="cp-overlay-actions"><button class="cp-overlay-secondary" id="cbTalk">TALK</button><button class="cp-overlay-secondary" id="cbVoice">VOICE ON</button><button class="cp-overlay-primary" id="cbSend">ASK CHILL BRO</button></div></div>`;document.body.appendChild(panel);const thread=panel.querySelector('#cbThread');addMsg(thread,'bot','Yo — what we got? Give me the complaint, readings, model/serial, and what you already checked.');panel.querySelector('.cp-overlay-close').onclick=()=>panel.classList.remove('open');panel.querySelector('#cbVoice').onclick=e=>{speakReplies=!speakReplies;e.currentTarget.textContent=speakReplies?'VOICE ON':'VOICE OFF';if(!speakReplies)speechSynthesis?.cancel();};const send=async()=>{const input=panel.querySelector('#cbInput');const message=input.value.trim();if(!message)return;addMsg(thread,'user',message);input.value='';panel.querySelector('#cbStatus').textContent='Chill Bro thinking…';try{const out=await secure(CHILL_BRO,'/chat',{message,mode:'field-help',sessionId:chillBroSessionId||undefined,context:{pageTitle:document.title,source:'canonical-v0-top-level'}});chillBroSessionId=out.sessionId||chillBroSessionId;addMsg(thread,'bot',out.answer||'No response returned.');panel.querySelector('#cbStatus').textContent='Ready';speak(out.answer);}catch(e){addMsg(thread,'system',e.message||'Chill Bro unavailable.');panel.querySelector('#cbStatus').textContent='Connection issue';}};panel.querySelector('#cbSend').onclick=send;panel.querySelector('#cbInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});panel.querySelector('#cbTalk').onclick=()=>{const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R){addMsg(thread,'system','Voice recognition is not available in this browser.');return;}if(!recognition){recognition=new R();recognition.lang='en-US';recognition.interimResults=false;recognition.onresult=e=>{const text=Array.from(e.results).map(r=>r[0]?.transcript||'').join(' ').trim();if(text){panel.querySelector('#cbInput').value=text;send();}};}try{recognition.start();}catch{}};}
    panel.classList.add('open');panel.querySelector('#cbInput')?.focus();
  }

  function install(){
    if(!document.querySelector('.app-shell')) return;
    document.documentElement.dataset.cpCanonicalTopLevel='1';
    const userBlock=document.querySelector('.sidebar-user'); if(userBlock){const a=userBlock.querySelector('.avatar');const s=userBlock.querySelector('strong');if(a)a.textContent='CP';if(s)s.textContent='Chill Pros';}
    const top=document.querySelector('.top-user'); if(top) top.textContent='CP';
    document.addEventListener('click',e=>{const b=e.target?.closest?.('button');if(!b)return;const t=(b.textContent||'').replace(/\s+/g,' ').trim();if(/^Quotes\b|^Quote$/i.test(t)||/^Invoices\s*&\s*Payments/i.test(t)){e.preventDefault();e.stopImmediatePropagation();openQuoteWorkspace();}else if(/Chill Bro/i.test(t)){e.preventDefault();e.stopImmediatePropagation();openChillBro();}},true);
    document.getElementById('cpChillBroLauncher')?.remove();const l=document.createElement('button');l.id='cpChillBroLauncher';l.className='cp-chill-launcher';l.type='button';l.setAttribute('aria-label','Open Chill Bro');l.innerHTML='<img src="/chill-bro-approved.webp" alt="Chill Bro">';l.onclick=openChillBro;document.body.appendChild(l);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();
