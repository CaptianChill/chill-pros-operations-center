(() => {
  'use strict';
  const V0='https://chill-pros-operation-ceneter-v2.vercel.app';
  let appLoaded=false;

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;
      s.onload=resolve;
      s.onerror=()=>reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(s);
    });
  }

  async function startApp(){
    if(appLoaded) return;
    appLoaded=true;
    try{
      await loadScript('v2-final-runtime.js?v=20260827-rest4');
      await loadScript('chill-bro-recovered.js?v=20260827-rest4');
      await loadScript('v0-contract-patch.js?v=20260827-rest4');
    }catch(err){
      appLoaded=false;
      document.body.innerHTML=`<main class="login-screen"><section class="login-card"><img src="${V0}/chill-pros-official.png" alt="Chill Pros"><p class="login-error">${String(err.message||'Unable to load Operations Center.')}</p><button id="retryApp">RETRY</button></section></main>`;
      document.getElementById('retryApp')?.addEventListener('click',()=>location.reload());
    }
  }

  function renderLogin(){
    document.body.innerHTML=`<main class="login-screen"><form class="login-card" id="primaryRestLogin"><img src="${V0}/chill-pros-official.png" alt="Chill Pros"><input name="email" type="email" autocomplete="username" placeholder="Chill Pros email" required><input name="password" type="password" autocomplete="current-password" placeholder="Password" required><p class="login-error" id="primaryRestLoginError"></p><button id="primaryRestLoginButton" type="submit">SIGN IN</button></form></main>`;
    const form=document.getElementById('primaryRestLogin');
    const button=document.getElementById('primaryRestLoginButton');
    const error=document.getElementById('primaryRestLoginError');
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(button.disabled) return;
      const data=new FormData(form);
      button.disabled=true;
      button.textContent='SIGNING IN…';
      error.textContent='';
      try{
        const auth=window.chillProsRestAuth;
        if(!auth) throw new Error('Secure sign-in service did not load. Refresh and try again.');
        await auth.signInWithEmailAndPassword(String(data.get('email')||'').trim(),String(data.get('password')||''));
        await startApp();
      }catch(err){
        const raw=String(err?.message||'Sign-in failed.');
        error.textContent=err?.name==='AbortError'?'Sign-in timed out. Check your connection and retry.':raw.replace(/_/g,' ').toLowerCase().includes('invalid login credentials')?'Email or password is incorrect.':raw;
        button.disabled=false;
        button.textContent='SIGN IN';
      }
    });
  }

  function boot(){
    const auth=window.chillProsRestAuth;
    if(!auth){
      document.body.innerHTML=`<main class="login-screen"><section class="login-card"><img src="${V0}/chill-pros-official.png" alt="Chill Pros"><p class="login-error">Secure sign-in failed to initialize.</p><button id="retryInit">RETRY</button></section></main>`;
      document.getElementById('retryInit')?.addEventListener('click',()=>location.reload());
      return;
    }
    if(auth.currentUser) startApp(); else renderLogin();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();