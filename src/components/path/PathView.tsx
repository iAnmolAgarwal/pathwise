"use client";

import { ArrowUpRight, Check, GitBranch, HelpCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import type { Evidence, FeedbackEventType, Path, PathItemStatus } from "@/schemas";
import { Badge } from "@/components/ui/badge";
import { Orb } from "@/components/ui/orb";
import { cn } from "@/lib/utils";

import type { CatalogLite } from "./types";
import styles from "./path.module.css";

export type ItemFeedbackType = Exclude<FeedbackEventType, "quiz_result">;

type Props = {
  path: Path;
  catalog: Record<string, CatalogLite>;
  skillName: (id: string) => string;
  /** When set, items become selectable and the inline evidence collapses behind the selection. */
  onExplain?: (catalogId: string) => void;
  selectedId?: string | null;
  /** Rendered directly under the selected item (the "Why this?" panel). */
  explainSlot?: ReactNode;
  /** Feedback buttons appear when this is provided (§5.5). */
  onFeedback?: (catalogId: string, type: ItemFeedbackType) => void;
  pendingFeedback?: string | null;
  /** Show this item's evidence graphPath in the skill graph. */
  onShowInGraph?: (catalogId: string) => void;
  /** Items just added by the latest replan get a marker. */
  justAdded?: Set<string>;
};

const STATUS_LABEL: Record<PathItemStatus, string> = { todo: "To do", in_progress: "In progress", done: "Done", skipped: "Skipped" };
const FEEDBACK: { type: ItemFeedbackType; label: string; title: string }[] = [
  { type: "completed", label: "Done", title: "I completed this" },
  { type: "too_hard", label: "Too hard", title: "This assumed things I don't know yet" },
  { type: "too_easy", label: "Too easy", title: "I already know this" },
  { type: "not_interested", label: "Not for me", title: "Swap this for something else" },
];

const ENTER = { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

/** The path as a timeline: numbered phases, milestone lines, and one quiet card per item. */
export function PathView({ path, catalog, skillName, onExplain, selectedId, explainSlot, onFeedback, pendingFeedback, onShowInGraph, justAdded }: Props) {
  const reduce = useReducedMotion() ?? false;
  const items = path.phases.flatMap((p) => p.items);
  const hours = items.reduce((sum, i) => sum + (catalog[i.catalogId]?.durationHours ?? 0), 0);
  const done = items.filter((i) => i.status === "done").length;

  return (
    <div className={styles.view}>
      <ul className={styles.summary} aria-label="Path summary">
        <Stat value={path.phases.length} label={path.phases.length === 1 ? "phase" : "phases"} />
        <Stat value={items.length} label="items" />
        <Stat value={Math.round(hours)} label="hours" />
        <Stat value={done} label="done" tone={done > 0 ? "violet" : undefined} />
      </ul>

      <ol className={styles.phases}>
        {path.phases.map((phase, pi) => (
          <li key={phase.title} className={styles.phase}>
            <header className={styles.phaseHeader}>
              <span className={styles.phaseIndex}>{String(pi + 1).padStart(2, "0")}</span>
              <div className={styles.phaseText}>
                <h3 className={styles.phaseTitle}>{phase.title}</h3>
                <p className={styles.milestone}>
                  <span className="label-caps">Milestone</span>
                  {phase.milestone}
                </p>
              </div>
            </header>

            <ol className={styles.items}>
              <AnimatePresence initial={false}>
                {phase.items.map((item, ii) => {
                  const c = catalog[item.catalogId];
                  const settled = item.status === "done" || item.status === "skipped";
                  const added = justAdded?.has(item.catalogId) ?? false;
                  const selected = selectedId === item.catalogId;
                  const skills = item.evidence.gapSkillsCovered;
                  return (
                    <motion.li
                      key={item.catalogId}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, transition: { duration: 0.2 } }}
                      transition={{ ...ENTER, delay: reduce ? 0 : Math.min(ii * 0.04, 0.24) }}
                      className={cn(styles.item, selected && styles.itemSelected, added && styles.itemAdded, settled && styles.itemSettled)}
                      data-testid="path-item"
                      data-catalog-id={item.catalogId}
                      data-status={item.status}
                    >
                      <StatusNode status={item.status} />

                      <div className={styles.itemBody}>
                        <div className={styles.itemMeta}>
                          <Badge variant="kind">{c?.kind ?? "item"}</Badge>
                          {added && (
                            <Badge variant="violet" dot>
                              New
                            </Badge>
                          )}
                          {item.status !== "todo" && (
                            <span className={cn(styles.status, styles[`status_${item.status}`])}>{STATUS_LABEL[item.status]}</span>
                          )}
                          <span className={styles.provider}>{c?.provider}</span>
                          <span className={styles.dot} aria-hidden />
                          <span className={styles.mono}>{c?.durationHours}h</span>
                          <span className={styles.dot} aria-hidden />
                          <Difficulty level={c?.difficulty ?? 0} />
                        </div>

                        <a href={item.evidence.provenance} target="_blank" rel="noreferrer" className={cn(styles.title, item.status === "skipped" && styles.titleSkipped)}>
                          {c?.title ?? item.catalogId}
                          <ArrowUpRight aria-hidden />
                        </a>

                        {skills.length > 0 && (
                          <ul className={styles.skills} aria-label="Closes gap in">
                            {skills.slice(0, 4).map((g) => (
                              <li key={g.skillId} className={styles.skill} title={g.graphPath.map(skillName).join(" → ")}>
                                {skillName(g.skillId)}
                              </li>
                            ))}
                            {skills.length > 4 && <li className={cn(styles.skill, styles.skillMore)}>+{skills.length - 4}</li>}
                          </ul>
                        )}

                        {(onFeedback || onExplain || onShowInGraph) && (
                          <div className={styles.actions}>
                            {onFeedback && !settled && (
                              <div className={styles.feedback} data-testid="feedback-controls">
                                {FEEDBACK.map((f) => {
                                  const pending = pendingFeedback === `${item.catalogId}:${f.type}`;
                                  return (
                                    <button
                                      key={f.type}
                                      type="button"
                                      title={f.title}
                                      disabled={pendingFeedback !== null && pendingFeedback !== undefined}
                                      onClick={() => onFeedback(item.catalogId, f.type)}
                                      className={cn(styles.chip, f.type === "completed" && styles.chipDone, pending && styles.chipPending)}
                                      data-feedback={f.type}
                                    >
                                      {pending ? <Orb state="working" size={20} label="Applying" paused={reduce} /> : f.type === "completed" ? <Check aria-hidden /> : null}
                                      {f.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            <div className={styles.links}>
                              {onExplain && (
                                <button type="button" className={cn(styles.link, selected && styles.linkActive)} onClick={() => onExplain(item.catalogId)} aria-expanded={selected}>
                                  <HelpCircle aria-hidden /> Why this?
                                </button>
                              )}
                              {onShowInGraph && (
                                <button type="button" className={styles.link} onClick={() => onShowInGraph(item.catalogId)}>
                                  <GitBranch aria-hidden /> Show in graph
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {selected && explainSlot && <div className={styles.explain}>{explainSlot}</div>}
                        {!onExplain && <EvidenceBlock evidence={item.evidence} catalog={catalog} skillName={skillName} />}
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: "violet" }) {
  return (
    <li className={cn(styles.stat, tone === "violet" && styles.statViolet)}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </li>
  );
}

function StatusNode({ status }: { status: PathItemStatus }) {
  return (
    <span className={cn(styles.node, styles[`node_${status}`])} aria-label={STATUS_LABEL[status]} role="img">
      {status === "done" && <Check aria-hidden />}
    </span>
  );
}

function Difficulty({ level }: { level: number }) {
  return (
    <span className={styles.difficulty} aria-label={`Difficulty ${level} of 5`} role="img" title={`Difficulty ${level}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={cn(n <= level && styles.difficultyOn)} />
      ))}
    </span>
  );
}

const SCORE_ROWS: { key: keyof Evidence["scoreBreakdown"]; label: string; hint: string }[] = [
  { key: "coverage", label: "Coverage", hint: "How much of your gap this closes" },
  { key: "levelFit", label: "Level fit", hint: "How well its difficulty matches where you are" },
  { key: "preferenceFit", label: "Preference fit", hint: "Format, cost and pace against your preferences" },
  { key: "quality", label: "Quality", hint: "Rating and completions in the catalog" },
  { key: "similarity", label: "Similarity", hint: "Closeness to what you said you want" },
];

/** The structural evidence (§7): which gap skills it closes, why it comes after what it does, and the score. */
export function EvidenceBlock({ evidence, catalog, skillName }: { evidence: Evidence; catalog: Record<string, CatalogLite>; skillName: (id: string) => string }) {
  const b = evidence.scoreBreakdown;
  return (
    <div className={styles.evidence}>
      <div className={styles.evidenceCol}>
        <p className="label-caps">Closes gap in</p>
        <ul className={styles.gapList}>
          {evidence.gapSkillsCovered.map((g) => (
            <li key={g.skillId} className={styles.gapRow} title={g.graphPath.map(skillName).join(" → ")}>
              <span className={styles.gapSkill}>{skillName(g.skillId)}</span>
              <span className={styles.gapReason}>{g.reason === "goal" ? "required by your goal" : `needed for ${skillName(g.reason.replace("prereq-of:", ""))}`}</span>
            </li>
          ))}
        </ul>
        {evidence.sequencedAfter.length > 0 && (
          <>
            <p className={cn("label-caps", styles.evidenceSub)}>Comes after</p>
            <ul className={styles.gapList}>
              {evidence.sequencedAfter.map((s) => (
                <li key={s.catalogId} className={styles.gapRow}>
                  <span className={styles.gapSkill}>{catalog[s.catalogId]?.title ?? s.catalogId}</span>
                  <span className={styles.gapReason}>teaches {skillName(s.becauseSkill)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className={styles.evidenceCol}>
        <p className="label-caps">Score</p>
        <dl className={styles.scores}>
          {SCORE_ROWS.map((row) => (
            <ScoreBar key={row.key} label={row.label} hint={row.hint} value={b[row.key]} />
          ))}
          <ScoreBar label="Total" hint="Weighted sum the engine ranked by" value={b.total} total />
        </dl>
      </div>
    </div>
  );
}

function ScoreBar({ label, hint, value, total }: { label: string; hint: string; value: number; total?: boolean }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cn(styles.scoreRow, total && styles.scoreTotal)} title={hint}>
      <dt className={styles.scoreLabel}>{label}</dt>
      <dd className={styles.scoreTrack} aria-hidden>
        <span className={styles.scoreFill} style={{ width: `${pct}%` }} />
      </dd>
      <dd className={styles.scoreValue}>{value.toFixed(2)}</dd>
    </div>
  );
}
