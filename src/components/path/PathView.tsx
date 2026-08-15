import type { Evidence, FeedbackEventType, Path, PathItemStatus } from "@/schemas";
import type { CatalogLite } from "./PathBuilder";

export type ItemFeedbackType = Exclude<FeedbackEventType, "quiz_result">;

type Props = {
  path: Path;
  catalog: Record<string, CatalogLite>;
  skillName: (id: string) => string;
  /** When set, items become selectable and the inline evidence collapses behind the selection. */
  onExplain?: (catalogId: string) => void;
  selectedId?: string | null;
  /** Feedback buttons appear when this is provided (§5.5). */
  onFeedback?: (catalogId: string, type: ItemFeedbackType) => void;
  pendingFeedback?: string | null;
  /** Show this item's evidence graphPath in the skill graph. */
  onShowInGraph?: (catalogId: string) => void;
  /** Items just added by the latest replan get a marker. */
  justAdded?: Set<string>;
};

const STATUS_LABEL: Record<PathItemStatus, string> = { todo: "", in_progress: "In progress", done: "Done", skipped: "Skipped" };
const FEEDBACK: { type: ItemFeedbackType; label: string; title: string }[] = [
  { type: "completed", label: "Done", title: "I completed this" },
  { type: "too_hard", label: "Too hard", title: "This assumed things I don't know yet" },
  { type: "too_easy", label: "Too easy", title: "I already know this" },
  { type: "not_interested", label: "Not for me", title: "Swap this for something else" },
];

/** Unstyled-by-design rendering of a Path: phases, items, and each item's Evidence. */
export function PathView({ path, catalog, skillName, onExplain, selectedId, onFeedback, pendingFeedback, onShowInGraph, justAdded }: Props) {
  return (
    <ol className="mt-4 flex flex-col gap-6">
      {path.phases.map((phase) => (
        <li key={phase.title} className="rounded border p-4">
          <h3 className="font-semibold">{phase.title}</h3>
          <p className="text-sm text-neutral-600">Milestone: {phase.milestone}</p>
          <ol className="mt-3 flex flex-col gap-3">
            {phase.items.map((item) => {
              const c = catalog[item.catalogId];
              const settled = item.status === "done" || item.status === "skipped";
              const added = justAdded?.has(item.catalogId);
              return (
                <li
                  key={item.catalogId}
                  className={`rounded border p-3 text-sm ${selectedId === item.catalogId ? "border-black bg-neutral-50" : added ? "border-green-500 bg-green-50" : "border-neutral-200"} ${settled ? "opacity-60" : ""}`}
                  data-testid="path-item"
                  data-catalog-id={item.catalogId}
                  data-status={item.status}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs uppercase">{c?.kind ?? "item"}</span>
                    {added && <span className="rounded bg-green-600 px-1.5 py-0.5 text-xs font-medium text-white">New</span>}
                    {STATUS_LABEL[item.status] && (
                      <span className={`rounded px-1.5 py-0.5 text-xs ${item.status === "done" ? "bg-green-100 text-green-800" : "bg-neutral-200"}`}>{STATUS_LABEL[item.status]}</span>
                    )}
                    <a href={item.evidence.provenance} target="_blank" rel="noreferrer" className={`font-medium underline ${item.status === "skipped" ? "line-through" : ""}`}>
                      {c?.title ?? item.catalogId}
                    </a>
                    <span className="text-neutral-500">
                      {c?.provider} · {c?.durationHours}h · difficulty {c?.difficulty}/5
                    </span>
                    <span className="ml-auto flex flex-wrap gap-1">
                      {onExplain && (
                        <button type="button" className="rounded border px-2 py-0.5 text-xs hover:bg-neutral-100" onClick={() => onExplain(item.catalogId)}>
                          Why this?
                        </button>
                      )}
                      {onShowInGraph && (
                        <button type="button" className="rounded border px-2 py-0.5 text-xs hover:bg-neutral-100" onClick={() => onShowInGraph(item.catalogId)}>
                          Show in graph
                        </button>
                      )}
                    </span>
                  </div>
                  {onFeedback && !settled && (
                    <div className="mt-2 flex flex-wrap gap-1" data-testid="feedback-controls">
                      {FEEDBACK.map((f) => (
                        <button
                          key={f.type}
                          type="button"
                          title={f.title}
                          disabled={pendingFeedback !== null && pendingFeedback !== undefined}
                          onClick={() => onFeedback(item.catalogId, f.type)}
                          className={`rounded-full border px-2.5 py-0.5 text-xs disabled:opacity-50 ${f.type === "completed" ? "border-green-600 text-green-800 hover:bg-green-50" : "hover:bg-neutral-100"}`}
                          data-feedback={f.type}
                        >
                          {pendingFeedback === `${item.catalogId}:${f.type}` ? "…" : f.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {!onExplain && <EvidenceBlock evidence={item.evidence} catalog={catalog} skillName={skillName} />}
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}

export function EvidenceBlock({ evidence, catalog, skillName }: { evidence: Evidence; catalog: Record<string, CatalogLite>; skillName: (id: string) => string }) {
  const b = evidence.scoreBreakdown;
  const rows: [string, number][] = [
    ["coverage", b.coverage],
    ["level fit", b.levelFit],
    ["preference fit", b.preferenceFit],
    ["quality", b.quality],
    ["similarity", b.similarity],
  ];
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <div>
        <p className="text-xs font-medium text-neutral-500">Closes gap in</p>
        <ul className="mt-1 flex flex-wrap gap-1">
          {evidence.gapSkillsCovered.map((g) => (
            <li key={g.skillId} className="rounded-full border px-2 py-0.5 text-xs" title={g.graphPath.map(skillName).join(" → ")}>
              {skillName(g.skillId)}
              <span className="text-neutral-400">
                {" "}
                · {g.reason === "goal" ? "goal" : `needed for ${skillName(g.reason.replace("prereq-of:", ""))}`}
              </span>
            </li>
          ))}
        </ul>
        {evidence.sequencedAfter.length > 0 && (
          <p className="mt-2 text-xs text-neutral-500">
            After:{" "}
            {evidence.sequencedAfter
              .map((s) => `${catalog[s.catalogId]?.title ?? s.catalogId} (${skillName(s.becauseSkill)})`)
              .join("; ")}
          </p>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-neutral-500">Score {b.total.toFixed(2)}</p>
        <dl className="mt-1 grid grid-cols-[7rem_1fr_2.5rem] items-center gap-x-2 gap-y-0.5 text-xs">
          {rows.map(([label, value]) => (
            <Row key={label} label={label} value={value} />
          ))}
        </dl>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd>
        <meter min={0} max={1} value={value} className="w-full" />
      </dd>
      <dd className="text-right tabular-nums">{value.toFixed(2)}</dd>
    </>
  );
}
