import type { CarePlanTier, EquipmentCategory, RateItem } from "./types";

// Default rate book — seeded once into Firestore ("RateBook" collection) and
// editable from Settings from then on. Owners can add, edit, or remove lines
// without touching code.
export const DEFAULT_RATE_BOOK: Omit<RateItem, "id">[] = [
  { category: "Labor", name: "Trip / diagnostic charge", price: 35 },
  { category: "Labor", name: "Service call, first hour", price: 145 },
  { category: "Labor", name: "Additional labor, per hour", price: 85 },
  { category: "Labor", name: "After-hours / emergency, per hour", price: 135 },
  { category: "Preventive Maintenance", name: "HVAC tune-up", price: 130 },
  { category: "Preventive Maintenance", name: "Refrigeration coil cleaning", price: 105 },
  { category: "Preventive Maintenance", name: "Ice machine sanitation", price: 385 },
  { category: "Preventive Maintenance", name: "Filter replacement", price: 60 },
  { category: "Refrigerant", name: "R-410A, per lb", price: 78 },
  { category: "Refrigerant", name: "R-404A, per lb", price: 62 },
  { category: "Refrigerant", name: "R-134a, per lb", price: 52 },
  { category: "Parts", name: "Thermostat / controller", price: 280 },
  { category: "Parts", name: "Contactor or relay", price: 245 },
  { category: "Parts", name: "Compressor, installed", price: 1900 },
  { category: "Parts", name: "Custom part / material", price: 0 },
];

export const CARE_PLAN_TIERS: Record<
  CarePlanTier,
  { visitsPerYear: number; description: string; multiplier: number }
> = {
  Silver: { visitsPerYear: 1, description: "Annual preventive maintenance visit", multiplier: 1 },
  Gold: { visitsPerYear: 2, description: "Semi-annual preventive maintenance", multiplier: 1.7 },
  Diamond: { visitsPerYear: 4, description: "Quarterly preventive maintenance + priority dispatch", multiplier: 3 },
};

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  "HVAC",
  "Refrigeration",
  "Ice Machine",
  "Kitchen",
];

export const PM_CHECKLISTS: Record<EquipmentCategory, string[]> = {
  HVAC: [
    "Check and replace filters",
    "Inspect and clean evaporator/condenser coils",
    "Verify refrigerant charge and pressures",
    "Test airflow and static pressure",
    "Inspect electrical connections and contactors",
    "Test thermostat / controller calibration",
    "Clear condensate drain line",
  ],
  Refrigeration: [
    "Inspect door gaskets and seals",
    "Check evaporator and condenser coil condition",
    "Verify box temperature against setpoint",
    "Test defrost cycle",
    "Inspect compressor and condensing unit",
    "Check refrigerant charge and pressures",
    "Clean condenser coil and clear drain",
  ],
  "Ice Machine": [
    "Sanitize and descale ice-forming surfaces",
    "Inspect water filter and replace if needed",
    "Check ice production rate against spec",
    "Inspect condenser and clean if air-cooled",
    "Verify water and refrigerant levels",
    "Inspect bin and dispenser for sanitation",
  ],
  Kitchen: [
    "Inspect heating elements / burners",
    "Calibrate temperature controls",
    "Check gas or electrical connections",
    "Clean and inspect ventilation",
    "Test safety shutoffs and pilot/ignition",
    "Inspect door seals and hardware",
  ],
};
