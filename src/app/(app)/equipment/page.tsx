"use client";

import { useState } from "react";
import Link from "next/link";
import { createDoc, useCollection } from "@/lib/firestore-collections";
import { EQUIPMENT_CATEGORIES } from "@/lib/rate-book";
import type { Customer, Equipment, EquipmentCategory } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from "@/components/ui";

export default function EquipmentPage() {
  const { data: equipment, loading } = useCollection<Equipment>("Equipment");
  const { data: customers } = useCollection<Customer>("Customers");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<EquipmentCategory | "all">("all");

  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.companyName || "Unknown customer";

  const filtered = filter === "all" ? equipment : equipment.filter((e) => e.category === filter);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await createDoc("Equipment", {
      customerId: String(form.get("customerId") || ""),
      category: String(form.get("category") || "HVAC"),
      type: String(form.get("type") || ""),
      label: String(form.get("label") || ""),
      location: String(form.get("location") || ""),
      model: String(form.get("model") || ""),
      serial: String(form.get("serial") || ""),
      installDate: String(form.get("installDate") || ""),
      notes: String(form.get("notes") || ""),
    });
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Equipment"
        subtitle="Assets tracked across every customer site."
        action={<Button onClick={() => setOpen(true)}>+ Add equipment</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterChip>
        {EQUIPMENT_CATEGORIES.map((category) => (
          <FilterChip key={category} active={filter === category} onClick={() => setFilter(category)}>
            {category}
          </FilterChip>
        ))}
      </div>

      {loading ? (
        <Card className="p-6 text-sm text-ink-400">Loading…</Card>
      ) : filtered.length === 0 ? (
        <EmptyState title="No equipment recorded" hint="Add the equipment you service at each customer site." />
      ) : (
        <Card className="divide-y divide-ink-100">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={`/customers/${item.customerId}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-ink-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">{item.label || item.type}</p>
                <p className="truncate text-xs text-ink-400">
                  {customerName(item.customerId)} · {item.location || "Location not set"}
                </p>
              </div>
              <Badge tone="neutral">{item.category}</Badge>
            </Link>
          ))}
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add equipment">
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Customer">
            <Select name="customerId" required defaultValue="">
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select name="category" defaultValue="HVAC">
                {EQUIPMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type">
              <Input name="type" placeholder="Walk-in cooler, RTU, ice machine…" />
            </Field>
          </div>
          <Field label="Label">
            <Input name="label" placeholder="e.g. Kitchen walk-in #2" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location on site">
              <Input name="location" />
            </Field>
            <Field label="Install date">
              <Input name="installDate" type="date" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Model">
              <Input name="model" />
            </Field>
            <Field label="Serial #">
              <Input name="serial" />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea name="notes" rows={3} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save equipment</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-brand-600 text-white" : "bg-white text-ink-500 hover:bg-ink-100"
      }`}
    >
      {children}
    </button>
  );
}
