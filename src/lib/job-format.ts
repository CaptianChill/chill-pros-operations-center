import type { JobPriority, JobStatus } from "./types";

export const STATUS_LABEL: Record<JobStatus, string> = {
  new: "New",
  scheduled: "Scheduled",
  dispatched: "Dispatched",
  in_progress: "In Progress",
  completed: "Completed",
  invoiced: "Invoiced",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<JobStatus, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  new: "neutral",
  scheduled: "brand",
  dispatched: "brand",
  in_progress: "warning",
  completed: "success",
  invoiced: "success",
  cancelled: "danger",
};

export const PRIORITY_LABEL: Record<JobPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  emergency: "Emergency",
};

export const PRIORITY_TONE: Record<JobPriority, "neutral" | "brand" | "warning" | "danger"> = {
  low: "neutral",
  normal: "brand",
  high: "warning",
  emergency: "danger",
};

export const JOB_STATUSES: JobStatus[] = [
  "new",
  "scheduled",
  "dispatched",
  "in_progress",
  "completed",
  "invoiced",
  "cancelled",
];

export function formatDate(value: number | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatTime(value: string | null): string {
  if (!value) return "—";
  const [hourText, minute = "00"] = value.split(":");
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

export function formatMoney(value: number): string {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
