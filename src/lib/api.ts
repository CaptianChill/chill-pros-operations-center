import { auth } from "./firebase";

const NATIVE_OPS_BASE =
  "https://us-central1-chill-pros-ice-stream.cloudfunctions.net/nativeOpsApi";
const JOBBER_BASE =
  "https://us-central1-chill-pros-ice-stream.cloudfunctions.net/jobberApi";

async function authedFetch(base: string, path: string, body?: unknown) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in first.");
  const token = await user.getIdToken();
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export const nativeOpsApi = {
  createQuote: (payload: unknown) => authedFetch(NATIVE_OPS_BASE, "/quotes", payload),
  approveQuote: (id: string) =>
    authedFetch(NATIVE_OPS_BASE, `/quotes/${encodeURIComponent(id)}/approve`),
  createInvoice: (payload: unknown) => authedFetch(NATIVE_OPS_BASE, "/invoices", payload),
  approveInvoice: (id: string) =>
    authedFetch(NATIVE_OPS_BASE, `/invoices/${encodeURIComponent(id)}/approve`),
  createPaymentCheckout: (invoiceId: string) =>
    authedFetch(NATIVE_OPS_BASE, "/payments/checkout", { invoiceId }),
  refreshPaymentStatus: (checkoutSessionId: string) =>
    authedFetch(NATIVE_OPS_BASE, "/payments/status", { checkoutSessionId }),
};

export const jobberApi = {
  status: () => authedFetch(JOBBER_BASE, "/status"),
  connect: () => authedFetch(JOBBER_BASE, "/connect"),
  syncClients: () => authedFetch(JOBBER_BASE, "/sync/clients"),
};
