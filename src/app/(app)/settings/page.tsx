"use client";

import { useEffect, useState } from "react";
import { jobberApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  createDoc,
  deleteDocById,
  setDocById,
  useCollection,
} from "@/lib/firestore-collections";
import { DEFAULT_RATE_BOOK } from "@/lib/rate-book";
import type { RateItem, Role, UserProfile } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { formatMoney } from "@/lib/job-format";

export default function SettingsPage() {
  const { profile } = useAuth();

  if (profile && profile.role !== "owner") {
    return (
      <div>
        <PageHeader title="Settings" />
        <EmptyState title="Owner access required" hint="Ask the owner to manage integrations and staff access." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle="Integrations, rate book, and staff access." />
      <JobberSettings />
      <RateBookSettings />
      <UsersSettings />
    </div>
  );
}

function JobberSettings() {
  const [status, setStatus] = useState<{ connected: boolean; accountName?: string } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    jobberApi
      .status()
      .then((data) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  async function connect() {
    setBusy(true);
    try {
      const data = await jobberApi.connect();
      if (data.authorizeUrl) window.location.assign(data.authorizeUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start Jobber authorization.");
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    setMessage("");
    try {
      const data = await jobberApi.syncClients();
      setMessage(`${data.imported} Jobber client record(s) synchronized.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-700">Jobber integration</h2>
        <Badge tone={status?.connected ? "success" : "neutral"}>
          {status?.connected ? `Connected · ${status.accountName}` : "Not connected"}
        </Badge>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={busy} onClick={connect}>
          {status?.connected ? "Reconnect" : "Connect Jobber"}
        </Button>
        <Button disabled={busy || !status?.connected} onClick={sync}>
          Sync clients
        </Button>
      </div>
      {message && <p className="mt-2 text-sm text-ink-500">{message}</p>}
    </Card>
  );
}

function RateBookSettings() {
  const { data: rateItems } = useCollection<RateItem>("RateBook");

  async function seedDefaults() {
    for (const item of DEFAULT_RATE_BOOK) {
      await createDoc("RateBook", item);
    }
  }

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await createDoc("RateBook", {
      category: String(form.get("category") || "Labor"),
      name: String(form.get("name") || ""),
      price: Number(form.get("price") || 0),
    });
    event.currentTarget.reset();
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-700">Rate book</h2>
        {rateItems.length === 0 && (
          <Button variant="secondary" onClick={seedDefaults}>
            Load starter rates
          </Button>
        )}
      </div>

      <form onSubmit={addItem} className="mb-4 grid grid-cols-4 gap-2">
        <Input name="category" placeholder="Category" required />
        <Input name="name" placeholder="Line item name" required className="col-span-2" />
        <Input name="price" type="number" min={0} step="0.01" placeholder="Price" required />
        <Button type="submit" variant="secondary" className="col-span-4">
          + Add rate
        </Button>
      </form>

      <div className="scroll-thin max-h-72 divide-y divide-ink-100 overflow-y-auto">
        {rateItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <p className="text-ink-800">{item.name}</p>
              <p className="text-xs text-ink-400">{item.category}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium text-ink-700">{formatMoney(item.price)}</span>
              <button
                onClick={() => deleteDocById("RateBook", item.id)}
                className="text-xs text-ink-300 hover:text-rose-500"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function UsersSettings() {
  const { data: users } = useCollection<UserProfile & { id: string }>("Users");
  const [message, setMessage] = useState("");

  async function addUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const uid = String(form.get("uid") || "").trim();
    if (!uid) return;
    await setDocById("Users", uid, {
      email: String(form.get("email") || ""),
      displayName: String(form.get("displayName") || ""),
      role: String(form.get("role") || "technician") as Role,
      technicianName: String(form.get("technicianName") || ""),
    });
    setMessage("Role profile saved.");
    event.currentTarget.reset();
  }

  return (
    <Card className="p-4">
      <h2 className="mb-1 text-sm font-semibold text-ink-700">Staff access</h2>
      <p className="mb-3 text-xs text-ink-400">
        Create the Firebase Authentication user first, then add their role profile here using their
        Authentication UID.
      </p>

      <form onSubmit={addUser} className="mb-4 grid grid-cols-2 gap-2">
        <Input name="uid" placeholder="Firebase Auth UID" required className="col-span-2" />
        <Input name="displayName" placeholder="Display name" />
        <Input name="email" type="email" placeholder="Email" />
        <Select name="role" defaultValue="technician">
          <option value="owner">Owner</option>
          <option value="office">Office</option>
          <option value="technician">Technician</option>
        </Select>
        <Input name="technicianName" placeholder="Technician name (must match job assignments)" />
        <Button type="submit" variant="secondary" className="col-span-2">
          Save role profile
        </Button>
      </form>
      {message && <p className="mb-3 text-sm text-ink-500">{message}</p>}

      <div className="divide-y divide-ink-100">
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <p className="text-ink-800">{user.displayName || user.email}</p>
              <p className="text-xs text-ink-400">{user.email}</p>
            </div>
            <Badge tone="neutral">{user.role}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
