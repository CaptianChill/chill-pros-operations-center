(() => {
  'use strict';

  const QUOTES_KEY = 'chillProsStandalone:quotes:v1';
  const INVOICES_KEY = 'chillProsStandalone:invoices:v1';
  const PARTS_KEY = 'chillProsStandalone:parts:v1';
  const RESEARCH_KEY = 'chillProsStandalone:partResearch:v1';

  const safeRead = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  };

  let quotes = safeRead(QUOTES_KEY);
  let invoices = safeRead(INVOICES_KEY);
  let parts = safeRead(PARTS_KEY);
  let research = safeRead(RESEARCH_KEY);

  const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
  const html = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const queueRecords = () => (typeof queue !== 'undefined' && Array.isArray(queue) ? queue : []);

  function saveAll() {
    localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
    localStorage.setItem(PARTS_KEY, JSON.stringify(parts));
    localStorage.setItem(RESEARCH_KEY, JSON.stringify(research));
    renderAll();
  }

  async function mirror(collection, record) {
    try {
      if (typeof db === 'undefined' || !db) return;
      await db.collection(collection).doc(record.id).set(record, { merge: true });
    } catch (error) {
      console.warn(`Unable to mirror ${collection}`, error);
    }
  }

  function getJob(jobId) {
    return queueRecords().find((record) => record.id === jobId || record.firestoreId === jobId) || null;
  }

  function jobOptions(selected = '') {
    return ['<option value="">Select service call</option>', ...queueRecords().map((job) => {
      const id = job.id || job.firestoreId;
      const label = `${job.customerName || 'Unnamed Customer'} • ${job.equipmentType || 'Equipment'} • ${job.modelNumber || 'No model'}`;
      return `<option value="${html(id)}"${id === selected ? ' selected' : ''}>${html(label)}</option>`;
    })].join('');
  }

  function lineTotal(line) {
    return Number(line.quantity || 0) * Number(line.unitPrice || 0);
  }

  function totals(record) {
    const subtotal = (record.lineItems || []).reduce((sum, line) => sum + lineTotal(line), 0);
    const discount = Number(record.discount || 0);
    const taxable = Math.max(0, subtotal - discount);
    const tax = taxable * (Number(record.taxRate || 0) / 100);
    const total = taxable + tax;
    return { subtotal, discount, tax, total };
  }

  function makeQuote(job, data) {
    const now = new Date().toISOString();
    return {
      id: uid('Q'),
      jobId: job.id || job.firestoreId,
      customerName: job.customerName || '',
      customerId: job.customerId || job.firestoreId || job.id || '',
      assetId: job.assetId || '',
      equipmentType: job.equipmentType || '',
      manufacturer: job.manufacturer || '',
      modelNumber: job.modelNumber || '',
      serialNumber: job.serialNumber || '',
      complaint: job.complaint || '',
      diagnosis: job.findings || '',
      recommendation: job.recommendation || '',
      lineItems: data.lineItems,
      taxRate: Number(data.taxRate || 0),
      discount: Number(data.discount || 0),
      depositRequired: Number(data.depositRequired || 0),
      approvalStatus: 'draft',
      createdAt: now,
      updatedAt: now
    };
  }

  async function createQuoteFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const job = getJob(data.jobId);
    if (!job) return window.alert('Select a service call first.');

    const qty = Number(data.quantity || 1);
    const price = Number(data.unitPrice || 0);
    const lineItems = [{
      id: uid('LI'),
      type: data.lineType || 'labor',
      description: data.description || 'Service',
      quantity: qty,
      unitPrice: price,
      partId: data.partId || ''
    }];
    const quote = makeQuote(job, { ...data, lineItems });
    quotes.unshift(quote);
    await mirror('Quotes', quote);
    saveAll();
    form.reset();
    const selector = form.querySelector('[name="jobId"]');
    if (selector) selector.innerHTML = jobOptions();
    if (typeof toast === 'function') toast('Draft quote created');
  }

  async function setQuoteStatus(id, status) {
    const quote = quotes.find((item) => item.id === id);
    if (!quote) return;
    quote.approvalStatus = status;
    quote.updatedAt = new Date().toISOString();
    if (status === 'approved') quote.approvedAt = quote.updatedAt;
    await mirror('Quotes', quote);
    saveAll();
  }

  async function convertQuoteToInvoice(id) {
    const quote = quotes.find((item) => item.id === id);
    if (!quote) return;
    const existing = invoices.find((invoice) => invoice.quoteId === quote.id);
    if (existing) {
      if (typeof toast === 'function') toast('Invoice already exists');
      return;
    }
    const quoteTotals = totals(quote);
    const now = new Date().toISOString();
    const invoice = {
      id: uid('INV'),
      quoteId: quote.id,
      jobId: quote.jobId,
      customerId: quote.customerId,
      customerName: quote.customerName,
      assetId: quote.assetId,
      equipmentType: quote.equipmentType,
      manufacturer: quote.manufacturer,
      modelNumber: quote.modelNumber,
      serialNumber: quote.serialNumber,
      lineItems: structuredClone(quote.lineItems || []),
      taxRate: quote.taxRate,
      discount: quote.discount,
      total: quoteTotals.total,
      amountPaid: 0,
      balanceDue: quoteTotals.total,
      paymentStatus: 'draft',
      createdAt: now,
      updatedAt: now
    };
    invoices.unshift(invoice);
    quote.approvalStatus = 'converted';
    quote.updatedAt = now;
    await Promise.all([mirror('Invoices', invoice), mirror('Quotes', quote)]);
    saveAll();
    if (typeof toast === 'function') toast('Quote converted to invoice');
  }

  async function recordPayment(invoiceId) {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice) return;
    const raw = window.prompt(`Payment amount. Balance due: ${money(invoice.balanceDue)}`, String(invoice.balanceDue || ''));
    if (raw === null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return window.alert('Enter a valid payment amount.');
    invoice.amountPaid = Math.min(Number(invoice.total || 0), Number(invoice.amountPaid || 0) + amount);
    invoice.balanceDue = Math.max(0, Number(invoice.total || 0) - invoice.amountPaid);
    invoice.paymentStatus = invoice.balanceDue <= 0 ? 'paid' : 'partial';
    invoice.updatedAt = new Date().toISOString();
    await mirror('Invoices', invoice);
    saveAll();
    if (typeof toast === 'function') toast('Payment recorded');
  }

  async function savePartResearch(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const job = getJob(data.jobId);
    if (!job) return window.alert('Select a service call first.');
    const now = new Date().toISOString();
    const record = {
      id: uid('PR'),
      jobId: job.id || job.firestoreId,
      assetId: job.assetId || '',
      manufacturer: job.manufacturer || data.manufacturer || '',
      modelNumber: job.modelNumber || data.modelNumber || '',
      serialNumber: job.serialNumber || data.serialNumber || '',
      symptom: job.complaint || data.symptom || '',
      query: data.query || '',
      candidatePartNumber: data.partNumber || '',
      candidateDescription: data.partDescription || '',
      evidence: data.evidence || '',
      confidence: data.confidence || 'unverified',
      vendor: data.vendor || '',
      cost: Number(data.cost || 0),
      sellPrice: Number(data.sellPrice || 0),
      reviewed: false,
      createdAt: now,
      updatedAt: now
    };
    research.unshift(record);
    await mirror('PartResearch', record);
    saveAll();
    if (typeof toast === 'function') toast('Parts research saved for review');
  }

  async function approveResearch(id) {
    const record = research.find((item) => item.id === id);
    if (!record) return;
    record.reviewed = true;
    record.reviewedAt = new Date().toISOString();
    const part = {
      id: uid('PART'),
      researchId: record.id,
      partNumber: record.candidatePartNumber,
      manufacturer: record.manufacturer,
      description: record.candidateDescription,
      vendor: record.vendor,
      unitCost: record.cost,
      sellPrice: record.sellPrice,
      availability: 'research approved',
      createdAt: record.reviewedAt
    };
    parts.unshift(part);
    await Promise.all([mirror('PartResearch', record), mirror('Parts', part)]);
    saveAll();
    if (typeof toast === 'function') toast('Part approved into Parts Library');
  }

  function addPartToQuote(researchId) {
    const record = research.find((item) => item.id === researchId);
    if (!record || !record.reviewed) return window.alert('Approve the research first.');
    const targetQuotes = quotes.filter((quote) => quote.jobId === record.jobId && ['draft', 'office_review'].includes(quote.approvalStatus));
    const quote = targetQuotes[0];
    if (!quote) return window.alert('Create a draft quote for this service call first.');
    quote.lineItems.push({
      id: uid('LI'),
      type: 'part',
      description: `${record.candidatePartNumber || 'Part'} ${record.candidateDescription || ''}`.trim(),
      quantity: 1,
      unitPrice: Number(record.sellPrice || 0),
      researchId: record.id
    });
    quote.updatedAt = new Date().toISOString();
    mirror('Quotes', quote);
    saveAll();
    if (typeof toast === 'function') toast('Approved part added to quote');
  }

  function renderQuotes() {
    const list = document.getElementById('quotesList');
    const selector = document.querySelector('#quoteForm [name="jobId"]');
    if (selector) {
      const selected = selector.value;
      selector.innerHTML = jobOptions(selected);
    }
    if (!list) return;
    list.innerHTML = quotes.length ? quotes.map((quote) => {
      const t = totals(quote);
      return `<article class="standalone-card"><div><h3>${html(quote.id)} • ${html(quote.customerName)}</h3><p>${html(quote.equipmentType)} • ${html(quote.manufacturer)} ${html(quote.modelNumber)}</p><p>${quote.lineItems.map((line) => `${html(line.description)} × ${html(line.quantity)} = ${money(lineTotal(line))}`).join('<br>')}</p></div><div class="standalone-money"><strong>${money(t.total)}</strong><span class="state-pill">${html(quote.approvalStatus)}</span><div class="standalone-actions"><button data-quote-status="office_review" data-id="${html(quote.id)}">Office Review</button><button data-quote-status="sent" data-id="${html(quote.id)}">Mark Sent</button><button data-quote-status="approved" data-id="${html(quote.id)}">Approve</button><button data-convert-invoice data-id="${html(quote.id)}" ${quote.approvalStatus !== 'approved' ? 'disabled' : ''}>Create Invoice</button></div></div></article>`;
    }).join('') : '<article class="standalone-card"><div><h3>No quotes yet</h3><p>Create one from an existing service call. Customer and equipment context will be carried forward automatically.</p></div></article>';
  }

  function renderInvoices() {
    const list = document.getElementById('invoicesList');
    if (!list) return;
    list.innerHTML = invoices.length ? invoices.map((invoice) => `<article class="standalone-card"><div><h3>${html(invoice.id)} • ${html(invoice.customerName)}</h3><p>From quote ${html(invoice.quoteId)} • Job ${html(invoice.jobId)}</p><p>${html(invoice.equipmentType)} • ${html(invoice.manufacturer)} ${html(invoice.modelNumber)}</p></div><div class="standalone-money"><strong>${money(invoice.total)}</strong><span>${money(invoice.balanceDue)} due</span><span class="state-pill">${html(invoice.paymentStatus)}</span><button data-record-payment data-id="${html(invoice.id)}">Record Payment</button></div></article>`).join('') : '<article class="standalone-card"><div><h3>No invoices yet</h3><p>Approve a quote, then convert it to an invoice without re-entering service-call information.</p></div></article>';
  }

  function renderResearch() {
    const list = document.getElementById('partResearchList');
    const selector = document.querySelector('#partResearchForm [name="jobId"]');
    if (selector) {
      const selected = selector.value;
      selector.innerHTML = jobOptions(selected);
    }
    if (!list) return;
    list.innerHTML = research.length ? research.map((item) => `<article class="standalone-card"><div><h3>${html(item.candidatePartNumber || 'Part candidate')} • ${html(item.candidateDescription || '')}</h3><p>${html(item.manufacturer)} ${html(item.modelNumber)} • Job ${html(item.jobId)}</p><p>${html(item.evidence || 'Evidence/source not recorded')}</p><p>Vendor: ${html(item.vendor || 'not set')} • Cost ${money(item.cost)} • Sell ${money(item.sellPrice)}</p></div><div class="standalone-money"><span class="state-pill">${item.reviewed ? 'approved' : html(item.confidence)}</span><div class="standalone-actions"><button data-approve-research data-id="${html(item.id)}" ${item.reviewed ? 'disabled' : ''}>Approve Part</button><button data-add-part-quote data-id="${html(item.id)}" ${item.reviewed ? '' : 'disabled'}>Add to Quote</button></div></div></article>`).join('') : '<article class="standalone-card"><div><h3>No parts research saved</h3><p>Select a service call so manufacturer, model, serial and complaint stay tied to the research record.</p></div></article>';
  }

  function prefillResearchFromJob() {
    const form = document.getElementById('partResearchForm');
    if (!form) return;
    const job = getJob(form.jobId.value);
    if (!job) return;
    form.manufacturer.value = job.manufacturer || '';
    form.modelNumber.value = job.modelNumber || '';
    form.serialNumber.value = job.serialNumber || '';
    form.symptom.value = job.complaint || '';
    form.query.value = [job.equipmentType, job.manufacturer, job.modelNumber, job.complaint].filter(Boolean).join(' • ');
  }

  function renderAll() {
    renderQuotes();
    renderInvoices();
    renderResearch();
    const quotesCount = document.getElementById('standaloneQuotesCount');
    const invoiceCount = document.getElementById('standaloneInvoicesCount');
    if (quotesCount) quotesCount.textContent = quotes.filter((q) => q.approvalStatus !== 'converted').length;
    if (invoiceCount) invoiceCount.textContent = invoices.filter((i) => i.paymentStatus !== 'paid').length;
  }

  document.getElementById('quoteForm')?.addEventListener('submit', createQuoteFromForm);
  document.getElementById('partResearchForm')?.addEventListener('submit', savePartResearch);
  document.querySelector('#partResearchForm [name="jobId"]')?.addEventListener('change', prefillResearchFromJob);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.quoteStatus) setQuoteStatus(id, button.dataset.quoteStatus);
    if (button.hasAttribute('data-convert-invoice')) convertQuoteToInvoice(id);
    if (button.hasAttribute('data-record-payment')) recordPayment(id);
    if (button.hasAttribute('data-approve-research')) approveResearch(id);
    if (button.hasAttribute('data-add-part-quote')) addPartToQuote(id);
  });

  window.addEventListener('storage', renderAll);
  document.addEventListener('chillpros:queue-updated', renderAll);
  window.setInterval(renderAll, 5000);
  renderAll();
})();