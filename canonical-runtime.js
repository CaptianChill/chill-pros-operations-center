(() => {
  'use strict';

  const V0 = 'https://chill-pros-operation-ceneter-v2.vercel.app';
  const BILL = 'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/nativeOpsApi';
  const CHILL_BRO = 'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/chillBroApi';
  const root = document.getElementById('appRoot');
  let frame = null;
  let quoteState = { quoteId: '', invoiceId: '', checkoutSessionId: '' };
  let chillBroSessionId = '';
  let recognition = null;
  let speakReplies = true;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));
  const money = (n) => Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  function clearRoot() {
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  function friendlyAuthError(error) {
    const code = String(error?.code || error?.message || '');
    if (/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD/i.test(code)) return 'Email or password is incorrect.';
    if (/TOO_MANY_ATTEMPTS/i.test(code)) return 'Too many attempts. Try again shortly.';
    if (/AbortError|aborted|timeout/i.test(code)) return 'Sign-in timed out. Check the connection and retry.';
    return error?.message || 'Sign-in failed.';
  }

  function renderLogin() {
    clearRoot();
    const wrap = document.createElement('main');
    wrap.className = 'cp-login';
    wrap.innerHTML = `<section class="cp-login-card"><img class="cp-login-logo" src="${V0}/chill-pros-command-center.png" alt="Chill Pros Command Center"><div class="cp-login-eyebrow">SECURE OPERATIONS ACCESS</div><h1>Chill Pros Operations Center</h1><p>Owner and staff access to dispatch, field intelligence, quotes and Chill Bro.</p><form class="cp-login-form" id="canonicalLogin"><input name="email" type="email" autocomplete="username" placeholder="Chill Pros email" required><input name="password" type="password" autocomplete="current-password" placeholder="Password" required><div class="cp-login-error" id="canonicalLoginError"></div><button class="cp-login-button" id="canonicalLoginButton" type="submit">SIGN IN</button></form></section>`;
    root.appendChild(wrap);
    const form = wrap.querySelector('#canonicalLogin');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = wrap.querySelector('#canonicalLoginButton');
      const errorNode = wrap.querySelector('#canonicalLoginError');
      const data = new FormData(form);
      button.disabled = true;
      button.textContent = 'SIGNING IN…';
      errorNode.textContent = '';
      try {
        await window.chillProsAuth.signInWithEmailAndPassword(String(data.get('email') || '').trim(), String(data.get('password') || ''));
      } catch (error) {
        errorNode.textContent = friendlyAuthError(error);
        button.disabled = false;
        button.textContent = 'SIGN IN';
      }
    });
  }

  function renderVisualFailure(message) {
    clearRoot();
    const node = document.createElement('main');
    node.className = 'cp-visual-failure';
    node.innerHTML = `<div><h1>Operations Center visual source unavailable</h1><p>${esc(message)}</p><button class="cp-primary" id="retryVisual">Retry</button></div>`;
    root.appendChild(node);
    node.querySelector('#retryVisual').onclick = renderApp;
  }

  function patchVisualDocument(doc) {
    if (!doc || doc.documentElement.dataset.cpCanonicalHook === '1') return;
    doc.documentElement.dataset.cpCanonicalHook = '1';

    const patchIdentity = () => {
      const sidebar = doc.querySelector('.sidebar-user');
      if (sidebar) {
        const avatar = sidebar.querySelector('.avatar');
        const strong = sidebar.querySelector('strong');
        const span = sidebar.querySelector('span:not(.avatar)');
        if (avatar) avatar.textContent = 'CP';
        if (strong) strong.textContent = 'Chill Pros';
        if (span) span.textContent = 'Owner / Admin';
      }
      const topUser = doc.querySelector('.top-user');
      if (topUser) topUser.textContent = 'CP';
      const subhead = doc.querySelector('.page-title-row .subhead');
      if (subhead && /August 25, 2026/i.test(subhead.textContent || '')) {
        const live = subhead.querySelector('.live-indicator');
        subhead.childNodes[0].textContent = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }) + ' ';
        if (live && !subhead.contains(live)) subhead.appendChild(live);
      }
    };

    doc.addEventListener('click', (event) => {
      const button = event.target?.closest?.('button');
      if (!button) return;
      const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^Quotes\b|^Quote$/i.test(text) || /^Invoices\s*&\s*Payments/i.test(text)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openQuoteWorkspace();
        return;
      }
      if (/Chill Bro/i.test(text)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openChillBro();
      }
    }, true);

    new MutationObserver(patchIdentity).observe(doc.documentElement, { childList: true, subtree: true });
    patchIdentity();
  }

  function installFloatingChillBro() {
    document.getElementById('canonicalChillBroLauncher')?.remove();
    const launcher = document.createElement('button');
    launcher.id = 'canonicalChillBroLauncher';
    launcher.className = 'chill-bro-launch';
    launcher.type = 'button';
    launcher.setAttribute('aria-label', 'Open Chill Bro');
    launcher.innerHTML = '<img src="chill-bro-approved.webp" alt="Chill Bro">';
    launcher.onclick = openChillBro;
    document.body.appendChild(launcher);
  }

  function renderApp() {
    clearRoot();
    frame = document.createElement('iframe');
    frame.className = 'canonical-frame';
    frame.title = 'Chill Pros Operations Center';
    frame.src = `/api/v0-visual?build=canonical-${Date.now()}`;
    frame.addEventListener('load', () => {
      try {
        const doc = frame.contentDocument;
        if (!doc?.querySelector('.app-shell')) {
          renderVisualFailure('The preserved v0 visual contract did not render correctly.');
          return;
        }
        patchVisualDocument(doc);
        installFloatingChillBro();
      } catch (error) {
        renderVisualFailure(error?.message || 'Unable to access the visual contract.');
      }
    });
    root.appendChild(frame);
  }

  async function secure(base, path, body = {}) {
    const user = window.chillProsAuth.currentUser;
    if (!user) throw new Error('Sign in to Chill Pros first.');
    const token = await user.getIdToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(base + path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  function quoteData(workspace) {
    const q = (id) => workspace.querySelector(id);
    return {
      customerName: q('#cqCustomer').value.trim(),
      customerEmail: q('#cqEmail').value.trim(),
      jobId: q('#cqJob').value.trim(),
      scope: q('#cqScope').value.trim(),
      description: q('#cqDescription').value.trim(),
      quantity: Math.max(1, Number(q('#cqQty').value || 1)),
      unitPrice: Number(q('#cqPrice').value || 0),
    };
  }

  function renderQuotePreview(workspace) {
    const d = quoteData(workspace);
    const total = d.quantity * d.unitPrice;
    workspace.querySelector('#cqPreview').innerHTML = `<div class="cp-preview-head"><div><img src="cp-app-icon.png" alt="Chill Pros"><h2>CHILL PROS</h2><div>Professional Service Quote</div></div><div class="cp-preview-meta">${quoteState.quoteId ? `Quote ID<br><strong>${esc(quoteState.quoteId)}</strong><br><br>` : ''}${new Date().toLocaleDateString()}</div></div><div class="cp-preview-customer"><strong>${esc(d.customerName || 'Customer')}</strong><div>${esc(d.customerEmail || 'Customer email')}</div>${d.jobId ? `<div>Reference: ${esc(d.jobId)}</div>` : ''}</div><div class="cp-preview-scope">${esc(d.scope || 'Scope of work will appear here.')}</div><div class="cp-preview-line"><strong>${esc(d.description || 'Service / repair')}</strong><span>Qty ${d.quantity}</span><span>${money(d.unitPrice)}</span></div><div class="cp-preview-total"><span>Total</span><span>${money(total)}</span></div>`;
  }

  function quoteMessage(workspace, text, mode = '') {
    const node = workspace.querySelector('#cqStatus');
    node.textContent = text;
    node.className = `cp-status ${mode}`.trim();
  }

  function openQuoteWorkspace() {
    document.getElementById('canonicalQuoteBackdrop')?.remove();
    const backdrop = document.createElement('div');
    backdrop.id = 'canonicalQuoteBackdrop';
    backdrop.className = 'cp-workspace-backdrop';
    backdrop.innerHTML = `<section class="cp-workspace"><header class="cp-workspace-head"><div><div class="cp-login-eyebrow" style="text-align:left">NATIVE BILLING</div><h2>Quotes & Collections</h2></div><button class="cp-close" id="cqClose" type="button">×</button></header><div class="cp-quote-grid"><section class="cp-card cp-stack"><div class="cp-field"><label>Customer / company</label><input id="cqCustomer"></div><div class="cp-field"><label>Customer email</label><input id="cqEmail" type="email"></div><div class="cp-field"><label>Job / reference</label><input id="cqJob"></div><div class="cp-field"><label>Scope of work</label><textarea id="cqScope"></textarea></div><div class="cp-field"><label>Line item</label><input id="cqDescription"></div><div class="cp-row"><div class="cp-field"><label>Quantity</label><input id="cqQty" type="number" min="1" value="1"></div><div class="cp-field"><label>Unit price</label><input id="cqPrice" type="number" min="0" step="0.01" inputmode="decimal"></div></div><div class="cp-actions"><button class="cp-primary" id="cqSave">SAVE DRAFT</button><button class="cp-secondary" id="cqApprove" disabled>Approve Quote</button></div><div class="cp-actions"><button class="cp-primary" id="cqInvoice" disabled>Create Invoice</button><button class="cp-secondary" id="cqApproveInvoice" disabled>Approve Invoice</button><button class="cp-primary" id="cqPay" disabled>Card / ACH Link</button></div><div class="cp-status" id="cqStatus">Secure native billing ready.</div></section><section class="cp-card"><div class="cp-preview" id="cqPreview"></div></section></div></section>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#cqClose').onclick = () => backdrop.remove();
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.remove(); });
    backdrop.querySelectorAll('input,textarea').forEach((field) => field.addEventListener('input', () => renderQuotePreview(backdrop)));
    renderQuotePreview(backdrop);

    backdrop.querySelector('#cqSave').onclick = async (event) => {
      const d = quoteData(backdrop);
      if (!d.description || !d.unitPrice) return quoteMessage(backdrop, 'Enter a line item and price first.', 'bad');
      const button = event.currentTarget;
      button.disabled = true; button.textContent = 'SAVING…';
      try {
        const out = await secure(BILL, '/quotes', { customerName:d.customerName, customerEmail:d.customerEmail, jobId:d.jobId || undefined, scope:d.scope, lines:[{ description:d.description, quantity:d.quantity, unitPrice:d.unitPrice }] });
        quoteState.quoteId = out.id;
        backdrop.querySelector('#cqApprove').disabled = false;
        renderQuotePreview(backdrop);
        quoteMessage(backdrop, `Draft saved • ${money(out.total)}`, 'ok');
      } catch (error) { quoteMessage(backdrop, error.name === 'AbortError' ? 'Quote service timed out.' : error.message, 'bad'); }
      finally { button.disabled = false; button.textContent = 'SAVE DRAFT'; }
    };

    backdrop.querySelector('#cqApprove').onclick = async (event) => {
      if (!quoteState.quoteId) return;
      const button = event.currentTarget; button.disabled = true;
      try {
        await secure(BILL, `/quotes/${encodeURIComponent(quoteState.quoteId)}/approve`, {});
        backdrop.querySelector('#cqInvoice').disabled = false;
        quoteMessage(backdrop, 'Quote approved.', 'ok');
      } catch (error) { button.disabled = false; quoteMessage(backdrop, error.message, 'bad'); }
    };

    backdrop.querySelector('#cqInvoice').onclick = async (event) => {
      const button = event.currentTarget; button.disabled = true;
      try {
        const out = await secure(BILL, '/invoices', { quoteId: quoteState.quoteId });
        quoteState.invoiceId = out.id;
        backdrop.querySelector('#cqApproveInvoice').disabled = false;
        quoteMessage(backdrop, `Invoice created • ${money(out.total)}`, 'ok');
      } catch (error) { button.disabled = false; quoteMessage(backdrop, error.message, 'bad'); }
    };

    backdrop.querySelector('#cqApproveInvoice').onclick = async (event) => {
      const button = event.currentTarget; button.disabled = true;
      try {
        await secure(BILL, `/invoices/${encodeURIComponent(quoteState.invoiceId)}/approve`, {});
        backdrop.querySelector('#cqPay').disabled = false;
        quoteMessage(backdrop, 'Invoice approved.', 'ok');
      } catch (error) { button.disabled = false; quoteMessage(backdrop, error.message, 'bad'); }
    };

    backdrop.querySelector('#cqPay').onclick = async () => {
      try {
        const out = await secure(BILL, '/payments/checkout', { invoiceId: quoteState.invoiceId });
        quoteState.checkoutSessionId = out.checkoutSessionId || '';
        quoteMessage(backdrop, 'Secure card / ACH checkout created.', 'ok');
        if (out.url) window.open(out.url, '_blank', 'noopener,noreferrer');
      } catch (error) { quoteMessage(backdrop, error.message, 'bad'); }
    };
  }

  function addChillBroMessage(thread, kind, text) {
    const node = document.createElement('div');
    node.className = `cb-msg ${kind}`;
    node.textContent = text;
    thread.appendChild(node);
    thread.scrollTop = thread.scrollHeight;
  }

  function speak(text) {
    if (!speakReplies || !window.speechSynthesis || !text) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.03;
    utterance.pitch = 0.94;
    speechSynthesis.speak(utterance);
  }

  function openChillBro() {
    let panel = document.getElementById('canonicalChillBroPanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'canonicalChillBroPanel';
      panel.className = 'chill-bro-panel';
      panel.innerHTML = `<header class="cb-head"><img src="chill-bro-approved.webp" alt="Chill Bro"><div><strong>CHILL BRO</strong><small>Voice • Vision • Diagnostics • Parts • Training</small></div><button class="cb-close" type="button">×</button></header><div class="cb-status" id="cbStatus">Secure field copilot ready</div><div class="cb-thread" id="cbThread"></div><div class="cb-compose"><textarea id="cbInput" placeholder="Tell Chill Bro what the unit is doing…"></textarea><div class="cb-actions"><button class="cp-secondary" id="cbTalk" type="button">TALK</button><button class="cp-secondary" id="cbVoice" type="button">VOICE ON</button><button class="cp-primary" id="cbSend" type="button">ASK CHILL BRO</button></div></div>`;
      document.body.appendChild(panel);
      const thread = panel.querySelector('#cbThread');
      addChillBroMessage(thread, 'bot', 'Yo — what we got? Give me the complaint, readings, model/serial, and what you already checked.');
      panel.querySelector('.cb-close').onclick = () => panel.classList.remove('open');
      panel.querySelector('#cbVoice').onclick = (event) => { speakReplies = !speakReplies; event.currentTarget.textContent = speakReplies ? 'VOICE ON' : 'VOICE OFF'; if (!speakReplies) speechSynthesis?.cancel(); };
      const send = async () => {
        const input = panel.querySelector('#cbInput');
        const message = input.value.trim();
        if (!message) return;
        addChillBroMessage(thread, 'user', message);
        input.value = '';
        panel.querySelector('#cbStatus').textContent = 'Chill Bro thinking…';
        try {
          const out = await secure(CHILL_BRO, '/chat', { message, mode:'field-help', sessionId:chillBroSessionId || undefined, context:{ pageTitle:document.title, source:'canonical-v0' } });
          chillBroSessionId = out.sessionId || chillBroSessionId;
          addChillBroMessage(thread, 'bot', out.answer || 'No response returned.');
          panel.querySelector('#cbStatus').textContent = 'Ready';
          speak(out.answer);
        } catch (error) {
          addChillBroMessage(thread, 'system', error.message || 'Chill Bro unavailable.');
          panel.querySelector('#cbStatus').textContent = 'Connection issue';
        }
      };
      panel.querySelector('#cbSend').onclick = send;
      panel.querySelector('#cbInput').addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } });
      panel.querySelector('#cbTalk').onclick = () => {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) { addChillBroMessage(thread, 'system', 'Voice recognition is not available in this browser.'); return; }
        if (!recognition) {
          recognition = new Recognition(); recognition.lang = 'en-US'; recognition.interimResults = false; recognition.continuous = false;
          recognition.onresult = (event) => { const text = Array.from(event.results).map((r) => r[0]?.transcript || '').join(' ').trim(); if (text) { panel.querySelector('#cbInput').value = text; send(); } };
          recognition.onstart = () => { panel.querySelector('#cbStatus').textContent = 'Listening…'; };
          recognition.onend = () => { if (panel.querySelector('#cbStatus').textContent === 'Listening…') panel.querySelector('#cbStatus').textContent = 'Ready'; };
        }
        try { recognition.start(); } catch {}
      };
    }
    panel.classList.add('open');
    panel.querySelector('#cbInput')?.focus();
  }

  window.chillProsAuth.onAuthStateChanged((user) => {
    document.getElementById('canonicalChillBroLauncher')?.remove();
    document.getElementById('canonicalChillBroPanel')?.remove();
    document.getElementById('canonicalQuoteBackdrop')?.remove();
    if (user) renderApp(); else renderLogin();
  });
})();
