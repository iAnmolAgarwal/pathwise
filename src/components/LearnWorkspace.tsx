"use client";

import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { DashboardSummary } from "@/engine/dashboard";
import type { NovaState } from "@/schemas";
import type { Path, PathDiff, Profile, ProfileOp } from "@/schemas";
import { initialNova, novaReducer } from "@/nova/machine";
import { NOVA_LABEL, NOVA_ORB } from "@/nova/stage";
import { Badge } from "@/components/ui/badge";
import { Orb } from "@/components/ui/orb";
import { ChatPanel, type ChatMessageView } from "./chat/ChatPanel";
import { DashboardTab } from "./dashboard/DashboardTab";
import { SkillGraph, type GraphHighlight } from "./graph/SkillGraph";
import { NovaStage } from "./nova/NovaStage";
import { PathBuilder, type CatalogLite, type GenerateMeta, type SkillLite } from "./path/PathBuilder";
import { PathDiffBanner } from "./path/PathDiffBanner";
import { ExplainPanel } from "./path/ExplainPanel";
import { PathView, type ItemFeedbackType } from "./path/PathView";
import { ProfileDrawer, type ProfileChange } from "./profile/ProfileDrawer";
import { AppShell, type PaneTab } from "./shell/AppShell";
import { EmptyPath } from "./shell/EmptyPath";

type Tab = "nova" | "path" | "graph" | "dashboard";
const TABS: PaneTab[] = [
  { id: "nova", label: "Nova" },
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

/** The app shell for one learner: chat on the left, a switchable pane (Nova / Path / Skill Graph / Dashboard) on the right. */
export function LearnWorkspace({ learnerId, displayName, initialProfile, initialPath, initialMessages, goals, skills, catalog }: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [changes, setChanges] = useState<ProfileChange[]>([]);
  const [pathState, setPathState] = useState(initialPath);
  const [meta, setMeta] = useState<GenerateMeta | null>(null);
  const [nova, dispatchNova] = useReducer(novaReducer, initialNova);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [explaining, setExplaining] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialPath ? "path" : "nova");
  const [diff, setDiff] = useState<{ diff: PathDiff; version: number } | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<GraphHighlight>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const manualRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Celebrations are momentary: hand control back to the chat lifecycle after a beat.
  useEffect(() => {
    if (nova.state !== "celebrating") return;
    const t = setTimeout(() => dispatchNova({ type: "celebration_done" }), 2200);
    return () => clearTimeout(t);
  }, [nova.state, nova.celebrations]);

  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const skillName = useCallback((id: string) => skillById.get(id)?.name ?? id, [skillById]);
  const templateTitle = useCallback((id: string) => goals.find((g) => g.id === id)?.title ?? id, [goals]);

  const onNovaState = useCallback((state: NovaState) => dispatchNova({ type: "sse", state }), []);

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
    setTab("path");
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
      dispatchNova({ type: "sse", state: "thinking" });
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
        if (type === "completed") dispatchNova({ type: "milestone_completed" });
        else dispatchNova({ type: "stream_close" });
      } catch (err) {
        setFeedbackError(err instanceof Error ? err.message : String(err));
        dispatchNova({ type: "stream_close" });
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

  const talkToNova = useCallback(() => {
    chatInputRef.current?.focus();
  }, []);

  const openManual = useCallback(() => {
    const el = manualRef.current;
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const selectedItem = pathState && explaining ? pathState.path.phases.flatMap((p) => p.items).find((i) => i.catalogId === explaining) ?? null : null;
  const justAdded = useMemo(() => new Set(diff?.diff.added.map((d) => d.catalogId) ?? []), [diff]);
  const levels = useMemo(() => Object.fromEntries(Object.entries(profile.skills).map(([id, s]) => [id, s.level])), [profile]);

  const chatHeader = (
    <>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="label-caps text-ink-3">Conversation</span>
        <span className="truncate text-[15px] font-[540] tracking-[-0.02em] text-ink-1">Nova · {displayName}</span>
      </div>
      <button
        type="button"
        className="ml-auto inline-flex h-8 shrink-0 items-center gap-2 rounded-pill border border-line bg-glass px-3 pl-2 text-[12px] text-ink-2 backdrop-blur-[14px] transition-colors hover:border-line-strong hover:text-ink-1"
        onClick={() => setTab("nova")}
        data-testid="nova-state"
        data-state={nova.state}
        aria-label={`${NOVA_LABEL[nova.state]} — open Nova`}
      >
        <Orb state={NOVA_ORB[nova.state]} size={20} paused={reducedMotion} />
        {NOVA_LABEL[nova.state]}
      </button>
    </>
  );

  return (
    <AppShell
      rail={{ displayName, profileOpen: drawerOpen, onToggleProfile: () => setDrawerOpen((o) => !o) }}
      chatHeader={chatHeader}
      chat={
        <ChatPanel
          learnerId={learnerId}
          initialMessages={initialMessages}
          onProfileUpdated={onProfileUpdated}
          onPathUpdated={onPathUpdated}
          onNovaState={onNovaState}
          onInputFocus={(focused) => dispatchNova({ type: focused ? "input_focus" : "input_blur" })}
          inputRef={chatInputRef}
          resting={nova.state === "resting"}
        />
      }
      tabs={TABS}
      tab={tab}
      onTabChange={(id) => setTab(id as Tab)}
      paneAside={
        pathState ? (
          <Badge variant="mono" data-testid="path-version">
            path v{pathState.version}
          </Badge>
        ) : null
      }
      pane={
        <>
          {tab === "nova" && (
            <div className="h-full min-h-[360px]" data-testid="nova-section">
              <NovaStage state={nova.state} transitions={nova.transitions} placement="dock" reducedMotion={reducedMotion} />
            </div>
          )}

          {tab === "graph" && (
            <section data-testid="graph-section">
              <h2 className="text-[22px] font-[420] tracking-[-0.03em]">Skill graph</h2>
              <p className="mt-1 max-w-[70ch] text-[13.5px] text-ink-2">
                Every skill in the taxonomy, coloured by where you stand. Press “Show in graph” on a path item to light up the chain of prerequisites it closes.
              </p>
              <div className="mt-4">
                <SkillGraph skills={skills} skillStatus={dashboard?.skillStatus ?? {}} levels={levels} highlight={highlight} />
              </div>
              {pathState && (
                <div className="mt-4">
                  <p className="label-caps text-ink-3">Trace a path item</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pathState.path.phases.flatMap((p) => p.items).map((i) => (
                      <button
                        key={i.catalogId}
                        type="button"
                        onClick={() => showInGraph(i.catalogId)}
                        className={`rounded-pill border px-2.5 py-1 text-[12px] transition-colors ${highlight?.catalogId === i.catalogId ? "border-transparent bg-brand text-brand-foreground" : "border-line text-ink-2 hover:border-line-strong hover:text-ink-1"}`}
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
            <section data-testid="dashboard-section">
              <h2 className="text-[22px] font-[420] tracking-[-0.03em]">Dashboard</h2>
              <div className="mt-4">
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

          <section className={`flex flex-col gap-5 ${tab === "path" ? "" : "hidden"}`} data-testid="path-section">
            <AnimatePresence>
              {diff && <PathDiffBanner key={diff.version} diff={diff.diff} version={diff.version} catalog={catalog} onDismiss={() => setDiff(null)} />}
            </AnimatePresence>
            {feedbackError && (
              <p className="rounded-card border border-coral-line bg-coral-soft px-3 py-2 text-[13px] text-coral" role="alert">
                {feedbackError}
              </p>
            )}

            {pathState ? (
              <>
                <div>
                  <h2 className="text-[22px] font-[420] tracking-[-0.03em]">Your path</h2>
                  <p className="mt-1 text-[13px] text-ink-3">Tell Pathwise how each item went — Done, Too hard, Too easy or Not for me — and the path adapts with a stated reason.</p>
                  {meta && (
                    <p className="mt-1 text-[13px] text-ink-2">
                      {meta.usedHours} of {meta.budgetHours} budgeted hours planned · stopped because: {meta.stoppedBecause}
                      {meta.uncovered.length > 0 && <> · still uncovered: {meta.uncovered.map((u) => `${skillName(u.skillId)} (${u.levelsMissing})`).join(", ")}</>}
                    </p>
                  )}
                </div>
                <PathView
                  path={pathState.path}
                  catalog={catalog}
                  skillName={skillName}
                  onExplain={(id) => setExplaining((cur) => (cur === id ? null : id))}
                  selectedId={explaining}
                  explainSlot={
                    selectedItem ? (
                      <ExplainPanel
                        key={selectedItem.catalogId}
                        learnerId={learnerId}
                        catalogId={selectedItem.catalogId}
                        evidence={selectedItem.evidence}
                        catalog={catalog}
                        skillName={skillName}
                        onClose={() => setExplaining(null)}
                      />
                    ) : null
                  }
                  onFeedback={sendFeedback}
                  pendingFeedback={pendingFeedback}
                  onShowInGraph={showInGraph}
                  justAdded={justAdded}
                />
              </>
            ) : (
              <EmptyPath displayName={displayName} returning={initialMessages.length > 0} onTalk={talkToNova} onManual={openManual} />
            )}

            <details ref={manualRef} className="rounded-card border border-line bg-surface-2 p-4">
              <summary className="cursor-pointer text-[13px] font-[550] text-ink-2 hover:text-ink-1">Set up manually (no chat needed)</summary>
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
          </section>
        </>
      }
    >
      <ProfileDrawer profile={profile} changes={changes} skillName={skillName} templateTitle={templateTitle} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </AppShell>
  );
}
