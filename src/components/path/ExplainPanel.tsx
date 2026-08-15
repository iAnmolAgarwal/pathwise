"use client";

import { useEffect, useState } from "react";
import type { Evidence } from "@/schemas";
import type { CatalogLite } from "./PathBuilder";
import { EvidenceBlock } from "./PathView";

type Props = {
  learnerId: string;
  catalogId: string;
  evidence: Evidence;
  catalog: Record<string, CatalogLite>;
  skillName: (id: string) => string;
  onClose: () => void;
};

/**
 * Both renderings of §7 side by side: the structural evidence (pure, from the path) and the
 * narration the model produced from that same evidence. Any drift is visible at a glance.
 */
export function ExplainPanel({ learnerId, catalogId, evidence, catalog, skillName, onClose }: Props) {
  const [narration, setNarration] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "degraded" | "error">("loading");
  const [note, setNote] = useState<string | null>(null);
  const item = catalog[catalogId];

  // The parent keys this component by catalogId, so each item starts from the loading state.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ learnerId, catalogId }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setNote(body.error ?? "Could not explain this item");
          return;
        }
        if (body.narration) {
          setNarration(body.narration);
          setStatus("ready");
        } else {
          setStatus("degraded");
          setNote(body.degraded?.message ?? "Narration unavailable right now.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
          setNote("Could not reach the server");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId, catalogId]);

  return (
    <section className="rounded border bg-neutral-50 p-4 text-sm" aria-label="Why this item" data-testid="explain-panel">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase text-neutral-500">Why this is on your path</p>
          <h3 className="font-semibold">{item?.title ?? catalogId}</h3>
        </div>
        <button type="button" className="rounded border px-2 py-0.5 text-xs" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-neutral-500">Nova says</p>
          {status === "loading" && <p className="mt-1 text-neutral-400" data-testid="narration-loading">Reading the evidence…</p>}
          {status === "ready" && (
            <p className="mt-1 whitespace-pre-wrap" data-testid="narration">
              {narration}
            </p>
          )}
          {(status === "degraded" || status === "error") && <p className="mt-1 text-amber-800">{note}</p>}
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-500">The evidence</p>
          <EvidenceBlock evidence={evidence} catalog={catalog} skillName={skillName} />
        </div>
      </div>
    </section>
  );
}
