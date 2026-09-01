export type Role = "owner" | "office" | "technician";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  technicianName?: string;
}

export interface Customer {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: number | null;
}

export type EquipmentCategory = "HVAC" | "Refrigeration" | "Ice Machine" | "Kitchen";

export interface Equipment {
  id: string;
  customerId: string;
  category: EquipmentCategory;
  type: string;
  label: string;
  location: string;
  model: string;
  serial: string;
  installDate: string;
  notes: string;
}

export type JobStatus =
  | "new"
  | "scheduled"
  | "dispatched"
  | "in_progress"
  | "completed"
  | "invoiced"
  | "cancelled";

export type JobPriority = "low" | "normal" | "high" | "emergency";

export interface JobChecklistItem {
  label: string;
  done: boolean;
}

export interface Job {
  id: string;
  customerId: string;
  customerName: string;
  address: string;
  equipmentId: string | null;
  equipmentLabel: string | null;
  title: string;
  description: string;
  status: JobStatus;
  priority: JobPriority;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  checklist: JobChecklistItem[];
  notes: string;
  createdAt: number | null;
  updatedAt: number | null;
  completedAt: number | null;
}

export interface Technician {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  color: string;
}

export type CarePlanTier = "Silver" | "Gold" | "Diamond";

export interface CarePlan {
  id: string;
  customerId: string;
  customerName: string;
  tier: CarePlanTier;
  visitsPerYear: number;
  equipmentIds: string[];
  nextVisitDate: string | null;
  monthlyPrice: number;
  notes: string;
}

export interface RateItem {
  id: string;
  category: string;
  name: string;
  price: number;
}

export interface QuoteInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Quote {
  id: string;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  jobId: string | null;
  equipmentId: string | null;
  scope: string | null;
  notes: string | null;
  lines: QuoteInvoiceLine[];
  total: number;
  status: "draft" | "approved";
  invoiceId?: string | null;
}

export interface Invoice {
  id: string;
  quoteId: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  jobId: string | null;
  lines: QuoteInvoiceLine[];
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: "draft" | "approved" | "paid";
  paymentStatus: "unpaid" | "paid" | string;
}
