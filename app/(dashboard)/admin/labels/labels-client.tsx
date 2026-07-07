"use client";

import { useState } from "react";

type Label = { key: string; value: string };

export default function LabelsClient({
  initialLabels,
}: {
  initialLabels: Label[];
}) {
  const [labels, setLabels] = useState(initialLabels);
  const [saving, setSaving] = useState<string | null>(null);

  async function save(key: string, value: string) {
    setSaving(key);
    await fetch("/api/ui-labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    setSaving(null);
  }

  return (
    <div className="max-w-3xl">
      <div className="border-b border-rule pb-3 mb-5">
        <div className="text-[11px] uppercase tracking-[2px] text-red font-semibold">
          Admin
        </div>
        <h1 className="font-serif text-[26px] font-semibold mt-1">
          Labels & Text
        </h1>
        <p className="text-[13px] text-ink-soft">
          Every button, heading and status label used across the app. Change
          the value and it updates everywhere immediately — no code changes.
        </p>
      </div>

      <div className="bg-card border border-rule divide-y divide-rule">
        {labels.map((l) => (
          <div key={l.key} className="flex items-center gap-4 px-4 py-2.5">
            <code className="text-[11px] text-ink-soft w-64 shrink-0">
              {l.key}
            </code>
            <input
              defaultValue={l.value}
              onBlur={(e) => {
                if (e.target.value !== l.value) {
                  setLabels((prev) =>
                    prev.map((x) =>
                      x.key === l.key ? { ...x, value: e.target.value } : x
                    )
                  );
                  save(l.key, e.target.value);
                }
              }}
              className="flex-1 border border-rule-strong px-2 py-1 text-sm"
            />
            {saving === l.key && (
              <span className="text-[10px] text-ink-soft">saving…</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
