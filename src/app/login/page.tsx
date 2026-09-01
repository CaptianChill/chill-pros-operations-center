"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      setError("Sign-in failed. Check the email and password and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-800 bg-ink-900 p-8 shadow-panel">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image
            src="/chill-pros-official-logo-transparent.png"
            alt="Chill Pros"
            width={72}
            height={72}
            className="h-16 w-16 object-contain"
            priority
          />
          <div>
            <h1 className="text-lg font-semibold text-white">Operations Center</h1>
            <p className="text-sm text-ink-300">Owner, office &amp; technician sign-in</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink-200">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-white placeholder-ink-500 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink-200">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-white placeholder-ink-500 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-rose-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
