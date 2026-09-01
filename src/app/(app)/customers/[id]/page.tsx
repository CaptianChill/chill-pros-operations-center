"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { where } from "firebase/firestore";
import {
  deleteDocById,
  updateDocById,
  useCollection,
} from "@/lib/firestore-collections";
import type { Customer, Equipment, Job } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE, formatDate } from "@/lib/job-format";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: customers } = useCollection<Customer>("Customers");
  const { data: equipment } = useCollection<Equipment>("Equipment", [where("customerId", "==", params.id)]);
  const { data: jobs } = useCollection<Job>("Jobs", [where("customerId", "==", params.id)]);
  const [editing, setEditing] = useState(false);

  const customer = customers.find((c) => c.id === params.id);

  if (!customer) {
    return <EmptyState title="Customer not found" hint="It may have been deleted." />;
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await updateDocById("Customers", customer!.id, {
      companyName: String(form.get("companyName") || ""),
      contactName: String(form.get("contactName") || ""),
      phone: String(form.get("phone") || ""),
      email: String(form.get("email") || ""),
      address: String(form.get("address") || ""),
      notes: String(form.get("notes") || ""),
    });
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete ${customer!.companyName || customer!.contactName}? This cannot be undone.`)) return;
    await deleteDocById("Customers", customer!.id);
    router.push("/customers");
  }

  return (
    <div>
      <PageHeader
        title={customer.companyName || customer.contactName}
        subtitle={customer.address}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancel edit" : "Edit"}
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        }
      />

      {editing ? (
        <Card className="mb-6 p-4">
          <form onSubmit={handleSave} className="space-y-3">
            <Field label="Company / account name">
              <Input name="companyName" defaultValue={customer.companyName} required />
            </Field>
            <Field label="Contact name">
              <Input name="contactName" defaultValue={customer.contactName} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <Input name="phone" type="tel" defaultValue={customer.phone} />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" defaultValue={customer.email} />
              </Field>
            </div>
            <Field label="Service address">
              <Input name="address" defaultValue={customer.address} />
            </Field>
            <Field label="Notes">
              <Textarea name="notes" rows={3} defaultValue={customer.notes} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="mb-6 grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-ink-400">Contact</p>
            <p className="text-ink-800">{customer.contactName || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-ink-400">Phone</p>
            <p className="text-ink-800">{customer.phone || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-ink-400">Email</p>
            <p className="text-ink-800">{customer.email || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-ink-400">Notes</p>
            <p className="text-ink-800">{customer.notes || "—"}</p>
          </div>
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold text-ink-700">Equipment on site</h2>
      {equipment.length === 0 ? (
        <EmptyState title="No equipment recorded" hint="Add equipment from the Equipment page." />
      ) : (
        <Card className="mb-6 divide-y divide-ink-100">
          {equipment.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink-900">{item.label || item.type}</p>
                <p className="text-xs text-ink-400">
                  {item.category} · {item.location || "Location not set"}
                </p>
              </div>
              <p className="text-xs text-ink-400">{item.model}</p>
            </div>
          ))}
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold text-ink-700">Job history</h2>
      {jobs.length === 0 ? (
        <EmptyState title="No jobs yet" />
      ) : (
        <Card className="divide-y divide-ink-100">
          {jobs
            .slice()
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .map((job) => (
              <div key={job.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{job.title || "Untitled job"}</p>
                  <p className="text-xs text-ink-400">{formatDate(job.createdAt)}</p>
                </div>
                <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
              </div>
            ))}
        </Card>
      )}
    </div>
  );
}
