"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { nativeOpsApi } from "@/lib/api";
import { byCreatedDesc, useCollection } from "@/lib/firestore-collections";
import type { Customer, Invoice, Quote, QuoteInvoiceLine, RateItem } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { formatMoney } from "@/lib/job-format";

function BillingContent() {
  const searchParams = useSearchParams();
  const { data: customers } = useCollection<Customer>("Customers");
  const { data: rateItems } = useCollection<RateItem>("RateBook");
  const { data: quotes } = useCollection<Quote>("quotes", byCreatedDesc);
  const { data: invoices } = useCollection<Invoice>("invoices", byCreatedDesc);

  const [customerId, setCustomerId] = useState(searchParams.get("customerId") || "");
  const [scope, setScope] = useState("");
  const [lines, setLines] = useState<QuoteInvoiceLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const jobId = searchParams.get("jobId") || undefined;
  const customer = customers.find((c) => c.id === customerId);
  const total = useMemo(() => lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0), [lines]);

  function addRateItem(item: RateItem) {
    setLines((prev) => [...prev, { description: item.name, quantity: 1, unitPrice: item.price }]);
  }

  function addBlankLine() {
    setLines((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  }

  function updateLine(index: number, patch: Partial<QuoteInvoiceLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateQuote() {
    if (!lines.length) {
      setMessage("Add at least one line item first.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await nativeOpsApi.createQuote({
        customerId: customerId || undefined,
        customerName: customer?.companyName || customer?.contactName,
        customerEmail: customer?.email,
        jobId,
        scope,
        lines,
      });
      setLines([]);
      setScope("");
      setMessage("Draft quote saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save quote.");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Quotes & Billing" subtitle="Build quotes, approve invoices, and collect payment." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink-700">New quote</h2>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Field label="Customer">
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Walk-in / not on file</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName || c.contactName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Scope of work">
              <Input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Brief scope" />
            </Field>
          </div>

          <div className="mb-3 rounded-lg border border-ink-100">
            {lines.length === 0 ? (
              <p className="p-4 text-sm text-ink-400">No line items yet. Add from the rate book or a blank line.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index} className="border-b border-ink-100 last:border-0">
                      <td className="w-1/2 p-2">
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(index, { description: e.target.value })}
                          placeholder="Description"
                        />
                      </td>
                      <td className="w-20 p-2">
                        <Input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 1 })}
                        />
                      </td>
                      <td className="w-28 p-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="w-10 p-2 text-right">
                        <button onClick={() => removeLine(index)} className="text-ink-300 hover:text-rose-500">
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mb-4 flex items-center justify-between">
            <Button variant="secondary" onClick={addBlankLine}>
              + Blank line
            </Button>
            <p className="text-lg font-bold text-ink-900">{formatMoney(total)}</p>
          </div>

          {message && <p className="mb-3 text-sm text-ink-500">{message}</p>}

          <Button onClick={handleCreateQuote} disabled={busy}>
            Save draft quote
          </Button>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Rate book</h2>
          <div className="scroll-thin max-h-96 space-y-1 overflow-y-auto">
            {rateItems.length === 0 ? (
              <p className="text-sm text-ink-400">
                No rates configured yet. Seed the default rate book from Settings.
              </p>
            ) : (
              rateItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addRateItem(item)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-50"
                >
                  <span className="truncate text-ink-700">{item.name}</span>
                  <span className="shrink-0 text-ink-400">{formatMoney(item.price)}</span>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Quotes</h2>
          {quotes.length === 0 ? (
            <EmptyState title="No quotes yet" />
          ) : (
            <Card className="divide-y divide-ink-100">
              {quotes.map((quote) => (
                <div key={quote.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {quote.customerName || "Walk-in"}
                    </p>
                    <p className="text-xs text-ink-400">{formatMoney(quote.total)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={quote.status === "approved" ? "success" : "neutral"}>{quote.status}</Badge>
                    {quote.status === "draft" && (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => runAction(() => nativeOpsApi.approveQuote(quote.id), "Quote approved.")}
                      >
                        Approve
                      </Button>
                    )}
                    {quote.status === "approved" && !quote.invoiceId && (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          runAction(() => nativeOpsApi.createInvoice({ quoteId: quote.id }), "Invoice created.")
                        }
                      >
                        Invoice
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Invoices</h2>
          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" />
          ) : (
            <Card className="divide-y divide-ink-100">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {invoice.customerName || "Walk-in"}
                    </p>
                    <p className="text-xs text-ink-400">
                      {formatMoney(invoice.total)} · Balance {formatMoney(invoice.balanceDue)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={invoice.status === "paid" ? "success" : invoice.status === "approved" ? "brand" : "neutral"}>
                      {invoice.status}
                    </Badge>
                    {invoice.status === "draft" && (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          runAction(() => nativeOpsApi.approveInvoice(invoice.id), "Invoice approved.")
                        }
                      >
                        Approve
                      </Button>
                    )}
                    {invoice.status === "approved" && (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          runAction(async () => {
                            const data = await nativeOpsApi.createPaymentCheckout(invoice.id);
                            if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
                          }, "Secure payment checkout opened in a new tab.")
                        }
                      >
                        Collect payment
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingContent />
    </Suspense>
  );
}
