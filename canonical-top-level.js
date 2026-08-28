(() => {
  'use strict';

  const BILL = 'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/nativeOpsApi';
  const CHILL_BRO = 'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/chillBroApi';
  const V0 = 'https://chill-pros-operation-ceneter-v2-qv0by9k5v-chill-pros.vercel.app';

  let quoteState = { quoteId: '', invoiceId: '' };
  let chillBroSessionId = '';
  let authPromptPromise = null;
  let recognition = null;
  let speakReplies = true;
  let installed = false;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[c]));
  const money = (n) => Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const buttonText = (button) => String(button?.textContent || '').replace(/\s+/g, ' ').trim();

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
      document.getElementById('cpCanonicalAuth')?.remove();
      const back = document.createElement('div');
      back.id = 'cpCanonicalAuth';
      back.className = 'cp-overlay-backdrop';
      back.innerHTML = `<section class="cp-overlay-card cp-auth-card"><header><div><small>SECURE OPERATIONS</small><h2>Sign in to continue</h2></div><button type="button" class="cp-overlay-close" aria-label="Close">×</button></header><form id="cpAuthForm"><img src="${V0}/chill-pros-command-center.png" alt="Chill Pros Command Center"><input name="email" type="email" autocomplete="username" placeholder="Chill Pros email" required><input name="password" type="password" autocomplete="current-password" placeholder="Password" required><div class="cp-overlay-error" id="cpAuthError"></div><button class="cp-overlay-primary" id="cpAuthButton" type="submit">SIGN IN</button></form></section>`;
      document.body.appendChild(back);

      const cancel = () => {
        back.remove();
        authPromptPromise = null;
        reject(new Error('Sign-in required.'));
      };
      back.querySelector('.cp-overlay-close').addEventListener('click', cancel);
      back.addEventListener('click', (event) => { if (event.target === back) cancel(); });
      back.querySelector('#cpAuthForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = back.querySelector('#cpAuthButton');
        const errorNode = back.querySelector('#cpAuthError');
        const form = new FormData(event.currentTarget);
        button.disabled = true;
        button.textContent = 'SIGNING IN…';
        errorNode.textContent = '';
        try {
          const result = await window.chillProsAuth.signInWithEmailAndPassword(
            String(form.get('email') || '').trim(),
            String(form.get('password') || '')
          );
          back.remove();
          authPromptPromise = null;
          resolve(result.user);
        } catch (error) {
          errorNode.textContent = friendlyAuthError(error);
          button.disabled = false;
          button.textContent = 'SIGN IN';
        }
      });
    });

    return authPromptPromise;
  }

  async function secure(base, path, body = {}) {
    const user = window.chillProsAuth?.currentUser || await openAuthModal();
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

  function openQuoteWorkspace() {
    document.getElementById('cpQuoteOverlay')?.remove();
    const back = document.createElement('div');
    back.id = 'cpQuoteOverlay';
    back.className = 'cp-overlay-backdrop';
    back.innerHTML = `<section class="cp-overlay-card cp-quote-card"><header><div><small>NATIVE BILLING</small><h2>Quotes & Collections</h2></div><button class="cp-overlay-close" type="button">×</button></header><div class="cp-quote-grid"><section class="cp-form-stack"><label>Customer / company<input id="cqCustomer"></label><label>Customer email<input id="cqEmail" type="email"></label><label>Job / reference<input id="cqJob"></label><label>Scope of work<textarea id="cqScope"></textarea></label><label>Line item<input id="cqDescription"></label><div class="cp-quote-row"><label>Quantity<input id="cqQty" type="number" min="1" value="1"></label><label>Unit price<input id="cqPrice" type="number" min="0" step="0.01" inputmode="decimal"></label></div><div class="cp-overlay-actions"><button class="cp-overlay-primary" id="cqSave">SAVE DRAFT</button><button class="cp-overlay-secondary" id="cqApprove" disabled>Approve Quote</button><button class="cp-overlay-primary" id="cqInvoice" disabled>Create Invoice</button><button class="cp-overlay-secondary" id="cqApproveInvoice" disabled>Approve Invoice</button><button class="cp-overlay-primary" id="cqPay" disabled>Card / ACH Link</button></div><div class="cp-overlay-status" id="cqStatus">Secure native billing ready.</div></section><section class="cp-quote-preview" id="cqPreview"></section></div></section>`;
    document.body.appendChild(back);

    back.querySelector('.cp-overlay-close').addEventListener('click', () => back.remove());
    back.addEventListener('click', (event) => { if (event.target === back) back.remove(); });

    const read = () => ({
      customerName: back.querySelector('#cqCustomer').value.trim(),
      customerEmail: back.querySelector('#cqEmail').value.trim(),
      jobId: back.querySelector('#cqJob').value.trim(),
      scope: back.querySelector('#cqScope').value.trim(),
      description: back.querySelector('#cqDescription').value.trim(),
      quantity: Math.max(1, Number(back.querySelector('#cqQty').value || 1)),
      unitPrice: Number(back.querySelector('#cqPrice').value || 0),
    });
    const preview = () => {
      const d = read();
      const total = d.quantity * d.unitPrice;
      back.querySelector('#cqPreview').innerHTML = `<div class="cp-preview-head"><div><strong>CHILL PROS</strong><span>Professional Service Quote</span></div><div>${new Date().toLocaleDateString()}</div></div><h3>${esc(d.customerName || 'Customer')}</h3><p>${esc(d.customerEmail || '')}</p><div class="cp-preview-scope">${esc(d.scope || 'Scope of work')}</div><div class="cp-preview-line"><strong>${esc(d.description || 'Service / repair')}</strong><span>Qty ${d.quantity}</span><span>${money(d.unitPrice)}</span></div><div class="cp-preview-total">Total ${money(total)}</div>`;
    };
    const status = (text, bad = false) => {
      const node = back.querySelector('#cqStatus');
      node.textContent = text;
      node.dataset.bad = bad ? '1' : '0';
    };

    back.querySelectorAll('input,textarea').forEach((field) => field.addEventListener('input', preview));
    preview();

    back.querySelector('#cqSave').addEventListener('click', async () => {
      const d = read();
      if (!d.description || !d.unitPrice) return status('Enter a line item and price first.', true);
      try {
        const out = await secure(BILL, '/quotes', {
          customerName: d.customerName,
          customerEmail: d.customerEmail,
          jobId: d.jobId || undefined,
          scope: d.scope,
          lines: [{ description: d.description, quantity: d.quantity, unitPrice: d.unitPrice }],
        });
        quoteState.quoteId = out.id;
        back.querySelector('#cqApprove').disabled = false;
        status(`Draft saved • ${money(out.total)}`);
      } catch (error) { status(error.message, true); }
    });

    back.querySelector('#cqApprove').addEventListener('click', async () => {
      if (!quoteState.quoteId) return;
      try {
        await secure(BILL, `/quotes/${encodeURIComponent(quoteState.quoteId)}/approve`, {});
        back.querySelector('#cqInvoice').disabled = false;
        status('Quote approved.');
      } catch (error) { status(error.message, true); }
    });

    back.querySelector('#cqInvoice').addEventListener('click', async () => {
      try {
        const out = await secure(BILL, '/invoices', { quoteId: quoteState.quoteId });
        quoteState.invoiceId = out.id;
        back.querySelector('#cqApproveInvoice').disabled = false;
        status(`Invoice created • ${money(out.total)}`);
      } catch (error) { status(error.message, true); }
    });

    back.querySelector('#cqApproveInvoice').addEventListener('click', async () => {
      try {
        await secure(BILL, `/invoices/${encodeURIComponent(quoteState.invoiceId)}/approve`, {});
        back.querySelector('#cqPay').disabled = false;
        status('Invoice approved.');
      } catch (error) { status(error.message, true); }
    });

    back.querySelector('#cqPay').addEventListener('click', async () => {
      const checkoutWindow = window.open('about:blank', '_blank');
      if (checkoutWindow) {
        try {
          checkoutWindow.opener = null;
          checkoutWindow.document.title = 'Opening secure checkout…';
          checkoutWindow.document.body.textContent = 'Opening secure Chill Pros card / ACH checkout…';
        } catch {}
      }
      try {
        const out = await secure(BILL, '/payments/checkout', { invoiceId: quoteState.invoiceId });
        if (!out.url) {
          checkoutWindow?.close();
          status('Checkout created, but no payment URL was returned.', true);
          return;
        }
        status('Secure card / ACH checkout created.');
        if (checkoutWindow) checkoutWindow.location.replace(out.url);
        else window.location.assign(out.url);
      } catch (error) {
        checkoutWindow?.close();
        status(error.message, true);
      }
    });
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

  function addMsg(thread, kind, text) {
    const node = document.createElement('div');
    node.className = `cp-msg ${kind}`;
    node.textContent = text;
    thread.appendChild(node);
    thread.scrollTop = thread.scrollHeight;
  }

  function openChillBro() {
    let panel = document.getElementById('cpChillBroPanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'cpChillBroPanel';
      panel.className = 'cp-chill-panel';
      panel.innerHTML = `<header><img src="/chill-bro-approved.webp" alt="Chill Bro"><div><strong>CHILL BRO</strong><small>Voice • Diagnostics • Parts • Training</small></div><button class="cp-overlay-close" type="button">×</button></header><div class="cp-overlay-status" id="cbStatus">Secure field copilot ready</div><div class="cp-chill-thread" id="cbThread"></div><div class="cp-chill-compose"><textarea id="cbInput" placeholder="Tell Chill Bro what the unit is doing…"></textarea><div class="cp-overlay-actions"><button class="cp-overlay-secondary" id="cbTalk">TALK</button><button class="cp-overlay-secondary" id="cbVoice">VOICE ON</button><button class="cp-overlay-primary" id="cbSend">ASK CHILL BRO</button></div></div>`;
      document.body.appendChild(panel);

      const thread = panel.querySelector('#cbThread');
      addMsg(thread, 'bot', 'Yo — what we got? Give me the complaint, readings, model/serial, and what you already checked.');
      panel.querySelector('.cp-overlay-close').addEventListener('click', () => panel.classList.remove('open'));
      panel.querySelector('#cbVoice').addEventListener('click', (event) => {
        speakReplies = !speakReplies;
        event.currentTarget.textContent = speakReplies ? 'VOICE ON' : 'VOICE OFF';
        if (!speakReplies) speechSynthesis?.cancel();
      });

      const send = async () => {
        const input = panel.querySelector('#cbInput');
        const message = input.value.trim();
        if (!message) return;
        addMsg(thread, 'user', message);
        input.value = '';
        panel.querySelector('#cbStatus').textContent = 'Chill Bro thinking…';
        try {
          const out = await secure(CHILL_BRO, '/chat', {
            message,
            mode: 'field-help',
            sessionId: chillBroSessionId || undefined,
            context: { pageTitle: document.title, source: 'canonical-v0-top-level' },
          });
          chillBroSessionId = out.sessionId || chillBroSessionId;
          addMsg(thread, 'bot', out.answer || 'No response returned.');
          panel.querySelector('#cbStatus').textContent = 'Ready';
          speak(out.answer);
        } catch (error) {
          addMsg(thread, 'system', error.message || 'Chill Bro unavailable.');
          panel.querySelector('#cbStatus').textContent = 'Connection issue';
        }
      };

      panel.querySelector('#cbSend').addEventListener('click', send);
      panel.querySelector('#cbInput').addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          send();
        }
      });
      panel.querySelector('#cbTalk').addEventListener('click', () => {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) {
          addMsg(thread, 'system', 'Voice recognition is not available in this browser.');
          return;
        }
        if (!recognition) {
          recognition = new Recognition();
          recognition.lang = 'en-US';
          recognition.interimResults = false;
          recognition.onresult = (event) => {
            const text = Array.from(event.results).map((result) => result[0]?.transcript || '').join(' ').trim();
            if (text) {
              panel.querySelector('#cbInput').value = text;
              send();
            }
          };
        }
        try { recognition.start(); } catch {}
      });
    }

    panel.classList.add('open');
    panel.querySelector('#cbInput')?.focus();
  }

  function actionForButton(button) {
    const text = buttonText(button);
    if (/^Quotes(?:\d+)?$/i.test(text) || /^Quote$/i.test(text) || /^Invoices\s*&\s*Payments(?:\d+)?$/i.test(text)) return 'quote';
    if (/Chill Bro/i.test(text) || /^AI Parts Intelligence$/i.test(text)) return 'chill-bro';
    return null;
  }

  function handleActionClick(event) {
    const button = event.target?.closest?.('button');
    if (!button || !button.closest('.app-shell')) return;
    const action = actionForButton(button);
    if (!action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (action === 'quote') openQuoteWorkspace();
    if (action === 'chill-bro') openChillBro();
  }

  function markActionControls() {
    document.querySelectorAll('.app-shell button').forEach((button) => {
      const action = actionForButton(button);
      if (action) button.dataset.cpCanonicalAction = action;
    });
  }

  function install() {
    if (installed) return;
    const shell = document.querySelector('.app-shell');
    if (!shell) return;
    installed = true;
    document.documentElement.dataset.cpCanonicalTopLevel = '1';

    const userBlock = document.querySelector('.sidebar-user');
    if (userBlock) {
      const avatar = userBlock.querySelector('.avatar');
      const name = userBlock.querySelector('strong');
      if (avatar) avatar.textContent = 'CP';
      if (name) name.textContent = 'Chill Pros';
    }
    const top = document.querySelector('.top-user');
    if (top) top.textContent = 'CP';

    // Window capture runs before React/root handlers. It only claims controls inside
    // the preserved v0 shell, never buttons inside canonical auth/quote/Chill Bro UI.
    window.addEventListener('click', handleActionClick, true);
    markActionControls();
    new MutationObserver(markActionControls).observe(shell, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();