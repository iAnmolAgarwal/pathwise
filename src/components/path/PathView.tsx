import type { Evidence, Path } from "@/schemas";
import type { CatalogLite } from "./PathBuilder";

type Props = {
  path: Path;
  catalog: Record<string, CatalogLite>;
  skillName: (id: string) => string;
  /** When set, items become selectable and the inline evidence collapses behind the selection. */
  onExplain?: (catalogId: string) => void;
  selectedId?: string | null;
};

/** Unstyled-by-design rendering of a Path: phases, items, and each item's Evidence. */
export function PathView({ path, catalog, skillName, onExplain, selectedId }: Props) {
  return (
    <ol className="mt-4 flex flex-col gap-6">
      {path.phases.map((phase) => (
        <li key={phase.title} className="rounded border p-4">
          <h3 className="font-semibold">{phase.title}</h3>
          <p className="text-sm text-neutral-600">Milestone: {phase.milestone}</p>
          <ol className="mt-3 flex flex-col gap-3">
            {phase.items.map((item) => {
              const c = catalog[item.catalogId];
              return (
                <li
                  key={item.catalogId}
                  className={`rounded border p-3 text-sm ${selectedId === item.catalogId ? "border-black bg-neutral-50" : "border-neutral-200"}`}
                  data-testid="path-item"
                  data-catalog-id={item.catalogId}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs uppercase">{c?.kind ?? "item"}</span>
                    <a href={item.evidence.provenance} target="_blank" rel="noreferrer" className="font-medium underline">
                      {c?.title ?? item.catalogId}
                    </a>
                    <span className="text-neutral-500">
                      {c?.provider} · {c?.durationHours}h · difficulty {c?.difficulty}/5
                    </span>
                    {onExplain && (
                      <button
                        type="button"
                        className="ml-auto rounded border px-2 py-0.5 text-xs hover:bg-neutral-100"
                        onClick={() => onExplain(item.catalogId)}
                      >
                        Why this?
                      </button>
                    )}
                  </div>
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
