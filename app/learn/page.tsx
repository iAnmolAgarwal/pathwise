"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Orb } from "@/components/ui/orb";

/** Entry to the app: one field, one button — a learner id is all Nova needs (D-07). */
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
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink px-6 py-16">
      <div className="bg-vignette pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex w-full max-w-[420px] flex-col items-center text-center">
        <Link href="/" className="label-caps text-ink-3 transition-colors hover:text-ink-1">
          Pathwise
        </Link>
        <h1 className="mt-6 text-[clamp(2.2rem,4vw,3rem)] font-[420] leading-[1.06] tracking-[-0.047em]">
          Start with a <span className="text-gradient-violet">name</span>.
        </h1>
        <p className="mt-4 max-w-[36ch] text-lead text-ink-2">
          Nova keeps everything under it — your goal, your skills, every version of your path. No account needed.
        </p>

        <form onSubmit={create} className="mt-8 flex w-full flex-col gap-3 rounded-panel border border-line bg-surface-2 p-5 text-left shadow-float">
          <label className="flex flex-col gap-2 text-[13px] text-ink-2">
            What should Nova call you?
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              maxLength={60}
              autoFocus
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
        <p className="mt-4 text-[12px] text-ink-3">Your workspace link is private to whoever has it — bookmark it to come back.</p>
      </div>
    </main>
  );
}
