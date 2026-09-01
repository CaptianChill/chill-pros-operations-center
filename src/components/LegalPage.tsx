import type { ReactNode } from "react";

export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-ink-700">
      <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
      <p className="mt-1 text-sm text-ink-400">Effective date: {effectiveDate}</p>
      <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed [&_a]:text-brand-600 [&_a]:underline [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink-800">
        {children}
      </div>
    </main>
  );
}
