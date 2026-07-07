"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge, { STATUS_LABEL } from "@/components/StatusBadge";
import type { Role } from "@/lib/auth/permissions";
import { canWrite, canDelete } from "@/lib/auth/permissions";

const LEVEL_LABEL: Record<string, string> = {
  HEADQUARTERS: "Headquarters", STATE: "State", EDITION: "Edition",
  DISTRICT_HQ: "District HQ", SUPPLEMENTS: "Supplements",
  EDITORIAL_PAGE: "Editorial Page", RND_TEAM: "R&D Team",
};

type Plan = {
  id: string; timeframe: string; level: string; title: string;
  owner: string; due_at: string; status: string; created_at: string; updated_at: string;
};

export default function DetailClient({ plan, role }: { plan: Plan; role: Role }) {
  const router = useRouter();
  const [current, setCurrent] = useState(plan);
  const [editing, setEditing] = useState(false);
  const canEdit = canWrite(role);
  const canRemove = canDelete(role);

  async function handleStatusChange(status: string) {
    setCurrent((p) => ({ ...p, status }));
    await fetch(`/api/content-plans/${plan.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function handleSave(formData: FormData) {
    const payload = {
      title: formData.get("title"), owner: formData.get("owner"),
      dueAt: formData.get("dueAt"),
    };
    const res = await fetch(`/api/content-plans/${plan.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json();
      setCurrent(json.data);
      setEditing(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this plan? This cannot be undone.")) return;
    await fetch(`/api/content-plans/${plan.id}`, { method: "DELETE" });
    router.push("/content-planning");
  }

  return (
    <div className="max-w-2xl">
      <button onClick={() => router.push("/content-planning")} className="text-[11px] uppercase tracking-[1px] text-ink-soft mb-4 hover:text-ink">
        ← Back to Content Planning
      </button>

      <div className="border-b border-rule pb-3 mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[2px] text-red font-semibold">{LEVEL_LABEL[current.level]} · {current.timeframe}</div>
          <h1 className="font-serif text-[24px] font-semibold mt-1">{current.title}</h1>
        </div>
        <StatusBadge status={current.status} editable={canEdit} onChange={handleStatusChange} />
      </div>

      {!editing ? (
        <div className="bg-card border border-rule p-5 space-y-3 text-[13.5px]">
          <Row label="Owner" value={current.owner} />
          <Row label="Due" value={new Date(current.due_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} />
          <Row label="Created" value={new Date(current.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} />
          <Row label="Last updated" value={new Date(current.updated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} />

          <div className="flex gap-2 pt-3 border-t border-rule">
            {canEdit && (
              <button onClick={() => setEditing(true)} className="font-mono text-[11px] uppercase tracking-[1px] bg-ink text-paper px-3 py-1.5">
                Edit
              </button>
            )}
            {canRemove && (
              <button onClick={handleDelete} className="font-mono text-[11px] uppercase tracking-[1px] border border-red text-red px-3 py-1.5">
                Delete
              </button>
            )}
          </div>
        </div>
      ) : (
        <form action={handleSave} className="bg-card border border-rule p-5 grid grid-cols-2 gap-3">
          <input name="title" defaultValue={current.title} required className="col-span-2 border border-rule-strong px-3 py-2 text-sm" />
          <input name="owner" defaultValue={current.owner} required className="border border-rule-strong px-3 py-2 text-sm" />
          <input name="dueAt" type="datetime-local" defaultValue={toLocalInput(current.due_at)} required className="border border-rule-strong px-3 py-2 text-sm" />
          <div className="col-span-2 flex gap-2">
            <button type="submit" className="font-mono text-[11px] uppercase tracking-[1px] bg-red text-white px-4 py-2">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="font-mono text-[11px] uppercase tracking-[1px] border border-ink px-4 py-2">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-rule/60 pb-2">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
