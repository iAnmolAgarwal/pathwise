"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StartPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/learners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: name }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not create learner");
      setBusy(false);
      return;
    }
    const learner = await res.json();
    router.push(`/learn/${learner.id}`);
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">Create a learner</h1>
      <form onSubmit={create} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Display name
          <input
            className="rounded border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={60}
          />
        </label>
        <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={busy}>
          {busy ? "Creating…" : "Continue"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </main>
  );
}
