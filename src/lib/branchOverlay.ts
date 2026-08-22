import type { Branch, EvidenceSource } from "@/schemas";

/**
 * The "what learners did next" overlay the skill-graph explorer shows for a selected skill
 * (§15.8, D-18): per source, the top next-skills by shrunk share with their counts, or an
 * honest "below the floor" marker. Built server-side from branches.json; every number is copied,
 * the only computation here is ranking and truncation to BRANCH_OVERLAY_LIMIT.
 */

/** Next-skills shown per source for one selected skill. */
export const BRANCH_OVERLAY_LIMIT = 4;

export type BranchOverlayStep = { to: string; n: number; shareShrunk: number; inCatalog: boolean };

export type BranchOverlaySource =
  | {
      source: EvidenceSource;
      minSupportMet: true;
      nTotal: number;
      /** Successors listed in the file (all at n ≥ 5), of which the top ones are shown. */
      listed: number;
      /** Distinct next-skills the source observed, listed or not. */
      nNextObserved: number;
      steps: BranchOverlayStep[];
    }
  | { source: EvidenceSource; minSupportMet: false; nTotal: number };

/** skillId → per-source overlay entries (a source is absent when it never observed the skill). */
export type BranchOverlay = Record<string, Partial<Record<EvidenceSource, BranchOverlaySource>>>;

export const EVIDENCE_SOURCES: readonly EvidenceSource[] = ["stackoverflow", "coursera"];

/**
 * One source's overlay for one skill. Below the floor the entry carries only nTotal, so the UI can
 * say "not enough learner data on this step" and nothing else; above it, the top `limit` next-skills
 * by shrunk share (count breaks ties), never a successor with n < 5.
 */
export function branchOverlayFor(branch: Branch, limit: number = BRANCH_OVERLAY_LIMIT): BranchOverlaySource {
  if (!branch.minSupportMet || branch.nTotal < 50) return { source: branch.source, minSupportMet: false, nTotal: branch.nTotal };
  const steps = branch.next
    .filter((x) => x.n >= 5)
    .sort((a, b) => b.shareShrunk - a.shareShrunk || b.n - a.n || a.to.localeCompare(b.to))
    .slice(0, limit)
    .map((x) => ({ to: x.to, n: x.n, shareShrunk: x.shareShrunk, inCatalog: x.inCatalog }));
  return { source: branch.source, minSupportMet: true, nTotal: branch.nTotal, listed: branch.next.length, nNextObserved: branch.nNextObserved, steps };
}

export function buildBranchOverlay(branches: readonly Branch[], limit: number = BRANCH_OVERLAY_LIMIT): BranchOverlay {
  const out: BranchOverlay = {};
  for (const b of branches) (out[b.from] ??= {})[b.source] = branchOverlayFor(b, limit);
  return out;
}

/** Next-skills shown per source while the overlay is collapsed (the de-clutter default). */
export const BRANCH_OVERLAY_COLLAPSED_LIMIT = 3;

export type BranchOverlayView = {
  /** Sources to render, in order: collapsed = the larger met source only; expanded = every source, larger first. */
  sources: EvidenceSource[];
  /** Steps per rendered source. */
  stepLimit: number;
  /** Whether "show more" has anything to add: a second source, or a fourth step on the shown one. */
  canExpand: boolean;
};

/**
 * Which sources and how many steps the overlay shows (§9.4 de-clutter): by default ONE source —
 * the one with the larger population among those above the floor — and its top three next-skills;
 * expanded, both sources with up to BRANCH_OVERLAY_LIMIT each. Below-floor sources are listed only
 * when expanded (with their "not enough data" wording), never counted as the default.
 */
export function branchOverlayView(bySource: Partial<Record<EvidenceSource, BranchOverlaySource>>, expanded: boolean): BranchOverlayView {
  const present = EVIDENCE_SOURCES.filter((s) => bySource[s]);
  const met = present.filter((s) => bySource[s]!.minSupportMet).sort((a, b) => bySource[b]!.nTotal - bySource[a]!.nTotal);
  const ordered = [...met, ...present.filter((s) => !bySource[s]!.minSupportMet)];
  if (met.length === 0) return { sources: ordered, stepLimit: 0, canExpand: false };
  const lead = bySource[met[0]]!;
  const leadSteps = lead.minSupportMet ? lead.steps.length : 0;
  const canExpand = ordered.length > 1 || leadSteps > BRANCH_OVERLAY_COLLAPSED_LIMIT;
  if (expanded) return { sources: ordered, stepLimit: BRANCH_OVERLAY_LIMIT, canExpand };
  return { sources: [met[0]], stepLimit: BRANCH_OVERLAY_COLLAPSED_LIMIT, canExpand };
}
