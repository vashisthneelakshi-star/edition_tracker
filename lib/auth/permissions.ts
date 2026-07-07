// Pure functions + types only — NO next/headers, NO Supabase server client.
// Safe to import from both Server Components and "use client" Components.

export type Role = "ADMIN" | "STATE_HEAD" | "EDITOR" | "VIEWER";

export const canWrite = (role: Role) =>
  role === "ADMIN" || role === "STATE_HEAD" || role === "EDITOR";
export const canDelete = (role: Role) => role === "ADMIN";
export const canAdminister = (role: Role) => role === "ADMIN";
