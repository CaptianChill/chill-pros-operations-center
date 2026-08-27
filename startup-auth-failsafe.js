(() => {
  'use strict';
  const V0='https://chill-pros-operation-ceneter-v2.vercel.app';
  let installed=false;
  function hasApp(){return Boolean(document.querySelector('.app-shell,.login-screen'));}
  function install(){
    if(installed||hasApp()) return;
    installed=true;
    document.body.innerHTML=`<main class="login-screen"><form class="login-card" id="restFallbackLogin"><img src="${V0}/chill-pros-official.png" alt="Chill Pros"><input name="email" type="email" autocomplete="username" placeholder="Chill Pros email" required><input name="password" type="password" autocomplete="current-password" placeholder="Password" required><p class="login-error"></p><button type="submit">SIGN IN</button></form></main>`;
    const form=document.getElementById('restFallbackLogin');
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=form.querySelector('button');
      const err=form.querySelector('.login-error');
      const fd=new FormData(form);
      btn.disabled=true; btn.textContent='SIGNING IN…'; err.textContent='';
      try{
        if(!window.chillProsRestAuth) throw new Error('Secure sign-in service did not load. Refresh and try again.');
        await window.chillProsRestAuth.signInWithEmailAndPassword(String(fd.get('email')||'').trim(),String(fd.get('password')||''));
        location.reload();
      }catch(x){
        err.textContent=x?.name==='AbortError'?'Sign-in timed out. Check your connection and retry.':(x?.message||'Sign-in failed.');
        btn.disabled=false; btn.textContent='SIGN IN';
      }
    });
  }
  const timer=setTimeout(install,1200);
  window.addEventListener('load',()=>setTimeout(()=>{if(!hasApp()) install();},250),{once:true});
  const obs=new MutationObserver(()=>{if(hasApp()){clearTimeout(timer);obs.disconnect();}});
  obs.observe(document.documentElement,{childList:true,subtree:true});
})();