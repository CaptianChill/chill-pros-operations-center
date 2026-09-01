import type { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export const DashboardIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Icon>
);

export const CustomersIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6" />
    <circle cx="17.5" cy="8.5" r="2.5" />
    <path d="M15.5 14.2c2.9.4 5 2.5 5 5.8" />
  </Icon>
);

export const EquipmentIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M14 3l3 3-8 8-4 1 1-4z" />
    <path d="M3 21h8" />
    <path d="M17 6l1.5-1.5a2.1 2.1 0 013 3L20 9" />
  </Icon>
);

export const JobsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3.5" y="6" width="17" height="14" rx="2" />
    <path d="M8 6V4.5A1.5 1.5 0 019.5 3h5A1.5 1.5 0 0116 4.5V6" />
    <path d="M3.5 11h17" />
  </Icon>
);

export const ScheduleIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
    <path d="M3.5 9.5h17" />
    <path d="M8 3v3M16 3v3" />
  </Icon>
);

export const TechniciansIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7" />
  </Icon>
);

export const CarePlanIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 21s-7-4.3-9.3-8.7C1 8.4 3 5 6.6 5c2 0 3.5 1.1 4.4 2.5C11.9 6.1 13.4 5 15.4 5 19 5 21 8.4 19.3 12.3 17 16.7 12 21 12 21z" />
  </Icon>
);

export const BillingIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18" />
    <path d="M7 15h4" />
  </Icon>
);

export const SettingsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13.5a7.6 7.6 0 000-3l1.9-1.5-2-3.4-2.3.7a7.7 7.7 0 00-2.6-1.5L14 2.5h-4l-.4 2.3a7.7 7.7 0 00-2.6 1.5l-2.3-.7-2 3.4L4.6 10.5a7.6 7.6 0 000 3L2.7 15l2 3.4 2.3-.7c.75.65 1.63 1.16 2.6 1.5l.4 2.3h4l.4-2.3a7.7 7.7 0 002.6-1.5l2.3.7 2-3.4z" />
  </Icon>
);

export const MenuIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
);

export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
