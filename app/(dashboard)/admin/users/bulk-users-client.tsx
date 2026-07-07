"use client";

import { useState } from "react";
import Papa from "papaparse";
import { exportCSV } from "@/lib/export";

type Row = { email: string; fullName?: string; role?: string };
type Result = { email: string; status: string; tempPassword?: string; error?: string };

const BATCH_SIZE = 40;
const VALID_ROLES = ["ADMIN", "STATE_HEAD", "EDITOR", "VIEWER"];

export default function BulkUsersClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  function handleFile(file: File) {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const parsed: Row[] = res.data.map((r) => ({
          email: r.email || r.Email || "",
          fullName: r.full_name || r.fullName || r.name || r.Name || "",
          role: VALID_ROLES.includes((r.role || r.Role || "").toUpperCase())
            ? (r.role || r.Role).toUpperCase()
            : "VIEWER",
        })).filter((r) => r.email);
        setRows(parsed);
        setResults([]);
        setDone(0);
      },
    });
  }

  async function startImport() {
    setRunning(true);
    setResults([]);
    setDone(0);
    const allResults: Result[] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const res = await fetch("/api/admin/bulk-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: batch }),
      });
      const json = await res.json();
      if (json.results) allResults.push(...json.results);
      setDone(Math.min(rows.length, i + batch.length));
      setResults([...allResults]);
    }
    setRunning(false);
  }

  function downloadResults() {
    const formatted = results.map((r) => ({
      Email: r.email,
      Status: r.status,
      "Temp Password": r.tempPassword ?? "",
      Error: r.error ?? "",
    }));
    if (formatted.length) exportCSV(formatted, "bulk-user-import-results");
  }

  const created = results.filter((r) => r.status === "created").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const existing = results.filter((r) => r.status === "already_exists").length;

  return (
    <div className="max-w-3xl">
      <div className="border-b border-rule pb-3 mb-5">
        <div className="text-[11px] uppercase tracking-[2px] text-red font-semibold">Admin</div>
        <h1 className="font-serif text-[26px] font-semibold mt-1">Bulk User Import</h1>
        <p className="text-[13px] text-ink-soft max-w-xl">
          Upload a CSV with columns <code>email</code>, <code>full_name</code>, <code>role</code>
          (role: ADMIN / STATE_HEAD / EDITOR / VIEWER — defaults to VIEWER if blank/invalid).
          Each user gets a temporary password — download the results and share
          passwords with staff through your usual internal channel (WhatsApp/SMS),
          since bulk email invites need custom SMTP configured in Supabase first.
        </p>
      </div>

      <div className="bg-card border border-rule p-5 mb-5">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="text-[13px]"
        />
        {fileName && (
          <p className="text-[12px] text-ink-soft mt-2">
            {fileName} — {rows.length} valid row(s) found
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="bg-card border border-rule p-1 mb-4 max-h-[240px] overflow-y-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr>
                  {["Email", "Full Name", "Role"].map((h) => (
                    <th key={h} className="text-left text-[10px] uppercase tracking-[.8px] text-ink-soft px-3 py-2 border-b-2 border-ink">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-b border-rule">
                    <td className="px-3 py-1.5">{r.email}</td>
                    <td className="px-3 py-1.5">{r.fullName}</td>
                    <td className="px-3 py-1.5 font-mono">{r.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && (
              <div className="text-[11px] text-ink-soft px-3 py-2">…and {rows.length - 20} more</div>
            )}
          </div>

          <button
            onClick={startImport}
            disabled={running}
            className="font-mono text-[12px] uppercase tracking-[1px] bg-ink text-paper px-4 py-2 disabled:opacity-50"
          >
            {running ? `Importing… ${done}/${rows.length}` : `Import ${rows.length} users`}
          </button>
        </>
      )}

      {results.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-4 mb-3 text-[12.5px]">
            <span className="text-green font-medium">{created} created</span>
            <span className="text-amber font-medium">{existing} already existed</span>
            <span className="text-red font-medium">{failed} failed</span>
            <button onClick={downloadResults} className="ml-auto font-mono text-[11px] uppercase tracking-[1px] border border-ink px-3 py-1.5">
              Download results (with passwords)
            </button>
          </div>
          <div className="bg-card border border-rule p-1 max-h-[300px] overflow-y-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr>
                  {["Email", "Status", "Temp Password", "Error"].map((h) => (
                    <th key={h} className="text-left text-[10px] uppercase tracking-[.8px] text-ink-soft px-3 py-2 border-b-2 border-ink">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-rule">
                    <td className="px-3 py-1.5">{r.email}</td>
                    <td className={`px-3 py-1.5 font-mono ${r.status === "created" ? "text-green" : r.status === "failed" ? "text-red" : "text-amber"}`}>
                      {r.status}
                    </td>
                    <td className="px-3 py-1.5 font-mono">{r.tempPassword ?? "—"}</td>
                    <td className="px-3 py-1.5 text-ink-soft">{r.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
