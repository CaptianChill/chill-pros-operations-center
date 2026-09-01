"use client";

import { useState } from "react";
import Link from "next/link";
import { byCreatedDesc, createDoc, useCollection } from "@/lib/firestore-collections";
import type { Customer } from "@/lib/types";
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Textarea } from "@/components/ui";

export default function CustomersPage() {
  const { data: customers, loading } = useCollection<Customer>("Customers", byCreatedDesc);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.companyName.toLowerCase().includes(q) ||
      c.contactName.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q)
    );
  });

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await createDoc("Customers", {
      companyName: String(form.get("companyName") || ""),
      contactName: String(form.get("contactName") || ""),
      phone: String(form.get("phone") || ""),
      email: String(form.get("email") || ""),
      address: String(form.get("address") || ""),
      notes: String(form.get("notes") || ""),
    });
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Accounts and service locations."
        action={<Button onClick={() => setOpen(true)}>+ New customer</Button>}
      />

      <Input
        placeholder="Search customers…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-sm"
      />

      {loading ? (
        <Card className="p-6 text-sm text-ink-400">Loading…</Card>
      ) : filtered.length === 0 ? (
        <EmptyState title="No customers yet" hint="Add your first customer to get started." />
      ) : (
        <Card className="divide-y divide-ink-100">
          {filtered.map((customer) => (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-ink-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">{customer.companyName || customer.contactName}</p>
                <p className="truncate text-xs text-ink-400">{customer.address || "No address on file"}</p>
              </div>
              <div className="shrink-0 text-right text-xs text-ink-400">
                <p>{customer.phone}</p>
                <p>{customer.email}</p>
              </div>
            </Link>
          ))}
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New customer">
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Company / account name">
            <Input name="companyName" required />
          </Field>
          <Field label="Contact name">
            <Input name="contactName" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input name="phone" type="tel" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" />
            </Field>
          </div>
          <Field label="Service address">
            <Input name="address" />
          </Field>
          <Field label="Notes">
            <Textarea name="notes" rows={3} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save customer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
