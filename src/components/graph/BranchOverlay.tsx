"use client";

import type { BranchOverlaySource } from "@/lib/branchOverlay";
import type { GraphEvidence } from "@/lib/graphEvidence";
import { POPULATION_NOUN, SOURCE_NAME, formatCount, formatShare } from "@/lib/learnerEvidence";
import type { EvidenceSource } from "@/schemas";
import { cn } from "@/lib/utils";

import styles from "./graph.module.css";

const SOURCES: readonly EvidenceSource[] = ["stackoverflow", "coursera"];

type Props = {
  skillId: string;
  evidence: GraphEvidence;
  nameOf: (id: string) => string;
  onSelectSkill: (id: string) => void;
};

/**
 * "What learners did next" for the selected skill (§15.8, D-18): per source, up to four
 * next-skills with their shrunk transition share and count, out-of-catalog steps greyed but
 * never hidden, the source caveat under every list. Below the floor a source says so instead
 * of showing numbers. Shares are transition shares only — nothing here is a rating (N-5).
 */
export function BranchOverlay({ skillId, evidence, nameOf, onSelectSkill }: Props) {
  const bySource = evidence.branches[skillId] ?? {};
  const anyMet = SOURCES.some((s) => bySource[s]?.minSupportMet);
  return (
    <section className={styles.branch} data-testid="branch-overlay" data-state={anyMet ? "met" : "below-floor"} aria-label={`What learners did after ${nameOf(skillId)}`}>
      <p className={cn("label-caps", styles.branchTitle)}>What learners did next</p>
      {anyMet ? (
        SOURCES.map((s) => <SourceRow key={s} source={s} entry={bySource[s]} skillId={skillId} evidence={evidence} nameOf={nameOf} onSelectSkill={onSelectSkill} />)
      ) : (
        <p className={styles.branchEmpty} data-testid="branch-overlay-empty">
          Not enough learner data on this step
          {SOURCES.filter((s) => bySource[s]).map((s) => (
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

function SourceRow({ source, entry, skillId, evidence, nameOf, onSelectSkill }: { source: EvidenceSource; entry: BranchOverlaySource | undefined; skillId: string; evidence: GraphEvidence; nameOf: (id: string) => string; onSelectSkill: (id: string) => void }) {
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
  return (
    <div className={styles.branchSource} data-testid={`branch-source-${source}`} data-state="met">
      <p className={styles.branchSourceHead}>
        <span className={styles.branchSourceName}>{SOURCE_NAME[source]}</span>
        <span className={styles.branchPopulation}>
          {formatCount(entry.nTotal)} {POPULATION_NOUN[source]} learned {nameOf(skillId)}
        </span>
      </p>
      <ul className={styles.branchSteps} aria-label={`Next skills after ${nameOf(skillId)}, ${SOURCE_NAME[source]}`}>
        {entry.steps.map((step) => (
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
        Top {entry.steps.length} of {entry.listed} next-skills seen at n ≥ {evidence.branchFloors.minListed} · shares shrunk (α = {evidence.branchFloors.alpha}); the rest went elsewhere
      </p>
      <p className={styles.branchCaveat}>{evidence.caveats[source]}</p>
    </div>
  );
}
