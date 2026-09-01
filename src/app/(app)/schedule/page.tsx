"use client";

import Link from "next/link";
import { useCollection } from "@/lib/firestore-collections";
import type { Job, Technician } from "@/lib/types";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE, formatTime } from "@/lib/job-format";

function nextSevenDays() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
}

export default function SchedulePage() {
  const { data: jobs, loading } = useCollection<Job>("Jobs");
  const { data: technicians } = useCollection<Technician>("Technicians");
  const days = nextSevenDays();

  const techColor = (name: string | null) =>
    technicians.find((t) => t.name === name)?.color || "#9fb2bd";

  return (
    <div>
      <PageHeader title="Schedule" subtitle="The next 7 days of scheduled work." />

      {loading ? (
        <Card className="p-6 text-sm text-ink-400">Loading…</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {days.map((day) => {
            const key = day.toISOString().slice(0, 10);
            const dayJobs = jobs
              .filter((j) => j.scheduledDate === key)
              .sort((a, b) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""));

            return (
              <Card key={key} className="p-4">
                <p className="mb-3 text-sm font-semibold text-ink-800">
                  {day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                </p>
                {dayJobs.length === 0 ? (
                  <p className="text-sm text-ink-300">Nothing scheduled</p>
                ) : (
                  <ul className="space-y-2">
                    {dayJobs.map((job) => (
                      <li key={job.id}>
                        <Link
                          href={`/jobs/${job.id}`}
                          className="flex items-center gap-2 rounded-lg border border-ink-100 px-2.5 py-2 hover:bg-ink-50"
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: techColor(job.assignedTechnicianName) }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-ink-800">
                              {formatTime(job.scheduledTime)} · {job.customerName}
                            </p>
                            <p className="truncate text-[11px] text-ink-400">
                              {job.assignedTechnicianName || "Unassigned"}
                            </p>
                          </div>
                          <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {!loading && jobs.every((j) => !j.scheduledDate) && (
        <div className="mt-4">
          <EmptyState title="Nothing on the schedule yet" hint="Schedule a job from the Jobs page." />
        </div>
      )}
    </div>
  );
}
