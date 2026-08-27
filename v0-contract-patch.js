(() => {
  'use strict';
  const V0 = 'https://chill-pros-operation-ceneter-v2.vercel.app';
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function clickChillBro(event){
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const launcher = document.getElementById('chillBroLauncher');
    if (launcher) { launcher.click(); return; }
    window.setTimeout(() => document.getElementById('chillBroLauncher')?.click(), 250);
  }

  function patchNav(){
    document.querySelectorAll('.nav-item').forEach((button) => {
      const text = button.textContent?.trim() || '';
      if (/^Parts Intelligence$/i.test(text)) {
        const strong = button.querySelector('strong');
        const span = button.querySelector('span:last-of-type');
        if (strong) strong.textContent = 'AI Parts Intelligence'; else if (span) span.textContent = 'AI Parts Intelligence';
      }
    });
    const mobile = document.getElementById('mobileNav') || document.querySelector('.mobile-nav');
    if (!mobile) return;
    const buttons = [...mobile.querySelectorAll('button')];
    if (buttons.length >= 5) {
      const chill = buttons[3];
      chill.dataset.view = '__chillbro';
      chill.innerHTML = '<b>✦</b><span>Chill Bro</span>';
      chill.onclick = clickChillBro;
      chill.addEventListener('touchend', clickChillBro, { passive:false });
      const quote = buttons[4];
      quote.dataset.view = 'Quotes';
      quote.innerHTML = '<b>▧</b><span>Quote</span>';
      quote.onclick = () => document.querySelector('.nav-item[data-view="Quotes"]')?.click();
    }
  }

  function patchPartsCard(){
    document.querySelectorAll('.intel-card').forEach((card) => {
      if (card.querySelector('.intel-mascot')) return;
      const heading = card.querySelector('.intel-heading');
      if (!heading) return;
      const mascot = document.createElement('span');
      mascot.className = 'intel-mascot';
      mascot.innerHTML = `<img src="${V0}/chill-bro-mascot.png" alt="Chill Bro assistant">`;
      heading.prepend(mascot);
    });
  }

  function lockIOSViewport(){
    if (!IOS) return;
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) meta.setAttribute('content','width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover');
    document.documentElement.classList.add('cp-ios');
  }

  function patch(){ lockIOSViewport(); patchNav(); patchPartsCard(); }
  new MutationObserver(patch).observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true}); else patch();
  [100,250,500,900,1500,3000].forEach(ms=>setTimeout(patch,ms));
})();