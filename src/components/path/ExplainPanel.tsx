"use client";

import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import type { Evidence } from "@/schemas";
import { Orb } from "@/components/ui/orb";

import type { CatalogLite } from "./types";
import { EvidenceBlock } from "./PathView";
import styles from "./explain.module.css";

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
  const reduce = useReducedMotion() ?? false;
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
    <motion.section
      className={styles.panel}
      aria-label="Why this item"
      data-testid="explain-panel"
      initial={reduce ? false : { opacity: 0, y: -6, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className="label-caps">Why this is on your path</span>
          <h4 className={styles.title}>{item?.title ?? catalogId}</h4>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close explanation">
          <X />
        </button>
      </header>

      <div className={styles.grid}>
        <div className={styles.narration}>
          <p className={styles.narrationLabel}>
            <span className={styles.novaMark} aria-hidden>
              <span />
            </span>
            Nova says
          </p>
          {status === "loading" && (
            <p className={styles.loading} data-testid="narration-loading">
              <Orb state="searching" size={20} label="Reading the evidence" paused={reduce} />
              Reading the evidence…
            </p>
          )}
          {status === "ready" && (
            <p className={styles.text} data-testid="narration">
              {narration}
            </p>
          )}
          {(status === "degraded" || status === "error") && (
            <div className={styles.note} role="status">
              <p>{note}</p>
              <p className={styles.noteHint}>The evidence beside this is unaffected — it comes from the path, not the model.</p>
            </div>
          )}
        </div>

        <div className={styles.evidence}>
          <p className={styles.evidenceLabel}>The evidence</p>
          <EvidenceBlock evidence={evidence} catalog={catalog} skillName={skillName} />
        </div>
      </div>
    </motion.section>
  );
}
