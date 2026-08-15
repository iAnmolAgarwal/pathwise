"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardSummary } from "@/engine/dashboard";
import type { NovaState } from "@/llm/chat";
import type { Path, PathDiff, Profile, ProfileOp } from "@/schemas";
import { ChatPanel, type ChatMessageView } from "./chat/ChatPanel";
import { DashboardTab } from "./dashboard/DashboardTab";
import { SkillGraph, type GraphHighlight } from "./graph/SkillGraph";
import { PathBuilder, type CatalogLite, type GenerateMeta, type SkillLite } from "./path/PathBuilder";
import { PathDiffBanner } from "./path/PathDiffBanner";
import { ExplainPanel } from "./path/ExplainPanel";
import { PathView, type ItemFeedbackType } from "./path/PathView";
import { ProfileDrawer, type ProfileChange } from "./profile/ProfileDrawer";

type Tab = "path" | "graph" | "dashboard";
const TABS: { id: Tab; label: string }[] = [
  { id: "path", label: "Path" },
  { id: "graph", label: "Skill Graph" },
  { id: "dashboard", label: "Dashboard" },
];

type GoalLite = { id: string; title: string; description: string; requiredSkills: { skillId: string; level: 1 | 2 | 3 }[] };

type Props = {
  learnerId: string;
  displayName: string;
  initialProfile: Profile;
  initialPath: { version: number; path: Path } | null;
  initialMessages: ChatMessageView[];
  goals: GoalLite[];
  skills: SkillLite[];
  catalog: Record<string, CatalogLite>;
};

const NOVA_LABEL: Record<NovaState, string> = {
  idle: "Nova is here",
  listening: "Nova is listening",
  thinking: "Nova is thinking…",
  speaking: "Nova is speaking",
  celebrating: "Path updated!",
  resting: "Nova is resting (deterministic features still work)",
};

/** The app shell for one learner: chat on the left, path in the middle, profile in a drawer. */
export function LearnWorkspace({ learnerId, displayName, initialProfile, initialPath, initialMessages, goals, skills, catalog }: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [changes, setChanges] = useState<ProfileChange[]>([]);
  const [pathState, setPathState] = useState(initialPath);
  const [meta, setMeta] = useState<GenerateMeta | null>(null);
  const [nova, setNova] = useState<NovaState>("idle");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [explaining, setExplaining] = useState<string | null>(null);
  const [pathFlash, setPathFlash] = useState(false);
  const [tab, setTab] = useState<Tab>("path");
  const [diff, setDiff] = useState<{ diff: PathDiff; version: number } | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<GraphHighlight>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);

  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const skillName = useCallback((id: string) => skillById.get(id)?.name ?? id, [skillById]);
  const templateTitle = useCallback((id: string) => goals.find((g) => g.id === id)?.title ?? id, [goals]);

  const onProfileUpdated = useCallback((next: Profile, ops: ProfileOp[]) => {
    setProfile(next);
    setChanges((prev) => [...prev, { id: prev.length + 1, at: new Date().toLocaleTimeString(), ops }]);
    setDrawerOpen(true);
  }, []);

  const onPathUpdated = useCallback((version: number, path: Path, pathDiff?: PathDiff | null) => {
    setPathState({ version, path });
    setMeta(null);
    setExplaining(null);
    setHighlight(null);
    setDiff(pathDiff ? { diff: pathDiff, version } : null);
    setPathFlash(true);
    setTimeout(() => setPathFlash(false), 1500);
  }, []);

  // The dashboard is recomputed server-side from stored state whenever profile or path change.
  const pathVersion = pathState?.version ?? 0;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/${learnerId}`)
      .then((r) => (r.ok ? (r.json() as Promise<DashboardSummary>) : null))
      .then((d) => {
        if (!cancelled && d) setDashboard(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [learnerId, pathVersion, profile]);

  const sendFeedback = useCallback(
    async (catalogId: string, type: ItemFeedbackType) => {
      setPendingFeedback(`${catalogId}:${type}`);
      setFeedbackError(null);
      setNova("thinking");
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ learnerId, event: { type, catalogId } }),
        });
        const body = (await res.json()) as { error?: string; replanned: boolean; version: number; path: Path; diff: PathDiff | null; profile: Profile; cause: string };
        if (!res.ok) throw new Error(body.error ?? `Feedback failed (${res.status})`);
        setProfile(body.profile);
        setPathState({ version: body.version, path: body.path });
        setExplaining(null);
        setHighlight(null);
        setDiff(body.diff ? { diff: body.diff, version: body.version } : null);
        setTab("path");
        setNova(type === "completed" ? "celebrating" : "idle");
        if (type === "completed") setTimeout(() => setNova("idle"), 2000);
      } catch (err) {
        setFeedbackError(err instanceof Error ? err.message : String(err));
        setNova("idle");
      } finally {
        setPendingFeedback(null);
      }
    },
    [learnerId],
  );

  const showInGraph = useCallback(
    (catalogId: string) => {
      const item = pathState?.path.phases.flatMap((p) => p.items).find((i) => i.catalogId === catalogId);
      if (!item) return;
      setHighlight({ catalogId, title: catalog[catalogId]?.title ?? catalogId, evidence: item.evidence });
      setTab("graph");
    },
    [pathState, catalog],
  );

  const selectedItem = pathState && explaining ? pathState.path.phases.flatMap((p) => p.items).find((i) => i.catalogId === explaining) ?? null : null;
  const justAdded = useMemo(() => new Set(diff?.diff.added.map((d) => d.catalogId) ?? []), [diff]);
  const levels = useMemo(() => Object.fromEntries(Object.entries(profile.skills).map(([id, s]) => [id, s.level])), [profile]);

  return (
    <div className={`mx-auto max-w-7xl p-4 transition-[padding] md:p-6 ${drawerOpen ? "lg:pr-[21rem]" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Pathwise — {displayName}</h1>
          <p className="text-xs text-neutral-500">Learner id: {learnerId}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border px-3 py-1 text-xs" data-testid="nova-state" data-state={nova}>
            {NOVA_LABEL[nova]}
          </span>
          <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => setDrawerOpen((o) => !o)} data-testid="toggle-profile">
            Profile ({profile.goals.length} goal{profile.goals.length === 1 ? "" : "s"}, {Object.keys(profile.skills).length} skills)
          </button>
        </div>
      </header>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(20rem,2fr)_3fr]">
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-6rem)]">
          <ChatPanel
            learnerId={learnerId}
            initialMessages={initialMessages}
            onProfileUpdated={onProfileUpdated}
            onPathUpdated={onPathUpdated}
            onNovaState={setNova}
          />
        </div>

        <main className="flex flex-col gap-6">
          <nav className="flex gap-1 border-b" role="tablist" aria-label="Workspace">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                data-testid={`tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`-mb-px rounded-t border px-4 py-2 text-sm ${tab === t.id ? "border-b-white bg-white font-medium" : "border-transparent text-neutral-500 hover:text-black"}`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {diff && (
            <PathDiffBanner diff={diff.diff} version={diff.version} catalog={catalog} onDismiss={() => setDiff(null)} />
          )}
          {feedbackError && (
            <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800" role="alert">
              {feedbackError}
            </p>
          )}

          {tab === "graph" && (
            <section className="rounded border p-4" data-testid="graph-section">
              <h2 className="text-xl font-semibold">Skill graph</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Every skill in the taxonomy, coloured by where you stand. Press “Show in graph” on a path item to trace the chain of prerequisites it closes.
              </p>
              <div className="mt-3">
                <SkillGraph skills={skills} skillStatus={dashboard?.skillStatus ?? {}} levels={levels} highlight={highlight} />
              </div>
              {pathState && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-neutral-500">Trace a path item</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {pathState.path.phases.flatMap((p) => p.items).map((i) => (
                      <button
                        key={i.catalogId}
                        type="button"
                        onClick={() => showInGraph(i.catalogId)}
                        className={`rounded-full border px-2 py-0.5 text-xs ${highlight?.catalogId === i.catalogId ? "border-black bg-black text-white" : "hover:bg-neutral-100"}`}
                        data-testid="graph-trace-item"
                      >
                        {catalog[i.catalogId]?.title ?? i.catalogId}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "dashboard" && (
            <section className="rounded border p-4" data-testid="dashboard-section">
              <h2 className="text-xl font-semibold">Dashboard</h2>
              <div className="mt-3">
                <DashboardTab
                  summary={dashboard}
                  onOpenItem={(id) => {
                    setTab("path");
                    setExplaining(id);
                  }}
                />
              </div>
            </section>
          )}

          <section className={`rounded border p-4 transition-colors duration-700 ${pathFlash ? "bg-green-50" : ""} ${tab === "path" ? "" : "hidden"}`} data-testid="path-section">
            {pathState ? (
              <>
                <h2 className="text-xl font-semibold">
                  Your path <span className="text-sm font-normal text-neutral-500">(version {pathState.version})</span>
                </h2>
                <p className="mt-1 text-xs text-neutral-500">Tell Pathwise how each item went — Done, Too hard, Too easy or Not for me — and the path adapts with a stated reason.</p>
                {meta && (
                  <p className="mt-1 text-sm text-neutral-600">
                    {meta.usedHours} of {meta.budgetHours} budgeted hours planned · stopped because: {meta.stoppedBecause}
                    {meta.uncovered.length > 0 && <> · still uncovered: {meta.uncovered.map((u) => `${skillName(u.skillId)} (${u.levelsMissing})`).join(", ")}</>}
                  </p>
                )}
                {selectedItem && (
                  <div className="mt-3">
                    <ExplainPanel
                      key={selectedItem.catalogId}
                      learnerId={learnerId}
                      catalogId={selectedItem.catalogId}
                      evidence={selectedItem.evidence}
                      catalog={catalog}
                      skillName={skillName}
                      onClose={() => setExplaining(null)}
                    />
                  </div>
                )}
                <PathView
                  path={pathState.path}
                  catalog={catalog}
                  skillName={skillName}
                  onExplain={setExplaining}
                  selectedId={explaining}
                  onFeedback={sendFeedback}
                  pendingFeedback={pendingFeedback}
                  onShowInGraph={showInGraph}
                  justAdded={justAdded}
                />
              </>
            ) : (
              <div className="text-sm text-neutral-600">
                <h2 className="text-xl font-semibold text-black">No path yet</h2>
                <p className="mt-1">Tell Nova what you want to become and it will generate one — or set up your profile by hand below.</p>
              </div>
            )}
          </section>

          <details className={`rounded border p-4 ${tab === "path" ? "" : "hidden"}`}>
            <summary className="cursor-pointer text-sm font-medium">Set up manually (no chat needed)</summary>
            <div className="mt-3">
              <PathBuilder
                key={changes.length}
                learnerId={learnerId}
                initialProfile={profile}
                goals={goals}
                skills={skills}
                onProfileSaved={(next) => onProfileUpdated(next, [])}
                onPathGenerated={(version, path, m) => {
                  onPathUpdated(version, path);
                  setMeta(m);
                }}
              />
            </div>
          </details>
        </main>
      </div>

      <ProfileDrawer profile={profile} changes={changes} skillName={skillName} templateTitle={templateTitle} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
