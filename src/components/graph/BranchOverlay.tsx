"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { branchOverlayView, type BranchOverlaySource } from "@/lib/branchOverlay";
import type { GraphEvidence } from "@/lib/graphEvidence";
import { POPULATION_NOUN, SOURCE_NAME, formatCount, formatShare } from "@/lib/learnerEvidence";
import type { EvidenceSource } from "@/schemas";
import { cn } from "@/lib/utils";

import styles from "./graph.module.css";

type Props = {
  skillId: string;
  evidence: GraphEvidence;
  nameOf: (id: string) => string;
  onSelectSkill: (id: string) => void;
};

/**
 * "What learners did next" for the selected skill (§15.8, D-18): by default ONE source — the
 * larger population above the floor — and its top three next-skills with their shrunk transition
 * share and count; "show more" opens the second source and up to four steps per source, each
 * list under its source caveat. Out-of-catalog steps are greyed, never hidden. Below the floor a
 * source says so instead of showing numbers. Shares are transition shares only — never a rating (N-5).
 */
export function BranchOverlay({ skillId, evidence, nameOf, onSelectSkill }: Props) {
  const [expanded, setExpanded] = useState(false);
  const bySource = evidence.branches[skillId] ?? {};
  const view = branchOverlayView(bySource, expanded);
  const anyMet = view.stepLimit > 0;
  const present = (["stackoverflow", "coursera"] as const).filter((s) => bySource[s]);
  return (
    <section className={styles.branch} data-testid="branch-overlay" data-state={anyMet ? "met" : "below-floor"} data-expanded={expanded ? "true" : "false"} aria-label={`What learners did after ${nameOf(skillId)}`}>
      <p className={cn("label-caps", styles.branchTitle)}>What learners did next</p>
      {anyMet ? (
        <>
          {view.sources.map((s) => (
            <SourceRow key={s} source={s} entry={bySource[s]} stepLimit={view.stepLimit} skillId={skillId} evidence={evidence} nameOf={nameOf} onSelectSkill={onSelectSkill} />
          ))}
          {view.canExpand && (
            <button type="button" className={styles.branchMore} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} data-testid="branch-overlay-more">
              <ChevronDown aria-hidden className={cn(styles.cardChevron, expanded && styles.cardChevronOpen)} />
              {expanded ? "show less" : present.length > 1 ? "show more · both sources" : "show more"}
            </button>
          )}
        </>
      ) : (
        <p className={styles.branchEmpty} data-testid="branch-overlay-empty">
          Not enough learner data on this step
          {present.map((s) => (
            <span key={s} className={styles.branchEmptyNote}>
              {" "}
              · {SOURCE_NAME[s]} saw {formatCount(bySource[s]!.nTotal)} (floor {evidence.branchFloors.minTotal})
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

function SourceRow({ source, entry, stepLimit, skillId, evidence, nameOf, onSelectSkill }: { source: EvidenceSource; entry: BranchOverlaySource | undefined; stepLimit: number; skillId: string; evidence: GraphEvidence; nameOf: (id: string) => string; onSelectSkill: (id: string) => void }) {
  if (!entry || !entry.minSupportMet) {
    return (
      <div className={styles.branchSource} data-testid={`branch-source-${source}`} data-state="below-floor">
        <p className={styles.branchSourceHead}>
          <span className={styles.branchSourceName}>{SOURCE_NAME[source]}</span>
        </p>
        <p className={styles.branchEmpty}>
          Not enough learner data on this step
          {entry && <span className={styles.branchEmptyNote}> · saw {formatCount(entry.nTotal)}, floor {evidence.branchFloors.minTotal}</span>}
        </p>
      </div>
    );
  }
  const steps = entry.steps.slice(0, stepLimit);
  return (
    <div className={styles.branchSource} data-testid={`branch-source-${source}`} data-state="met">
      <p className={styles.branchSourceHead}>
        <span className={styles.branchSourceName}>{SOURCE_NAME[source]}</span>
        <span className={styles.branchPopulation}>
          {formatCount(entry.nTotal)} {POPULATION_NOUN[source]} learned {nameOf(skillId)}
        </span>
      </p>
      <ul className={styles.branchSteps} aria-label={`Next skills after ${nameOf(skillId)}, ${SOURCE_NAME[source]}`}>
        {steps.map((step) => (
          <li key={step.to}>
            <button
              type="button"
              className={cn(styles.branchStep, !step.inCatalog && styles.branchStepOut)}
              onClick={() => onSelectSkill(step.to)}
              title={
                step.inCatalog
                  ? `${formatCount(step.n)} of ${formatCount(entry.nTotal)} went to ${nameOf(step.to)} next (${formatShare(step.shareShrunk)}, shrunk share). Click to select.`
                  : `${nameOf(step.to)}: no course in catalog yet — ${formatCount(step.n)} of ${formatCount(entry.nTotal)} went here next.`
              }
              data-testid="branch-step"
              data-in-catalog={step.inCatalog ? "true" : "false"}
            >
              <span className={styles.branchStepName}>{nameOf(step.to)}</span>
              <span className={styles.branchStepShare}>{formatShare(step.shareShrunk)}</span>
              <span className={styles.branchStepN}>n {formatCount(step.n)}</span>
              {!step.inCatalog && <span className={styles.branchStepOutNote}>no course in catalog yet</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className={styles.branchFoot}>
        Top {steps.length} of {entry.listed} next-skills seen at n ≥ {evidence.branchFloors.minListed} · shares shrunk (α = {evidence.branchFloors.alpha}); the rest went elsewhere
      </p>
      <p className={styles.branchCaveat}>{evidence.caveats[source]}</p>
    </div>
  );
}
