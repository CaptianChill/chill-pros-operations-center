(() => {
  'use strict';
  const V0 = 'https://chill-pros-operation-ceneter-v2.vercel.app';

  function clickChillBro(){
    const launcher = document.getElementById('chillBroV3Launcher');
    if (launcher) launcher.click();
  }

  function patchNav(){
    document.querySelectorAll('.nav-item').forEach((button) => {
      const text = button.textContent?.trim() || '';
      if (/^Parts Intelligence$/i.test(text)) {
        const strong = button.querySelector('strong');
        const span = button.querySelector('span:last-of-type');
        if (strong) strong.textContent = 'AI Parts Intelligence';
        else if (span) span.textContent = 'AI Parts Intelligence';
      }
    });

    const mobile = document.getElementById('mobileNav') || document.querySelector('.mobile-nav');
    if (!mobile || mobile.dataset.v0Contract === '1') return;
    mobile.dataset.v0Contract = '1';
    const buttons = [...mobile.querySelectorAll('button')];
    if (buttons.length >= 5) {
      const chill = buttons[3];
      chill.dataset.view = '__chillbro';
      chill.innerHTML = '<b>✦</b><span>Chill Bro</span>';
      chill.onclick = (event) => { event.preventDefault(); clickChillBro(); };
      const quote = buttons[4];
      quote.dataset.view = 'Quotes';
      quote.innerHTML = '<b>▧</b><span>Quote</span>';
      quote.onclick = () => document.querySelector('.nav-item[data-view="Quotes"]')?.click();
    }
  }

  function patchPartsCard(){
    const cards = [...document.querySelectorAll('.intel-card')];
    cards.forEach((card) => {
      if (card.querySelector('.intel-mascot')) return;
      const heading = card.querySelector('.intel-heading');
      if (!heading) return;
      const mascot = document.createElement('span');
      mascot.className = 'intel-mascot';
      mascot.innerHTML = `<img src="${V0}/chill-bro-mascot.png" alt="Chill Bro assistant">`;
      heading.prepend(mascot);
    });
  }

  function patch(){
    patchNav();
    patchPartsCard();
  }

  const observer = new MutationObserver(patch);
  observer.observe(document.documentElement, {subtree:true, childList:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patch, {once:true});
  else patch();
  [250,700,1500,3000].forEach(ms => setTimeout(patch, ms));
})();
