"use client";

import { useState } from "react";
import { createDoc, deleteDocById, useCollection } from "@/lib/firestore-collections";
import { CARE_PLAN_TIERS } from "@/lib/rate-book";
import type { CarePlan, CarePlanTier, Customer, Equipment } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { formatMoney } from "@/lib/job-format";

const TIERS: CarePlanTier[] = ["Silver", "Gold", "Diamond"];

export default function CarePlansPage() {
  const { data: carePlans, loading } = useCollection<CarePlan>("CarePlans");
  const { data: customers } = useCollection<Customer>("Customers");
  const { data: equipment } = useCollection<Equipment>("Equipment");
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [tier, setTier] = useState<CarePlanTier>("Gold");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  const customerEquipment = equipment.filter((e) => e.customerId === customerId);
  const suggestedMonthly = Math.round(customerEquipment.length * 35 * CARE_PLAN_TIERS[tier].multiplier) || 0;

  function toggleEquipment(id: string) {
    setSelectedEquipment((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customer = customers.find((c) => c.id === customerId);
    await createDoc("CarePlans", {
      customerId,
      customerName: customer?.companyName || customer?.contactName || "Unknown customer",
      tier,
      visitsPerYear: CARE_PLAN_TIERS[tier].visitsPerYear,
      equipmentIds: selectedEquipment,
      nextVisitDate: String(form.get("nextVisitDate") || "") || null,
      monthlyPrice: Number(form.get("monthlyPrice") || suggestedMonthly),
      notes: String(form.get("notes") || ""),
    });
    setOpen(false);
    setSelectedEquipment([]);
    setCustomerId("");
  }

  async function handleDelete(id: string) {
    if (!confirm("Cancel this care plan?")) return;
    await deleteDocById("CarePlans", id);
  }

  return (
    <div>
      <PageHeader
        title="Care Plans"
        subtitle="Recurring maintenance contracts — Silver, Gold, and Diamond tiers."
        action={<Button onClick={() => setOpen(true)}>+ New care plan</Button>}
      />

      {loading ? (
        <Card className="p-6 text-sm text-ink-400">Loading…</Card>
      ) : carePlans.length === 0 ? (
        <EmptyState title="No care plans yet" hint="Enroll a customer in a recurring maintenance plan." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {carePlans.map((plan) => (
            <Card key={plan.id} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-ink-900">{plan.customerName}</p>
                <Badge tone={plan.tier === "Diamond" ? "brand" : plan.tier === "Gold" ? "warning" : "neutral"}>
                  {plan.tier}
                </Badge>
              </div>
              <p className="text-xs text-ink-400">
                {plan.visitsPerYear}x visits/year · {plan.equipmentIds.length} unit(s) covered
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
                <p className="text-sm font-bold text-ink-900">{formatMoney(plan.monthlyPrice)}/mo</p>
                <button
                  onClick={() => handleDelete(plan.id)}
                  className="text-xs font-medium text-ink-400 hover:text-rose-500"
                >
                  Cancel plan
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New care plan">
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Customer">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="" disabled>
                Select a customer…
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName || c.contactName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tier">
            <Select value={tier} onChange={(e) => setTier(e.target.value as CarePlanTier)}>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t} — {CARE_PLAN_TIERS[t].description}
                </option>
              ))}
            </Select>
          </Field>

          {customerId && (
            <Field label="Equipment covered">
              {customerEquipment.length === 0 ? (
                <p className="text-sm text-ink-400">This customer has no equipment on file yet.</p>
              ) : (
                <div className="space-y-1.5 rounded-lg border border-ink-100 p-2">
                  {customerEquipment.map((eq) => (
                    <label key={eq.id} className="flex items-center gap-2 text-sm text-ink-700">
                      <input
                        type="checkbox"
                        checked={selectedEquipment.includes(eq.id)}
                        onChange={() => toggleEquipment(eq.id)}
                        className="h-4 w-4 rounded border-ink-300 text-brand-600"
                      />
                      {eq.label || eq.type}
                    </label>
                  ))}
                </div>
              )}
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly price">
              <Input name="monthlyPrice" type="number" min={0} step="0.01" defaultValue={suggestedMonthly} />
            </Field>
            <Field label="Next visit date">
              <Input name="nextVisitDate" type="date" />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save care plan</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
