"use client";

import { useState } from "react";

export const STATUS_STYLE: Record<string, string> = {
  APPROVED: "bg-green/10 text-green",
  SUBMITTED: "bg-green/10 text-green",
  IN_PROGRESS: "bg-amber/10 text-amber",
  DRAFTING: "bg-amber/10 text-amber",
  PENDING_REVIEW: "bg-amber/10 text-amber",
  AWAITING_OPTIONS: "bg-red/10 text-red",
};

export const STATUS_LABEL: Record<string, string> = {
  APPROVED: "Approved",
  SUBMITTED: "Submitted",
  IN_PROGRESS: "In progress",
  DRAFTING: "Drafting",
  PENDING_REVIEW: "Pending review",
  AWAITING_OPTIONS: "Awaiting options",
};

const ALL_STATUSES = Object.keys(STATUS_LABEL);

export default function StatusBadge({
  status,
  editable,
  onChange,
}: {
  status: string;
  editable: boolean;
  onChange?: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing && editable) {
    return (
      <select
        autoFocus
        value={status}
        onChange={(e) => {
          onChange?.(e.target.value);
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
        className="text-[10.5px] font-mono border border-rule-strong px-1 py-0.5"
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    );
  }

  return (
    <button
      type="button"
      disabled={!editable}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className={`inline-block px-2 py-0.5 text-[10.5px] uppercase tracking-[.5px] font-mono font-semibold ${STATUS_STYLE[status]} ${editable ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
      title={editable ? "Click to change status" : undefined}
    >
      {STATUS_LABEL[status]}
    </button>
  );
}
