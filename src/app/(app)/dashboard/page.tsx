"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/firestore-collections";
import type { Job } from "@/lib/types";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { STATUS_TONE, STATUS_LABEL, formatDate, formatTime } from "@/lib/job-format";

export default function DashboardPage() {
  const { profile } = useAuth();
  const { data: jobs, loading } = useCollection<Job>("Jobs");
  const isTechnician = profile?.role === "technician";

  const myJobs = isTechnician
    ? jobs.filter((j) => j.assignedTechnicianName === (profile?.technicianName || profile?.displayName))
    : jobs;

  const active = myJobs.filter((j) => !["completed", "invoiced", "cancelled"].includes(j.status));
  const today = new Date().toISOString().slice(0, 10);
  const scheduledToday = myJobs.filter((j) => j.scheduledDate === today);
  const unassigned = jobs.filter((j) => j.status === "new" && !j.assignedTechnicianId);
  const completedThisWeek = jobs.filter((j) => j.status === "completed" || j.status === "invoiced").length;

  const upcoming = [...scheduledToday].sort((a, b) =>
    (a.scheduledTime || "").localeCompare(b.scheduledTime || "")
  );

  return (
    <div>
      <PageHeader
        title={isTechnician ? `Today's jobs` : "Dashboard"}
        subtitle={
          isTechnician
            ? "Your assigned jobs for today."
            : "Live view of dispatch, jobs, and the office queue."
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={isTechnician ? "My active jobs" : "Active jobs"} value={active.length} />
        <StatCard label="Scheduled today" value={scheduledToday.length} />
        {!isTechnician && <StatCard label="Unassigned" value={unassigned.length} hint="Needs a technician" />}
        {!isTechnician && <StatCard label="Completed / invoiced" value={completedThisWeek} />}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-700">
            {isTechnician ? "Your schedule today" : "Today's schedule"}
          </h2>
          <Link href="/jobs" className="text-sm font-medium text-brand-600 hover:underline">
            View all jobs →
          </Link>
        </div>

        {loading ? (
          <Card className="p-6 text-sm text-ink-400">Loading…</Card>
        ) : upcoming.length === 0 ? (
          <EmptyState title="Nothing scheduled today" hint="Scheduled jobs will appear here." />
        ) : (
          <Card className="divide-y divide-ink-100">
            {upcoming.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-ink-50"
              >
                <div className="w-16 shrink-0 text-sm font-semibold text-ink-700">
                  {formatTime(job.scheduledTime)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{job.customerName}</p>
                  <p className="truncate text-xs text-ink-400">{job.address || "No address on file"}</p>
                </div>
                <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
              </Link>
            ))}
          </Card>
        )}
      </div>

      {!isTechnician && unassigned.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Needs dispatch</h2>
          <Card className="divide-y divide-ink-100">
            {unassigned.slice(0, 6).map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-ink-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">{job.customerName}</p>
                  <p className="truncate text-xs text-ink-400">{job.title || "Untitled job"}</p>
                </div>
                <span className="shrink-0 text-xs text-ink-400">{formatDate(job.createdAt)}</span>
              </Link>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
