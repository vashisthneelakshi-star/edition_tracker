"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import StatusBadge, { STATUS_LABEL } from "@/components/StatusBadge";
import { exportCSV, exportExcel, exportPDF } from "@/lib/export";
import type { Role } from "@/lib/auth/permissions";
import { canWrite, canDelete } from "@/lib/auth/permissions";

type PlanLevel =
  | "HEADQUARTERS" | "STATE" | "EDITION" | "DISTRICT_HQ"
  | "SUPPLEMENTS" | "EDITORIAL_PAGE" | "RND_TEAM";
type Timeframe = "ANNUAL" | "MONTHLY" | "WEEKLY" | "DAILY";
type PlanStatus = keyof typeof STATUS_LABEL;

type ContentPlan = {
  id: string; timeframe: Timeframe; level: PlanLevel; title: string;
  owner: string; due_at: string; status: PlanStatus;
};

const LEVEL_LABEL: Record<PlanLevel, string> = {
  HEADQUARTERS: "Headquarters", STATE: "State", EDITION: "Edition",
  DISTRICT_HQ: "District HQ", SUPPLEMENTS: "Supplements",
  EDITORIAL_PAGE: "Editorial Page", RND_TEAM: "R&D Team",
};

type SortKey = "title" | "owner" | "due_at" | "status" | "level";
const PAGE_SIZES = [10, 25, 50];

export default function ContentPlanningClient({
  initialPlans, initialTotal, role, labels,
}: {
  initialPlans: ContentPlan[]; initialTotal: number; role: Role; labels: Record<string, string>;
}) {
  const router = useRouter();
  const L = (key: string, fallback: string) => labels[key] ?? fallback;
  const canEdit = canWrite(role);
  const canRemove = canDelete(role);

  const [plans, setPlans] = useState(initialPlans);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<Set<PlanLevel>>(new Set());
  const [ownerFilter, setOwnerFilter] = useState<Set<string>>(new Set());
  const [timeframe, setTimeframe] = useState<Timeframe>("DAILY");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("due_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [allOwners, setAllOwners] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [showLevelDrop, setShowLevelDrop] = useState(false);
  const [showOwnerDrop, setShowOwnerDrop] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const isFirstRender = useRef(true);

  // Debounce search input (350ms) so we don't hit the DB on every keystroke
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Load the distinct owners list once, for the filter dropdown
  useEffect(() => {
    fetch("/api/content-plans/meta").then((r) => r.json()).then((j) => setAllOwners(j.owners ?? []));
  }, []);

  // Re-fetch from the server whenever any filter/sort/page changes
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, levelFilter, ownerFilter, debouncedSearch, dateFrom, dateTo, sortKey, sortDir, page, pageSize]);

  function buildParams(overrides?: Record<string, string>) {
    const params = new URLSearchParams();
    params.set("timeframe", timeframe);
    if (levelFilter.size) params.set("levels", Array.from(levelFilter).join(","));
    if (ownerFilter.size) params.set("owners", Array.from(ownerFilter).join(","));
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("sortKey", sortKey);
    params.set("sortDir", sortDir);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (overrides) Object.entries(overrides).forEach(([k, v]) => params.set(k, v));
    return params;
  }

  async function fetchPage() {
    setLoading(true);
    const res = await fetch(`/api/content-plans?${buildParams()}`);
    const json = await res.json();
    setLoading(false);
    if (json.data) { setPlans(json.data); setTotal(json.total ?? 0); }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreate(formData: FormData) {
    const payload = {
      timeframe: formData.get("timeframe"), level: formData.get("level"),
      title: formData.get("title"), owner: formData.get("owner"),
      dueAt: formData.get("dueAt"), status: formData.get("status"),
    };
    const res = await fetch("/api/content-plans", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) { setShowForm(false); fetchPage(); }
  }

  async function handleStatusChange(id: string, status: string) {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, status: status as PlanStatus } : p)));
    await fetch(`/api/content-plans/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this plan? This cannot be undone.")) return;
    setPlans((prev) => prev.filter((p) => p.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    await fetch(`/api/content-plans/${id}`, { method: "DELETE" });
  }

  async function runAiAnalysis() {
    if (selected.size === 0) return;
    setAiLoading(true); setAiError(null); setAiResult(null);
    const res = await fetch("/api/content-plans/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    const json = await res.json();
    setAiLoading(false);
    if (!res.ok) { setAiError(json.error ?? "Analysis failed."); return; }
    setAiResult(json.analysis);
  }

  function rowsToExportFormat(rows: ContentPlan[]) {
    return rows.map((p) => ({
      Title: p.title, Level: LEVEL_LABEL[p.level], Owner: p.owner,
      Due: new Date(p.due_at).toLocaleString("en-IN"),
      Status: STATUS_LABEL[p.status] ?? p.status,
    }));
  }

  // "Selected" → fetch exactly those rows regardless of page.
  // Otherwise → fetch ALL rows matching current filters (capped at 5000),
  // not just the currently-loaded page.
  async function exportRows(kind: "csv" | "xlsx" | "pdf") {
    setExporting(true);
    let rows: ContentPlan[];
    if (selected.size > 0) {
      const res = await fetch(`/api/content-plans?ids=${Array.from(selected).join(",")}&pageSize=5000`);
      const json = await res.json();
      rows = json.data ?? [];
    } else {
      const params = buildParams({ page: "1", pageSize: "5000" });
      const res = await fetch(`/api/content-plans?${params}`);
      const json = await res.json();
      rows = json.data ?? [];
    }
    setExporting(false);
    const formatted = rowsToExportFormat(rows);
    if (formatted.length === 0) return;
    if (kind === "csv") exportCSV(formatted, "content-plans");
    if (kind === "xlsx") exportExcel(formatted, "content-plans");
    if (kind === "pdf") exportPDF(formatted, "content-plans", "Content Plans — The Desk");
  }

  return (
    <div className="max-w-6xl">
      <div className="border-b border-rule pb-3 mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[2px] text-red font-semibold">Planning</div>
          <h1 className="font-serif text-[26px] font-semibold mt-1">
            {L("content_planning.heading", "Content Planning")}
          </h1>
          <p className="text-[13px] text-ink-soft max-w-xl">
            {L("content_planning.subheading", "Annual, monthly, weekly and daily content plans across every level of the organization.")}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[1px] text-ink-soft border border-rule px-2 py-1 shrink-0">
          {role.replace("_", " ")}
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="flex flex-col">
          <label className="text-[10px] uppercase tracking-[1.5px] text-ink-soft mb-1">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title or owner…"
            className="font-mono text-[12.5px] px-3 py-1.5 border border-ink bg-white min-w-[180px]"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-[10px] uppercase tracking-[1.5px] text-ink-soft mb-1">Planning horizon</label>
          <select
            value={timeframe}
            onChange={(e) => { setTimeframe(e.target.value as Timeframe); setPage(1); }}
            className="font-mono text-[12.5px] px-3 py-1.5 border border-ink bg-white"
          >
            {["ANNUAL", "MONTHLY", "WEEKLY", "DAILY"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="relative flex flex-col">
          <label className="text-[10px] uppercase tracking-[1.5px] text-ink-soft mb-1">Level</label>
          <button onClick={() => setShowLevelDrop((s) => !s)}
            className="font-mono text-[12.5px] px-3 py-1.5 border border-ink bg-white min-w-[140px] text-left">
            {levelFilter.size === 0 ? "All Levels" : `${levelFilter.size} selected`}
          </button>
          {showLevelDrop && (
            <div className="absolute top-full mt-1 z-20 bg-white border border-ink p-2 min-w-[180px] shadow-lg">
              {Object.entries(LEVEL_LABEL).map(([k, v]) => (
                <label key={k} className="flex items-center gap-2 text-[12px] py-1 cursor-pointer">
                  <input type="checkbox" checked={levelFilter.has(k as PlanLevel)}
                    onChange={() => {
                      setLevelFilter((prev) => {
                        const next = new Set(prev);
                        next.has(k as PlanLevel) ? next.delete(k as PlanLevel) : next.add(k as PlanLevel);
                        return next;
                      });
                      setPage(1);
                    }} />
                  {v}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="relative flex flex-col">
          <label className="text-[10px] uppercase tracking-[1.5px] text-ink-soft mb-1">Owner</label>
          <button onClick={() => setShowOwnerDrop((s) => !s)}
            className="font-mono text-[12.5px] px-3 py-1.5 border border-ink bg-white min-w-[140px] text-left">
            {ownerFilter.size === 0 ? "All Owners" : `${ownerFilter.size} selected`}
          </button>
          {showOwnerDrop && (
            <div className="absolute top-full mt-1 z-20 bg-white border border-ink p-2 min-w-[220px] max-h-[220px] overflow-y-auto shadow-lg">
              {allOwners.map((o) => (
                <label key={o} className="flex items-center gap-2 text-[12px] py-1 cursor-pointer">
                  <input type="checkbox" checked={ownerFilter.has(o)}
                    onChange={() => {
                      setOwnerFilter((prev) => {
                        const next = new Set(prev);
                        next.has(o) ? next.delete(o) : next.add(o);
                        return next;
                      });
                      setPage(1);
                    }} />
                  {o}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <label className="text-[10px] uppercase tracking-[1.5px] text-ink-soft mb-1">Due from</label>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="font-mono text-[12.5px] px-3 py-1.5 border border-ink bg-white" />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] uppercase tracking-[1.5px] text-ink-soft mb-1">Due to</label>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="font-mono text-[12.5px] px-3 py-1.5 border border-ink bg-white" />
        </div>

        {canEdit && (
          <button onClick={() => setShowForm(true)} className="ml-auto font-mono text-[12px] uppercase tracking-[1px] bg-ink text-paper px-4 py-2">
            {L("content_planning.new_button", "+ New Plan")}
          </button>
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 text-[12px]">
        <span className="text-ink-soft">
          {loading ? "Loading…" : selected.size > 0 ? `${selected.size} selected` : `${total} plans total`}
        </span>
        <button onClick={runAiAnalysis} disabled={selected.size === 0 || aiLoading}
          className="font-mono text-[11px] uppercase tracking-[1px] bg-red text-white px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
          {aiLoading ? "Analyzing…" : L("content_planning.ai_button", "AI Analysis")}
        </button>
        <div className="ml-auto flex gap-1">
          <span className="text-[10.5px] text-ink-soft self-center mr-1">
            {selected.size > 0 ? "Export selected:" : "Export all matching:"}
          </span>
          <button onClick={() => exportRows("csv")} disabled={exporting} className="text-[11px] uppercase tracking-[1px] border border-ink px-2.5 py-1.5 disabled:opacity-40">CSV</button>
          <button onClick={() => exportRows("xlsx")} disabled={exporting} className="text-[11px] uppercase tracking-[1px] border border-ink px-2.5 py-1.5 disabled:opacity-40">Excel</button>
          <button onClick={() => exportRows("pdf")} disabled={exporting} className="text-[11px] uppercase tracking-[1px] border border-ink px-2.5 py-1.5 disabled:opacity-40">PDF</button>
        </div>
      </div>

      {(aiResult || aiError) && (
        <div className="bg-card border border-rule p-4 mb-4 whitespace-pre-wrap text-[13px] leading-relaxed">
          {aiError ? <span className="text-red">{aiError}</span> : aiResult}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block bg-card border border-rule p-1 overflow-x-auto">
        <table className="w-full text-[12.5px] border-collapse">
          <thead>
            <tr>
              <th className="w-8 px-3 py-2 border-b-2 border-ink"></th>
              {([["title", "Title"], ["level", "Level"], ["owner", "Owner"], ["due_at", "Due"], ["status", "Status"]] as [SortKey, string][]).map(([key, label]) => (
                <th key={key} onClick={() => toggleSort(key)}
                  className="text-left text-[10.5px] uppercase tracking-[.8px] text-ink-soft px-3 py-2 border-b-2 border-ink cursor-pointer select-none">
                  {label}{sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th className="w-8 border-b-2 border-ink"></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} onClick={() => router.push(`/content-planning/${p.id}`)}
                className="border-b border-rule hover:bg-paper-dim cursor-pointer">
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelected(p.id)} />
                </td>
                <td className="px-3 py-2 font-medium">{p.title}</td>
                <td className="px-3 py-2">{LEVEL_LABEL[p.level]}</td>
                <td className="px-3 py-2">{p.owner}</td>
                <td className="px-3 py-2 font-mono">
                  {new Date(p.due_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <StatusBadge status={p.status} editable={canEdit} onChange={(next) => handleStatusChange(p.id, next)} />
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  {canRemove && <button onClick={() => handleDelete(p.id)} className="text-ink-soft hover:text-red text-[13px]">✕</button>}
                </td>
              </tr>
            ))}
            {!loading && plans.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-soft">No plans match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {plans.map((p) => (
          <div key={p.id} onClick={() => router.push(`/content-planning/${p.id}`)} className="bg-card border border-rule p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-[13.5px]">{p.title}</div>
              <div onClick={(e) => e.stopPropagation()}>
                <StatusBadge status={p.status} editable={canEdit} onChange={(next) => handleStatusChange(p.id, next)} />
              </div>
            </div>
            <div className="text-[12px] text-ink-soft mt-1">{LEVEL_LABEL[p.level]} · {p.owner}</div>
            <div className="text-[11.5px] font-mono text-ink-soft mt-1">
              Due {new Date(p.due_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
        {!loading && plans.length === 0 && <div className="text-center text-ink-soft py-6 text-[13px]">No plans match this filter.</div>}
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-3 mt-4 text-[12px]">
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="border border-rule-strong px-2 py-1 font-mono">
          {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
        </select>
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 border border-rule-strong disabled:opacity-40">Prev</button>
        <span className="text-ink-soft">Page {page} of {totalPages} ({total} total)</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 border border-rule-strong disabled:opacity-40">Next</button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={L("content_planning.new_button", "New Content Plan")}>
        <form action={handleCreate} className="grid grid-cols-2 gap-3">
          <input name="title" required placeholder="Plan title" className="col-span-2 border border-rule-strong px-3 py-2 text-sm" />
          <select name="timeframe" className="border border-rule-strong px-3 py-2 text-sm">
            {["ANNUAL", "MONTHLY", "WEEKLY", "DAILY"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select name="level" className="border border-rule-strong px-3 py-2 text-sm">
            {Object.entries(LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input name="owner" required placeholder="Owner" className="border border-rule-strong px-3 py-2 text-sm" />
          <input name="dueAt" type="datetime-local" required className="border border-rule-strong px-3 py-2 text-sm" />
          <select name="status" className="border border-rule-strong px-3 py-2 text-sm col-span-2">
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button type="submit" className="col-span-2 font-mono text-[12px] uppercase tracking-[1px] bg-red text-white py-2">
            Save plan
          </button>
        </form>
      </Modal>
    </div>
  );
}
