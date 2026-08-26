(() => {
  'use strict';

  const MASCOT = 'chill-bro-approved.webp';

  function installMascot() {
    const launcher = document.getElementById('chillBroLauncher');
    const mark = document.querySelector('.chill-bro-mark');
    const orb = document.querySelector('.v4-ai-orb');
    if (launcher && !launcher.querySelector('img')) {
      launcher.textContent = '';
      launcher.innerHTML = `<img src="${MASCOT}" alt="Chill Bro" style="width:100%;height:100%;object-fit:cover;display:block">`;
    }
    if (mark && !mark.querySelector('img')) {
      mark.textContent = '';
      mark.innerHTML = `<img src="${MASCOT}" alt="Chill Bro" style="width:100%;height:100%;object-fit:contain;display:block">`;
    }
    if (orb && !orb.querySelector('img')) {
      orb.textContent = '';
      orb.innerHTML = `<img src="${MASCOT}" alt="Chill Bro 2.0" style="width:100%;height:100%;object-fit:contain;display:block">`;
    }
  }

  function openChillBro() {
    const launcher = document.getElementById('chillBroLauncher');
    const panel = document.getElementById('chillBroPanel');
    if (launcher && panel && !panel.classList.contains('open')) launcher.click();
    return panel;
  }

  function installVoiceFirst() {
    const panel = document.getElementById('chillBroPanel');
    if (!panel) return;
    const voiceToggle = panel.querySelector('#chillBroVoiceToggle');
    if (voiceToggle && voiceToggle.textContent.trim().toUpperCase() === 'VOICE OFF') voiceToggle.click();

    const aiCard = document.querySelector('.v4-ai-card');
    if (aiCard && !document.getElementById('cpTapToSpeak')) {
      const button = document.createElement('button');
      button.id = 'cpTapToSpeak';
      button.type = 'button';
      button.innerHTML = '🎙&nbsp;&nbsp; TAP TO SPEAK';
      button.addEventListener('click', () => {
        openChillBro();
        window.setTimeout(() => document.getElementById('chillBroMic')?.click(), 120);
      });
      aiCard.appendChild(button);
    }
  }

  function installQuickInvoice() {
    if (document.getElementById('cpQuickInvoice')) return;
    const button = document.createElement('button');
    button.id = 'cpQuickInvoice';
    button.type = 'button';
    button.innerHTML = 'QUOTE / INVOICE<small>Native billing</small>';
    button.addEventListener('click', () => {
      const panel = openChillBro();
      if (!panel) return;
      window.setTimeout(() => {
        const billing = document.getElementById('chillBroBilling');
        const toggle = panel.querySelector('.chill-bro-billing-toggle');
        if (billing && !billing.classList.contains('open')) toggle?.click();
        document.getElementById('cbBillCustomer')?.focus();
      }, 140);
    });
    document.body.appendChild(button);
  }

  function keepBillingReadable() {
    const billing = document.getElementById('chillBroBilling');
    const thread = document.getElementById('chillBroThread');
    if (!billing || !thread || billing.dataset.v5Observed) return;
    billing.dataset.v5Observed = '1';
    new MutationObserver(() => {
      thread.style.minHeight = billing.classList.contains('open') ? '220px' : '';
    }).observe(billing, { attributes: true, attributeFilter: ['class'] });
  }

  function enhance() {
    installMascot();
    installVoiceFirst();
    installQuickInvoice();
    keepBillingReadable();
  }

  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    enhance();
    if ((document.getElementById('chillBroLauncher') && document.getElementById('chillBroBilling')) || tries > 80) window.clearInterval(timer);
  }, 200);
  document.addEventListener('DOMContentLoaded', enhance);
})();
