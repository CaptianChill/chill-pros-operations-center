"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/types";
import {
  BillingIcon,
  CarePlanIcon,
  CloseIcon,
  CustomersIcon,
  DashboardIcon,
  EquipmentIcon,
  JobsIcon,
  MenuIcon,
  ScheduleIcon,
  SettingsIcon,
  TechniciansIcon,
} from "./icons";

interface NavItem {
  href: string;
  label: string;
  icon: (p: { className?: string }) => ReactNode;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon, roles: ["owner", "office", "technician"] },
  { href: "/jobs", label: "Jobs", icon: JobsIcon, roles: ["owner", "office", "technician"] },
  { href: "/schedule", label: "Schedule", icon: ScheduleIcon, roles: ["owner", "office"] },
  { href: "/customers", label: "Customers", icon: CustomersIcon, roles: ["owner", "office"] },
  { href: "/equipment", label: "Equipment", icon: EquipmentIcon, roles: ["owner", "office", "technician"] },
  { href: "/care-plans", label: "Care Plans", icon: CarePlanIcon, roles: ["owner", "office"] },
  { href: "/billing", label: "Quotes & Billing", icon: BillingIcon, roles: ["owner", "office"] },
  { href: "/technicians", label: "Technicians", icon: TechniciansIcon, roles: ["owner", "office"] },
  { href: "/settings", label: "Settings", icon: SettingsIcon, roles: ["owner"] },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const role = profile?.role ?? "technician";
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  const NavList = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const ItemIcon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setDrawerOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-brand-600/15 text-brand-700"
                : "text-ink-500 hover:bg-ink-100 hover:text-ink-800"
            }`}
          >
            <ItemIcon className="h-5 w-5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-200 bg-white py-5 md:flex">
        <div className="mb-4 flex items-center gap-2.5 px-4">
          <Image
            src="/chill-pros-official-logo-transparent.png"
            alt="Chill Pros"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
          <div>
            <p className="text-sm font-bold leading-tight text-ink-900">Chill Pros</p>
            <p className="text-xs leading-tight text-ink-400">Operations Center</p>
          </div>
        </div>
        {NavList}
        <div className="mt-2 border-t border-ink-200 px-3 pt-3">
          <UserCard name={profile?.displayName ?? ""} role={role} onSignOut={handleSignOut} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative flex h-full w-72 flex-col bg-white py-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between px-4">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/chill-pros-official-logo-transparent.png"
                  alt="Chill Pros"
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                />
                <p className="text-sm font-bold text-ink-900">Chill Pros</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                <CloseIcon className="h-5 w-5 text-ink-500" />
              </button>
            </div>
            {NavList}
            <div className="mt-2 border-t border-ink-200 px-3 pt-3">
              <UserCard name={profile?.displayName ?? ""} role={role} onSignOut={handleSignOut} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-200 bg-white px-4 md:hidden">
          <button onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <MenuIcon className="h-6 w-6 text-ink-600" />
          </button>
          <p className="text-sm font-semibold text-ink-900">Chill Pros Operations Center</p>
        </header>
        <main className="scroll-thin flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

function UserCard({
  name,
  role,
  onSignOut,
}: {
  name: string;
  role: Role;
  onSignOut: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
        {initials(name) || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{name}</p>
        <p className="text-xs capitalize text-ink-400">{role}</p>
      </div>
      <button
        onClick={onSignOut}
        className="rounded-md px-2 py-1 text-xs font-medium text-ink-400 hover:bg-ink-100 hover:text-ink-700"
      >
        Sign out
      </button>
    </div>
  );
}
