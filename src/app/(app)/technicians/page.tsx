"use client";

import { useState } from "react";
import { createDoc, updateDocById, useCollection } from "@/lib/firestore-collections";
import type { Job, Technician } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader } from "@/components/ui";

const COLORS = ["#008cff", "#0aa2f2", "#22c55e", "#f59e0b", "#f43f5e", "#8b5cf6"];

export default function TechniciansPage() {
  const { data: technicians, loading } = useCollection<Technician>("Technicians");
  const { data: jobs } = useCollection<Job>("Jobs");
  const [open, setOpen] = useState(false);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await createDoc("Technicians", {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      active: true,
      color: COLORS[technicians.length % COLORS.length],
    });
    setOpen(false);
  }

  function activeJobCount(name: string) {
    return jobs.filter(
      (j) => j.assignedTechnicianName === name && !["completed", "invoiced", "cancelled"].includes(j.status)
    ).length;
  }

  return (
    <div>
      <PageHeader
        title="Technicians"
        subtitle="Your field team."
        action={<Button onClick={() => setOpen(true)}>+ Add technician</Button>}
      />

      {loading ? (
        <Card className="p-6 text-sm text-ink-400">Loading…</Card>
      ) : technicians.length === 0 ? (
        <EmptyState title="No technicians yet" hint="Add your field team to start assigning jobs." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {technicians.map((tech) => (
            <Card key={tech.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: tech.color || "#008cff" }}
                  >
                    {tech.name?.[0]?.toUpperCase() || "?"}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{tech.name}</p>
                    <p className="text-xs text-ink-400">{tech.phone || tech.email || "No contact on file"}</p>
                  </div>
                </div>
                <Badge tone={tech.active ? "success" : "neutral"}>{tech.active ? "Active" : "Inactive"}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3 text-sm">
                <span className="text-ink-500">{activeJobCount(tech.name)} active job(s)</span>
                <button
                  className="text-xs font-medium text-brand-600 hover:underline"
                  onClick={() => updateDocById("Technicians", tech.id, { active: !tech.active })}
                >
                  {tech.active ? "Mark inactive" : "Mark active"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add technician">
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Full name">
            <Input name="name" required />
          </Field>
          <Field label="Phone">
            <Input name="phone" type="tel" />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save technician</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
