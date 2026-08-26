(() => {
  "use strict";

  const API_BASE = "https://us-central1-chill-pros-ice-stream.cloudfunctions.net/nativeOpsApi";
  const state = { quoteId: "", invoiceId: "", checkoutSessionId: "", paymentUrl: "" };

  function getUser() {
    try { return window.firebase?.auth?.().currentUser || null; } catch { return null; }
  }

  async function api(path, body = {}) {
    const user = getUser();
    if (!user) throw new Error("Sign in to Chill Pros first.");
    const token = await user.getIdToken();
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Billing request failed.");
    return data;
  }

  function collectContext(panel) {
    const intake = document.getElementById("intakeForm");
    const formData = intake ? new FormData(intake) : null;
    return {
      customerName: panel.querySelector("#cbBillCustomer").value.trim() || String(formData?.get("customerName") || "").trim(),
      customerEmail: panel.querySelector("#cbBillEmail").value.trim() || String(formData?.get("email") || "").trim(),
      jobId: panel.querySelector("#cbBillJob").value.trim(),
      equipmentId: panel.querySelector("#cbBillEquipment").value.trim(),
      scope: panel.querySelector("#cbBillScope").value.trim(),
      description: panel.querySelector("#cbBillDescription").value.trim(),
      quantity: Number(panel.querySelector("#cbBillQty").value || 1),
      unitPrice: Number(panel.querySelector("#cbBillPrice").value || 0),
    };
  }

  function updateMeta(panel, message = "") {
    const meta = panel.querySelector("#cbBillMeta");
    meta.innerHTML = `${message ? `${message}<br>` : ""}<strong>Quote:</strong> ${state.quoteId || "—"} &nbsp; <strong>Invoice:</strong> ${state.invoiceId || "—"}<br><strong>Payment:</strong> ${state.checkoutSessionId || "—"}`;
  }

  async function saveQuote(panel) {
    const ctx = collectContext(panel);
    if (!ctx.description || !ctx.unitPrice) throw new Error("Enter a description and price first.");
    const data = await api("/quotes", {
      customerName: ctx.customerName,
      customerEmail: ctx.customerEmail,
      jobId: ctx.jobId || undefined,
      equipmentId: ctx.equipmentId || undefined,
      scope: ctx.scope,
      lines: [{ description: ctx.description, quantity: ctx.quantity, unitPrice: ctx.unitPrice }],
    });
    state.quoteId = data.id;
    updateMeta(panel, `Draft quote saved • $${Number(data.total || 0).toFixed(2)}`);
  }

  async function approveQuote(panel) {
    if (!state.quoteId) throw new Error("Save a quote first.");
    await api(`/quotes/${encodeURIComponent(state.quoteId)}/approve`, {});
    updateMeta(panel, "Quote owner-approved.");
  }

  async function createInvoice(panel) {
    if (!state.quoteId) throw new Error("Save a quote first.");
    const data = await api("/invoices", { quoteId: state.quoteId });
    state.invoiceId = data.id;
    updateMeta(panel, `Draft invoice created • $${Number(data.total || 0).toFixed(2)}`);
  }

  async function approveInvoice(panel) {
    if (!state.invoiceId) throw new Error("Create an invoice first.");
    await api(`/invoices/${encodeURIComponent(state.invoiceId)}/approve`, {});
    updateMeta(panel, "Invoice owner-approved.");
  }

  async function createPayment(panel) {
    if (!state.invoiceId) throw new Error("Create and approve an invoice first.");
    const data = await api("/payments/checkout", { invoiceId: state.invoiceId });
    state.checkoutSessionId = data.checkoutSessionId;
    state.paymentUrl = data.url;
    updateMeta(panel, "Secure card/ACH checkout ready.");
    if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
  }

  async function refreshPayment(panel) {
    if (!state.checkoutSessionId) throw new Error("Create a payment checkout first.");
    const data = await api("/payments/status", { checkoutSessionId: state.checkoutSessionId });
    updateMeta(panel, `Payment status: ${data.paymentStatus || data.status || "unknown"}`);
  }

  function setOpen(open) {
    const shell = document.getElementById("nativeBillingShell");
    if (!shell) return;
    shell.classList.toggle("open", open);
    shell.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) window.setTimeout(() => document.getElementById("cbBillCustomer")?.focus(), 30);
  }

  function install() {
    if (document.getElementById("nativeBillingShell")) return true;

    const launcher = document.createElement("button");
    launcher.id = "nativeBillingLauncher";
    launcher.className = "native-billing-launcher";
    launcher.type = "button";
    launcher.innerHTML = '<span>$</span><div><b>QUOTE / INVOICE</b><small>Native billing</small></div>';
    launcher.setAttribute("aria-label", "Open Chill Pros quotes and invoices");

    const shell = document.createElement("div");
    shell.id = "nativeBillingShell";
    shell.className = "native-billing-shell";
    shell.setAttribute("aria-hidden", "true");
    shell.innerHTML = `
      <section id="nativeBillingPanel" class="native-billing-panel" aria-label="Native Chill Pros billing">
        <header class="native-billing-head">
          <div><small>CHILL PROS</small><strong>Quotes, Invoices & Payments</strong></div>
          <button id="nativeBillingClose" type="button" aria-label="Close billing">×</button>
        </header>
        <div class="native-billing-grid">
          <input id="cbBillCustomer" placeholder="Customer / company">
          <input id="cbBillEmail" type="email" placeholder="Customer email">
          <input id="cbBillJob" placeholder="Job ID (optional)">
          <input id="cbBillEquipment" placeholder="Equipment ID (optional)">
          <input id="cbBillQty" type="number" min="1" step="1" value="1" placeholder="Qty">
          <input id="cbBillPrice" type="number" min="0" step="0.01" placeholder="Unit price">
          <textarea id="cbBillScope" placeholder="Scope of work"></textarea>
          <input id="cbBillDescription" placeholder="Line item / repair description">
        </div>
        <div class="native-billing-actions">
          <button type="button" data-bill="save-quote">Save Draft Quote</button>
          <button type="button" class="secondary" data-bill="approve-quote">Approve Quote</button>
          <button type="button" data-bill="create-invoice">Create Invoice</button>
          <button type="button" class="secondary" data-bill="approve-invoice">Approve Invoice</button>
          <button type="button" data-bill="payment">Card / ACH Link</button>
          <button type="button" class="secondary" data-bill="refresh">Refresh Payment</button>
        </div>
        <div id="cbBillMeta" class="native-billing-meta"></div>
      </section>`;

    document.body.appendChild(launcher);
    document.body.appendChild(shell);
    const panel = document.getElementById("nativeBillingPanel");
    updateMeta(panel, "Native Chill Pros billing ready.");

    launcher.addEventListener("click", () => setOpen(true));
    shell.addEventListener("click", (event) => {
      if (event.target === shell) setOpen(false);
    });
    document.getElementById("nativeBillingClose")?.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });

    panel.addEventListener("click", async (event) => {
      const action = event.target?.dataset?.bill;
      if (!action) return;
      const button = event.target;
      button.disabled = true;
      try {
        if (action === "save-quote") await saveQuote(panel);
        if (action === "approve-quote") await approveQuote(panel);
        if (action === "create-invoice") await createInvoice(panel);
        if (action === "approve-invoice") await approveInvoice(panel);
        if (action === "payment") await createPayment(panel);
        if (action === "refresh") await refreshPayment(panel);
      } catch (error) {
        updateMeta(panel, error.message || "Billing action failed.");
      } finally {
        button.disabled = false;
      }
    });

    window.openNativeBilling = () => setOpen(true);
    window.closeNativeBilling = () => setOpen(false);
    return true;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();
