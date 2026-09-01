"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { byCreatedDesc, createDoc, useCollection } from "@/lib/firestore-collections";
import type { Customer, Equipment, Job, JobPriority, Technician } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { PRIORITY_LABEL, PRIORITY_TONE, STATUS_LABEL, STATUS_TONE, formatDate } from "@/lib/job-format";

export default function JobsPage() {
  const { profile } = useAuth();
  const isTechnician = profile?.role === "technician";
  const canCreate = profile?.role === "owner" || profile?.role === "office";

  const { data: jobs, loading } = useCollection<Job>("Jobs", byCreatedDesc);
  const { data: customers } = useCollection<Customer>("Customers");
  const { data: equipment } = useCollection<Equipment>("Equipment");
  const { data: technicians } = useCollection<Technician>("Technicians");
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "open">("open");

  const myName = profile?.technicianName || profile?.displayName;
  const scoped = isTechnician ? jobs.filter((j) => j.assignedTechnicianName === myName) : jobs;
  const visible = scoped.filter((j) =>
    statusFilter === "all" ? true : !["completed", "invoiced", "cancelled"].includes(j.status)
  );

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customerId = String(form.get("customerId") || "");
    const customer = customers.find((c) => c.id === customerId);
    const equipmentId = String(form.get("equipmentId") || "") || null;
    const eq = equipment.find((e) => e.id === equipmentId);
    const technicianId = String(form.get("assignedTechnicianId") || "") || null;
    const tech = technicians.find((t) => t.id === technicianId);

    await createDoc("Jobs", {
      customerId,
      customerName: customer?.companyName || customer?.contactName || "Unknown customer",
      address: customer?.address || "",
      equipmentId,
      equipmentLabel: eq?.label || eq?.type || null,
      title: String(form.get("title") || ""),
      description: String(form.get("description") || ""),
      status: technicianId ? "scheduled" : "new",
      priority: String(form.get("priority") || "normal") as JobPriority,
      assignedTechnicianId: technicianId,
      assignedTechnicianName: tech?.name || null,
      scheduledDate: String(form.get("scheduledDate") || "") || null,
      scheduledTime: String(form.get("scheduledTime") || "") || null,
      checklist: [],
      notes: "",
      completedAt: null,
    });
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle={isTechnician ? "Your assigned work orders." : "Every work order, from intake to invoice."}
        action={canCreate ? <Button onClick={() => setOpen(true)}>+ New job</Button> : undefined}
      />

      <div className="mb-4 flex gap-2">
        <FilterChip active={statusFilter === "open"} onClick={() => setStatusFilter("open")}>
          Open
        </FilterChip>
        <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
          All
        </FilterChip>
      </div>

      {loading ? (
        <Card className="p-6 text-sm text-ink-400">Loading…</Card>
      ) : visible.length === 0 ? (
        <EmptyState title="No jobs here" hint="New jobs will show up as they're created." />
      ) : (
        <Card className="divide-y divide-ink-100">
          {visible.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-ink-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">
                  {job.title || "Untitled job"} — {job.customerName}
                </p>
                <p className="truncate text-xs text-ink-400">
                  {job.assignedTechnicianName || "Unassigned"} · {formatDate(job.createdAt)}
                  {job.scheduledDate ? ` · Scheduled ${job.scheduledDate}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Badge tone={PRIORITY_TONE[job.priority]}>{PRIORITY_LABEL[job.priority]}</Badge>
                <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
              </div>
            </Link>
          ))}
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New job">
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
          <Field label="Job title">
            <Input name="title" placeholder="e.g. Walk-in cooler not cooling" required />
          </Field>
          <Field label="Description">
            <Textarea name="description" rows={3} />
          </Field>
          <Field label="Equipment (optional)">
            <Select name="equipmentId" defaultValue="">
              <option value="">None specified</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label || e.type}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <Select name="priority" defaultValue="normal">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="emergency">Emergency</option>
              </Select>
            </Field>
            <Field label="Assign technician">
              <Select name="assignedTechnicianId" defaultValue="">
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Scheduled date">
              <Input name="scheduledDate" type="date" />
            </Field>
            <Field label="Scheduled time">
              <Input name="scheduledTime" type="time" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create job</Button>
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
