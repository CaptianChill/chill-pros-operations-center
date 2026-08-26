(() => {
  'use strict';

  const V0 = 'https://chill-pros-operation-ceneter-v2.vercel.app';
  const BRO = 'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/chillBroApi';
  let sessionId = '';
  let pendingImage = '';
  let overlay = null;
  let launcher = null;
  let recognition = null;
  let voiceEnabled = true;

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  async function requestChat(message) {
    const user = window.firebase?.auth?.().currentUser;
    if (!user) throw new Error('Sign in to Chill Pros first.');
    const token = await user.getIdToken();
    const response = await fetch(`${BRO}/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        mode: 'field-help',
        sessionId: sessionId || undefined,
        imageDataUrl: pendingImage || undefined,
        context: {}
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Chill Bro request failed.');
    return data;
  }

  function speak(text) {
    if (!voiceEnabled || !text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.97;
    utterance.pitch = 0.92;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }

  function primeVoice() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('Chill Bro ready.');
    u.lang = 'en-US';
    u.rate = 0.98;
    u.pitch = 0.92;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  }

  function closeBro() {
    recognition?.abort?.();
    recognition = null;
    window.speechSynthesis?.cancel();
    overlay?.remove();
    overlay = null;
    launcher?.classList.remove('listening');
    launcher?.setAttribute('aria-pressed', 'false');
  }

  function addMessage(kind, text) {
    if (!overlay) return;
    const thread = $('.cb-thread', overlay);
    thread.insertAdjacentHTML('beforeend', `<div class="cb-msg ${kind}">${esc(text)}</div>`);
    thread.scrollTop = thread.scrollHeight;
  }

  function startListening() {
    if (!overlay) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      addMessage('system', 'Voice input is unavailable in this browser. Typing still works.');
      return;
    }
    recognition?.abort?.();
    recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    const textarea = $('textarea', overlay);
    const talk = $('[data-c="talk"]', overlay);
    recognition.onstart = () => {
      launcher?.classList.add('listening');
      talk.textContent = 'Listening…';
      $('.cb-status', overlay).textContent = 'LISTENING · VOICE ACTIVE';
    };
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((r) => r[0]?.transcript || '').join(' ').trim();
      if (text) textarea.value = text;
    };
    recognition.onerror = () => addMessage('system', 'Voice input was interrupted. Tap the head and try again, or type normally.');
    recognition.onend = () => {
      launcher?.classList.remove('listening');
      if (talk) talk.textContent = 'Talk';
      const status = overlay && $('.cb-status', overlay);
      if (status) status.textContent = 'VOICE READY · VISION READY · SECURE AI';
    };
    try { recognition.start(); } catch {}
  }

  function openBro({listen = false} = {}) {
    if (overlay) {
      if (listen) startListening();
      return;
    }

    overlay = document.createElement('section');
    overlay.className = 'cb-overlay cb-compact';
    overlay.setAttribute('aria-label', 'Chill Bro field assistant');
    overlay.innerHTML = `
      <div class="cb-head">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <img src="${V0}/chill-bro-mascot.png" alt="Chill Bro">
          <div style="min-width:0"><p class="eyebrow">Field Intelligence</p><h2 style="margin:0">CHILL BRO 2.0</h2></div>
        </div>
        <button class="cb-close" type="button" aria-label="Close Chill Bro">×</button>
      </div>
      <div class="cb-status">VOICE READY · VISION READY · SECURE AI</div>
      <div class="cb-thread"><div class="cb-msg bot">What are we working on? Talk, type, or show me the unit/data plate.</div></div>
      <div class="cb-compose">
        <textarea autocomplete="off" placeholder="Tell Chill Bro what you see, measured, or need help diagnosing…"></textarea>
        <input type="file" accept="image/*" capture="environment" hidden>
        <div class="cb-actions">
          <button data-c="talk" type="button">Talk</button>
          <button data-c="camera" type="button">Camera</button>
          <button class="primary" data-c="send" type="button">Ask Chill Bro</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    launcher?.setAttribute('aria-pressed', 'true');

    const textarea = $('textarea', overlay);
    const file = $('input[type="file"]', overlay);
    $('.cb-close', overlay).onclick = closeBro;
    $('[data-c="talk"]', overlay).onclick = startListening;
    $('[data-c="camera"]', overlay).onclick = () => file.click();
    file.onchange = (event) => {
      const selected = event.target.files?.[0];
      if (!selected) return;
      const reader = new FileReader();
      reader.onload = () => {
        pendingImage = String(reader.result || '');
        addMessage('system', 'Field image ready for inspection.');
      };
      reader.readAsDataURL(selected);
    };

    async function send() {
      const text = textarea.value.trim();
      if (!text && !pendingImage) return;
      addMessage('user', text || 'Inspect this field image.');
      textarea.value = '';
      $('.cb-status', overlay).textContent = 'THINKING · SECURE AI';
      try {
        const data = await requestChat(text);
        sessionId = data.sessionId || sessionId;
        pendingImage = '';
        addMessage('bot', data.answer || 'No response returned.');
        $('.cb-status', overlay).textContent = 'VOICE READY · VISION READY · SECURE AI';
        speak(data.answer);
      } catch (error) {
        addMessage('system', error.message || 'Chill Bro unavailable.');
        $('.cb-status', overlay).textContent = 'CONNECTION ISSUE · RETRY';
      }
    }

    $('[data-c="send"]', overlay).onclick = send;
    textarea.onkeydown = (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    };

    if (listen) window.setTimeout(startListening, 80);
  }

  function installLauncher() {
    if (document.getElementById('cpChillBroFloat')) return;
    launcher = document.createElement('button');
    launcher.id = 'cpChillBroFloat';
    launcher.className = 'cb-launch';
    launcher.type = 'button';
    launcher.setAttribute('aria-label', 'Toggle Chill Bro voice assistant');
    launcher.setAttribute('aria-pressed', 'false');
    launcher.innerHTML = `<img src="${V0}/chill-bro-mascot.png" alt="">`;
    launcher.onclick = () => {
      if (overlay) return closeBro();
      voiceEnabled = true;
      primeVoice();
      openBro({listen: true});
    };
    document.body.appendChild(launcher);
  }

  function interceptLegacyOpen(event) {
    const target = event.target.closest?.('[data-view="__bro"],#openBro');
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (overlay) closeBro();
    else {
      voiceEnabled = true;
      primeVoice();
      openBro({listen: true});
    }
  }

  document.addEventListener('click', interceptLegacyOpen, true);
  const observer = new MutationObserver(() => {
    installLauncher();
    document.querySelectorAll('.cb-overlay:not(.cb-compact)').forEach((old) => old.remove());
  });
  observer.observe(document.documentElement, {childList:true,subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installLauncher);
  else installLauncher();
})();
