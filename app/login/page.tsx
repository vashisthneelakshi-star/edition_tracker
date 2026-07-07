"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/content-planning");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-rule p-8 w-full max-w-sm"
      >
        <div className="font-serif text-[24px] font-bold mb-1">
          THE <span className="text-red">DESK</span>
        </div>
        <p className="text-[12.5px] text-ink-soft mb-5">
          Sign in to Content Command
        </p>

        {error && (
          <div className="text-[12px] bg-red-50 text-red border border-red/30 px-3 py-2 mb-3">
            {error}
          </div>
        )}

        <label className="text-[10px] uppercase tracking-[1.5px] text-ink-soft">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-rule-strong px-3 py-2 text-sm mb-3 mt-1"
        />

        <label className="text-[10px] uppercase tracking-[1.5px] text-ink-soft">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-rule-strong px-3 py-2 text-sm mb-5 mt-1"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full font-mono text-[12px] uppercase tracking-[1px] bg-ink text-paper py-2.5 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-[11px] text-ink-soft mt-4">
          No account yet? Create one in Supabase Dashboard →
          Authentication → Users → "Add user", then ask an Admin to set
          your role in the <code>profiles</code> table.
        </p>
      </form>
    </div>
  );
}
