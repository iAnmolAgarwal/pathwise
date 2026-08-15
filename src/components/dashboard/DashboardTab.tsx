"use client";

import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DashboardSummary } from "@/engine/dashboard";

// Categorical slots 1 and 3 of the reference palette (validated adjacent pair, light surface).
const SERIES = { required: "#2a78d6", known: "#1baf7a" };

type Props = {
  summary: DashboardSummary | null;
  onOpenItem?: (catalogId: string) => void;
};

/** Dashboard tab (§9.3): radar, timeline, progress, next-best-action, streak — all engine-computed. */
export function DashboardTab({ summary, onOpenItem }: Props) {
  if (!summary) return <p className="text-sm text-neutral-600">Computing your dashboard…</p>;
  const { progress, radar, timeline, nextAction, streak } = summary;
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="dashboard">
      <section className="rounded border p-4 md:col-span-2">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Progress toward your goal</p>
            <p className="text-4xl font-semibold tabular-nums" data-testid="progress-percent">{progress.percent}%</p>
            <p className="text-xs text-neutral-600">
              {progress.attainedLevels} of {progress.requiredLevels} required skill levels · {progress.itemsDone}/{progress.itemsTotal} items done
            </p>
          </div>
          <div className="min-w-[12rem] flex-1">
            <div className="h-2 w-full overflow-hidden rounded bg-neutral-200" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded" style={{ width: `${progress.percent}%`, background: SERIES.known }} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Activity streak</p>
            <p className="text-2xl font-semibold tabular-nums" data-testid="streak">
              {streak.current} day{streak.current === 1 ? "" : "s"}
              <span className="ml-2 text-xs font-normal text-neutral-500">best {streak.longest}</span>
            </p>
            <StreakDots activeDays={streak.activeDays} today={summary.today} />
          </div>
        </div>
      </section>

      <section className="rounded border p-4" data-testid="next-action">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Next best action</p>
        {nextAction.catalogId ? (
          <>
            <p className="mt-1 text-lg font-medium">
              {nextAction.title}
              <span className="ml-2 text-xs font-normal uppercase text-neutral-500">{nextAction.kind}{nextAction.hours ? ` · ${nextAction.hours}h` : ""}</span>
            </p>
            <p className="mt-1 text-sm text-neutral-700">{nextAction.why}</p>
            {onOpenItem && (
              <button type="button" className="mt-2 rounded border px-3 py-1 text-sm hover:bg-neutral-100" onClick={() => onOpenItem(nextAction.catalogId!)}>
                Open on path
              </button>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm">{nextAction.why}</p>
        )}
      </section>

      <section className="rounded border p-4" data-testid="skill-radar">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Skills: known vs required, by domain</p>
        {radar.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">Add a goal to see which domains it needs.</p>
        ) : radar.length < 3 ? (
          // A radar needs three axes to be a shape; with fewer domains, paired bars are the honest form.
          <DomainBars radar={radar} />
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar.map((r) => ({ ...r, requiredPct: 100, knownPct: Math.round((r.known / r.required) * 100) }))} outerRadius="75%">
                  <PolarGrid stroke="#e5e5e5" />
                  <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: "#52514e" }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Required by goal" dataKey="requiredPct" stroke={SERIES.required} fill={SERIES.required} fillOpacity={0.08} strokeWidth={2} />
                  <Radar name="You know" dataKey="knownPct" stroke={SERIES.known} fill={SERIES.known} fillOpacity={0.35} strokeWidth={2} />
                  <Tooltip
                    formatter={(value, name, entry) => {
                      const r = entry.payload as { known: number; required: number };
                      return [name === "You know" ? `${value}% (${r.known} of ${r.required} levels)` : `${r.required} levels`, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-neutral-500">Each axis is one domain the goal needs; the outer edge is the goal, the filled shape is how far you are.</p>
            <details className="mt-1 text-xs">
              <summary className="cursor-pointer text-neutral-600">Table view</summary>
              <table className="mt-1 w-full text-left">
                <thead>
                  <tr className="text-neutral-500"><th>Domain</th><th>You know</th><th>Required</th></tr>
                </thead>
                <tbody>
                  {radar.map((r) => (
                    <tr key={r.domain}><td>{r.label}</td><td className="tabular-nums">{r.known}</td><td className="tabular-nums">{r.required}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </section>

      <section className="rounded border p-4 md:col-span-2" data-testid="timeline">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Path timeline</p>
        {timeline.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">No path yet.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-0">
            {timeline.map((t, i) => (
              <li key={t.title} className="relative flex-1 sm:pr-3" data-complete={t.complete} data-active={t.active}>
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs"
                    style={{ borderColor: t.complete ? "#0ca30c" : t.active ? SERIES.required : "#c3c2b7", background: t.complete ? "#0ca30c" : "white", color: t.complete ? "white" : undefined }}
                    aria-label={t.complete ? "complete" : t.active ? "current" : "upcoming"}
                  >
                    {t.complete ? "✓" : i + 1}
                  </span>
                  {i < timeline.length - 1 && <span className="hidden h-0.5 flex-1 sm:block" style={{ background: t.complete ? "#0ca30c" : "#e5e5e5" }} aria-hidden />}
                </div>
                <p className="mt-1 text-sm font-medium">{t.title}</p>
                <p className="text-xs text-neutral-600">{t.milestone}</p>
                <p className="text-xs tabular-nums text-neutral-500">{t.itemsDone}/{t.itemsTotal} done</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function DomainBars({ radar }: { radar: DashboardSummary["radar"] }) {
  const max = Math.max(...radar.map((r) => r.required));
  return (
    <div className="mt-2 flex flex-col gap-3">
      {radar.map((r) => (
        <div key={r.domain}>
          <p className="text-sm">{r.label}</p>
          <div className="mt-1 flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2.5 rounded-r" style={{ width: `${(r.required / max) * 100}%`, background: SERIES.required, opacity: 0.35 }} />
              <span className="tabular-nums text-neutral-600">{r.required} required</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2.5 rounded-r" style={{ width: `${(r.known / max) * 100}%`, background: SERIES.known }} />
              <span className="tabular-nums text-neutral-600">{r.known} known</span>
            </div>
          </div>
        </div>
      ))}
      <p className="text-xs text-neutral-500">
        <span className="mr-1 inline-block h-2 w-2" style={{ background: SERIES.required, opacity: 0.35 }} /> Required by goal
        <span className="ml-3 mr-1 inline-block h-2 w-2" style={{ background: SERIES.known }} /> You know
      </p>
    </div>
  );
}

function StreakDots({ activeDays, today }: { activeDays: string[]; today: string }) {
  const active = new Set(activeDays);
  const end = Date.parse(`${today}T00:00:00Z`);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(end - (13 - i) * 86_400_000).toISOString().slice(0, 10);
    return { d, on: active.has(d) };
  });
  return (
    <div className="mt-1 flex gap-1" aria-label="last fourteen days">
      {days.map(({ d, on }) => (
        <span key={d} title={d} className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: on ? "#0ca30c" : "#e5e5e5" }} />
      ))}
    </div>
  );
}
