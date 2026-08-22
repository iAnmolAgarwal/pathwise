"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Orb } from "@/components/ui/orb";

/** One field, one button: a named learner under the signed-in account. */
export function NewLearnerForm({ autoFocus = true }: { autoFocus?: boolean }) {
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
      setError((await res.json().catch(() => ({}))).error ?? "Could not create learner");
      setBusy(false);
      return;
    }
    const learner = await res.json();
    router.push(`/learn/${learner.id}`);
  }

  return (
    <form onSubmit={create} className="flex w-full flex-col gap-3 rounded-panel border border-line bg-surface-2 p-5 text-left shadow-float">
      <label className="flex flex-col gap-2 text-[13px] text-ink-2">
        What should Nova call this learner?
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          required
          maxLength={60}
          autoFocus={autoFocus}
          name="displayName"
          autoComplete="name"
        />
      </label>
      <Button type="submit" size="lg" disabled={busy || !name.trim()} className="mt-1 w-full">
        {busy ? (
          <>
            <Orb state="working" size={20} label="Creating your space" /> Creating your space
          </>
        ) : (
          <>
            Continue <ArrowRight data-icon="inline-end" />
          </>
        )}
      </Button>
      {error && (
        <p className="text-[13px] text-coral" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
