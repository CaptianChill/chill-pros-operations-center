"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { deleteDocById, updateDocById, useCollection } from "@/lib/firestore-collections";
import { PM_CHECKLISTS } from "@/lib/rate-book";
import type { Equipment, Job, JobStatus, Technician } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, Textarea } from "@/components/ui";
import { JOB_STATUSES, PRIORITY_LABEL, STATUS_LABEL, STATUS_TONE, formatDate } from "@/lib/job-format";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const canManage = profile?.role === "owner" || profile?.role === "office";

  const { data: jobs } = useCollection<Job>("Jobs");
  const { data: technicians } = useCollection<Technician>("Technicians");
  const { data: equipment } = useCollection<Equipment>("Equipment");
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  const job = jobs.find((j) => j.id === params.id);
  if (!job) return <EmptyState title="Job not found" hint="It may have been deleted." />;

  const eq = equipment.find((e) => e.id === job.equipmentId);
  const suggestedChecklist = eq ? PM_CHECKLISTS[eq.category] : null;

  async function setStatus(status: JobStatus) {
    await updateDocById("Jobs", job!.id, {
      status,
      completedAt: status === "completed" ? Date.now() : job!.completedAt,
    });
  }

  async function assignTechnician(technicianId: string) {
    const tech = technicians.find((t) => t.id === technicianId);
    await updateDocById("Jobs", job!.id, {
      assignedTechnicianId: technicianId || null,
      assignedTechnicianName: tech?.name || null,
      status: job!.status === "new" && technicianId ? "scheduled" : job!.status,
    });
  }

  async function toggleChecklistItem(index: number) {
    const next = job!.checklist.map((item, i) => (i === index ? { ...item, done: !item.done } : item));
    await updateDocById("Jobs", job!.id, { checklist: next });
  }

  async function loadSuggestedChecklist() {
    if (!suggestedChecklist) return;
    await updateDocById("Jobs", job!.id, {
      checklist: suggestedChecklist.map((label) => ({ label, done: false })),
    });
  }

  async function saveNotes() {
    if (notesDraft === null) return;
    await updateDocById("Jobs", job!.id, { notes: notesDraft });
    setNotesDraft(null);
  }

  async function handleDelete() {
    if (!confirm("Delete this job? This cannot be undone.")) return;
    await deleteDocById("Jobs", job!.id);
    router.push("/jobs");
  }

  return (
    <div>
      <PageHeader
        title={job.title || "Untitled job"}
        subtitle={`${job.customerName} · ${job.address || "No address on file"}`}
        action={
          <div className="flex gap-2">
            {canManage && job.status === "completed" && (
              <Link href={`/billing?jobId=${job.id}&customerId=${job.customerId}`}>
                <Button>Create quote / invoice</Button>
              </Link>
            )}
            {canManage && (
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
        <Badge tone="neutral">{PRIORITY_LABEL[job.priority]} priority</Badge>
        {job.scheduledDate && <Badge tone="brand">Scheduled {job.scheduledDate} {job.scheduledTime}</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-ink-700">Description</h2>
            <p className="whitespace-pre-wrap text-sm text-ink-600">{job.description || "No description provided."}</p>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-700">Checklist</h2>
              {suggestedChecklist && job.checklist.length === 0 && (
                <button onClick={loadSuggestedChecklist} className="text-xs font-medium text-brand-600 hover:underline">
                  Load {eq?.category} PM checklist
                </button>
              )}
            </div>
            {job.checklist.length === 0 ? (
              <p className="text-sm text-ink-400">No checklist items yet.</p>
            ) : (
              <ul className="space-y-2">
                {job.checklist.map((item, index) => (
                  <li key={index}>
                    <label className="flex items-center gap-2.5 text-sm text-ink-700">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleChecklistItem(index)}
                        className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
                      />
                      <span className={item.done ? "text-ink-400 line-through" : ""}>{item.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-ink-700">Field notes</h2>
            <Textarea
              rows={4}
              defaultValue={job.notes}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={saveNotes}
              placeholder="Notes from the visit, parts used, findings…"
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink-700">Status</h2>
            <Field label="Update status">
              <Select value={job.status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>

          {canManage && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink-700">Assignment</h2>
              <Field label="Technician">
                <Select value={job.assignedTechnicianId ?? ""} onChange={(e) => assignTechnician(e.target.value)}>
                  <option value="">Unassigned</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </Card>
          )}

          <Card className="p-4 text-sm">
            <h2 className="mb-3 text-sm font-semibold text-ink-700">Details</h2>
            <dl className="space-y-2 text-ink-600">
              <div className="flex justify-between">
                <dt className="text-ink-400">Equipment</dt>
                <dd>{job.equipmentLabel || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-400">Created</dt>
                <dd>{formatDate(job.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-400">Customer</dt>
                <dd>
                  <Link href={`/customers/${job.customerId}`} className="text-brand-600 hover:underline">
                    View
                  </Link>
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
