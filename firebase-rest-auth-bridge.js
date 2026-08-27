(() => {
  'use strict';
  const API_KEY='AIzaSyBsBEKMggwSUvEmdTTK1rjYOcdPyYCCLOc';
  const STORE='chillProsRestAuth';
  const listeners=new Set();
  let session=null;

  function decodeExp(token){try{const p=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return Number(p.exp||0)*1000}catch{return 0}}
  function userFromSession(){if(!session?.idToken)return null;return{email:session.email||'',uid:session.localId||'',getIdToken:async(force)=>{if(force||Date.now()>decodeExp(session.idToken)-60000)await refresh();return session.idToken}}}
  function notify(){const u=userFromSession();listeners.forEach(fn=>{try{fn(u)}catch{}})}
  function persist(){try{session?localStorage.setItem(STORE,JSON.stringify(session)):localStorage.removeItem(STORE)}catch{}}
  function load(){try{const raw=localStorage.getItem(STORE);if(raw)session=JSON.parse(raw)}catch{session=null}}
  async function fetchJson(url,options,ms=12000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{...options,signal:c.signal});const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error?.message||`Request failed (${r.status})`);e.code=j.error?.message||'';throw e}return j}finally{clearTimeout(t)}}
  async function refresh(){if(!session?.refreshToken)throw new Error('Session expired. Sign in again.');const j=await fetchJson(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:session.refreshToken})});session={...session,idToken:j.id_token,refreshToken:j.refresh_token||session.refreshToken,localId:j.user_id||session.localId};persist();return session}
  async function signInWithEmailAndPassword(email,password){const j=await fetchJson(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});session={idToken:j.idToken,refreshToken:j.refreshToken,email:j.email,localId:j.localId};persist();notify();return{user:userFromSession()}}
  async function signOut(){session=null;persist();notify()}
  function onAuthStateChanged(fn){listeners.add(fn);queueMicrotask(async()=>{if(session?.refreshToken&&Date.now()>decodeExp(session.idToken)-60000){try{await refresh()}catch{session=null;persist()}}fn(userFromSession())});return()=>listeners.delete(fn)}

  load();
  const authApi={signInWithEmailAndPassword,signOut,onAuthStateChanged,get currentUser(){return userFromSession()}};
  window.chillProsRestAuth=authApi;
  if(window.firebase){window.firebase.auth=()=>authApi;window.firebase.auth.Auth=authApi}
})();