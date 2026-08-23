"use client";

import { AnimatePresence } from "motion/react";
import dynamic from "next/dynamic";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { DashboardSummary } from "@/engine/dashboard";
import type { GraphEvidence } from "@/lib/graphEvidence";
import type { Degradation, DegradationReason } from "@/llm/judgeMode";
import type { NovaState, SessionUser } from "@/schemas";
import type { Path, PathDiff, Profile, ProfileOp } from "@/schemas";
import { initialNova, novaReducer } from "@/nova/machine";
import { Badge } from "@/components/ui/badge";
import { Orb } from "@/components/ui/orb";
import { ChatPanel, type ChatMessageView } from "./chat/ChatPanel";
import type { GraphHighlight } from "./graph/SkillGraph";
import { nextPrompts } from "@/lib/nextPrompts";
import type { GraphLinkState } from "@/lib/graphLink";
import { NovaStage, type NovaReaction } from "./nova/NovaStage";
import type { CatalogLite, SkillLite } from "./path/types";
import { PathDiffBanner, diffHeadline } from "./path/PathDiffBanner";
import { ExplainPanel } from "./path/ExplainPanel";
import { PathView, type ItemFeedbackType } from "./path/PathView";
import { ProfileDrawer, type ProfileChange } from "./profile/ProfileDrawer";
import { AppShell, type PaneTab } from "./shell/AppShell";
import type { RailLearner } from "./shell/Rail";
import { EmptyPath } from "./shell/EmptyPath";

// The graph (React Flow + dagre) and dashboard (Recharts) only load when their tab opens.
const SkillGraph = dynamic(() => import("./graph/SkillGraph").then((m) => m.SkillGraph), { ssr: false, loading: () => <TabLoading label="Loading the skill graph" /> });
const DashboardTab = dynamic(() => import("./dashboard/DashboardTab").then((m) => m.DashboardTab), { ssr: false, loading: () => <TabLoading label="Loading your dashboard" /> });

function TabLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-[13.5px] text-ink-3" role="status">
      <Orb state="working" size={20} label={label} />
      {label}
    </div>
  );
}

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
  /** ISO timestamp of the learner row — the dashboard's "Joined" line. */
  joinedAt?: string;
  user: SessionUser;
  learners: RailLearner[];
  initialProfile: Profile;
  initialPath: { version: number; path: Path } | null;
  initialMessages: ChatMessageView[];
  goals: GoalLite[];
  skills: SkillLite[];
  graphEvidence: GraphEvidence;
  catalog: Record<string, CatalogLite>;
  /** Open on the graph tab with this arrow's card pinned (trust-badge deep link). */
  initialGraphLink?: GraphLinkState | null;
  /** Judge mode already parked the model when the page loaded (today's budget is spent). */
  initialDegradation?: Degradation | null;
};

/** The app shell for one learner: chat on the left, a switchable pane (Nova / Path / Skill Graph / Dashboard) on the right. */
export function LearnWorkspace({ learnerId, displayName, joinedAt, user, learners, initialProfile, initialPath, initialMessages, goals, skills, graphEvidence, catalog, initialGraphLink = null, initialDegradation = null }: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [changes, setChanges] = useState<ProfileChange[]>([]);
  const [pathState, setPathState] = useState(initialPath);
  const [nova, dispatchNova] = useReducer(novaReducer, initialNova);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [explaining, setExplaining] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialGraphLink ? "graph" : initialPath ? "path" : "nova");
  const [diff, setDiff] = useState<{ diff: PathDiff; version: number } | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<GraphHighlight>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [dashboardFailed, setDashboardFailed] = useState(false);
  const [dashboardAttempt, setDashboardAttempt] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [degradedReason, setDegradedReason] = useState<DegradationReason | null>(initialDegradation?.reason ?? null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // The budget was spent before this page loaded: Nova rests from the first frame.
  useEffect(() => {
    if (initialDegradation) dispatchNova({ type: "degraded" });
  }, [initialDegradation]);

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
  const onDegraded = useCallback((d: Degradation) => setDegradedReason(d.reason), []);

  const onProfileUpdated = useCallback((next: Profile, ops: ProfileOp[]) => {
    setProfile(next);
    setChanges((prev) => [...prev, { id: prev.length + 1, at: new Date().toLocaleTimeString(), ops }]);
    setDrawerOpen(true);
  }, []);

  // Profile edits from the drawer: save the ops, then take the redone path (if any) with its diff.
  const saveProfileEdits = useCallback(
    async (ops: ProfileOp[]) => {
      const res = await fetch(`/api/learners/${learnerId}/profile`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ops }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; profile: Profile; replan: { version: number; path: Path; diff: PathDiff } | null };
      if (!res.ok) throw new Error(body.error ?? `Could not save your profile (${res.status})`);
      setProfile(body.profile);
      setChanges((prev) => [...prev, { id: prev.length + 1, at: new Date().toLocaleTimeString(), ops }]);
      if (body.replan) {
        setPathState({ version: body.replan.version, path: body.replan.path });
        setExplaining(null);
        setHighlight(null);
        setDiff({ diff: body.replan.diff, version: body.replan.version });
        setDrawerOpen(false);
        setTab("path");
      }
    },
    [learnerId],
  );

  const onPathUpdated = useCallback((version: number, path: Path, pathDiff?: PathDiff | null) => {
    setPathState({ version, path });
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
        if (cancelled) return;
        if (d) setDashboard(d);
        setDashboardFailed(!d);
      })
      .catch(() => {
        if (!cancelled) setDashboardFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId, pathVersion, profile, dashboardAttempt]);

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
      // Tracing the item that is already traced clears the trace.
      setHighlight((cur) => (cur?.catalogId === catalogId ? null : { catalogId, title: catalog[catalogId]?.title ?? catalogId, evidence: item.evidence }));
      setTab("graph");
    },
    [pathState, catalog],
  );

  const talkToNova = useCallback(() => {
    chatInputRef.current?.focus();
  }, []);

  // Judge mode, no path yet: record the role goal and let the engine build the first path without Nova.
  const buildFromGoal = useCallback(
    async (templateId: string) => {
      const ops: ProfileOp[] = [{ op: "add_goal", goal: { type: "role", templateId } }];
      const saved = await fetch(`/api/learners/${learnerId}/profile`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ops }),
      });
      const nextProfile = (await saved.json().catch(() => ({}))) as Profile & { error?: string };
      if (!saved.ok) throw new Error(nextProfile.error ?? `Could not save your goal (${saved.status})`);
      setProfile(nextProfile);
      setChanges((prev) => [...prev, { id: prev.length + 1, at: new Date().toLocaleTimeString(), ops }]);
      const generated = await fetch("/api/path/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ learnerId }),
      });
      const body = (await generated.json().catch(() => ({}))) as { error?: string; version: number; path: Path };
      if (!generated.ok) throw new Error(body.error ?? `Could not build the path (${generated.status})`);
      onPathUpdated(body.version, body.path, null);
    },
    [learnerId, onPathUpdated],
  );


  const selectedItem = pathState && explaining ? pathState.path.phases.flatMap((p) => p.items).find((i) => i.catalogId === explaining) ?? null : null;
  const justAdded = useMemo(() => new Set(diff?.diff.added.map((d) => d.catalogId) ?? []), [diff]);
  const levels = useMemo(() => Object.fromEntries(Object.entries(profile.skills).map(([id, s]) => [id, s.level])), [profile]);

  const first = displayName.trim().split(/\s+/)[0] || displayName;

  // What Nova says when you open her tab: the moment matters more than the pose.
  const reaction = useMemo<NovaReaction>(() => {
    if (nova.state === "resting") return { tone: "rest", text: "I'm resting — the model is off for now, but your path, graph and dashboard still work." };
    if (nova.state === "celebrating") return { tone: "cheer", text: `That's a milestone, ${first}. Nicely done — the path just moved to make room for what's next.` };
    if (diff) return { tone: "info", text: `I've reworked your path (v${diff.version}). ${diffHeadline(diff.diff, (id) => catalog[id]?.title ?? id)}` };
    const done = dashboard?.progress.itemsDone ?? 0;
    const total = dashboard?.progress.itemsTotal ?? 0;
    const streak = dashboard?.streak.current ?? 0;
    const next = dashboard?.nextAction.title;
    if (pathState && done > 0) {
      const streakBit = streak > 1 ? ` and a ${streak}-day streak` : "";
      return { tone: "cheer", text: `${done} of ${total} done${streakBit} — keep going, ${first}.${next ? ` Next up: ${next}.` : ""}` };
    }
    if (pathState) {
      const items = pathState.path.phases.reduce((n, p) => n + p.items.length, 0);
      return { tone: "nudge", text: `Your path is ready — ${items} items over ${pathState.path.phases.length} phases.${next ? ` Start with ${next}.` : ""} Tell me when something feels off and I'll rework it.` };
    }
    return { tone: "greet", text: `Hi ${first}. Tell me what you want to become and I'll check what you already know, then build your path.` };
  }, [nova.state, diff, dashboard, pathState, first, catalog]);

  // Eyebrow over the learner's name: their own workspace until a path exists, then the goal it serves.
  const goalLabel = (() => {
    const g = profile.goals.at(-1);
    if (!g || !pathState) return `${displayName}'s workspace`;
    return g.type === "role" ? templateTitle(g.templateId) : g.text;
  })();

  const chatHeader = (
    <div className="flex min-w-0 flex-col justify-center">
      <span className="label-caps truncate text-[12px] text-ink-2" title={goalLabel} data-testid="workspace-title">
        {goalLabel}
      </span>
    </div>
  );

  return (
    <AppShell
      rail={{
        learnerId,
        displayName,
        user,
        learners,
        onOpenProfile: () => setDrawerOpen(true),
        onSignOut: () => void signOut({ callbackUrl: "/" }),
      }}
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
          restingReason={nova.state === "resting" ? degradedReason : null}
          onDegraded={onDegraded}
          prompts={nextPrompts(profile, pathState?.path ?? null, (id) => catalog[id]?.title ?? id)}
        />
      }
      tabs={TABS}
      tab={tab}
      fullWidth={tab === "dashboard"}
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
              <NovaStage state={nova.state} transitions={nova.transitions} placement="dock" reducedMotion={reducedMotion} reaction={reaction} />
            </div>
          )}

          {tab === "graph" && (
            <section data-testid="graph-section">
              <h2 className="text-[22px] font-[420] tracking-[-0.03em]">Skill graph</h2>
              <p className="mt-1 max-w-[70ch] text-[13.5px] text-ink-2">Every skill, coloured by where you stand. Select a skill for what learners did next, or an arrow for who agreed it comes first.</p>
              <div className="mt-4">
                {/* The focus set comes from the dashboard's skill statuses. With a path but no dashboard
                    yet, wait rather than lay out the whole taxonomy and then jump to the path. */}
                {pathState && !dashboard ? (
                  <TabLoading label="Loading the skill graph" />
                ) : (
                  <SkillGraph
                    skills={skills}
                    evidence={graphEvidence}
                    skillStatus={dashboard?.skillStatus ?? {}}
                    levels={levels}
                    highlight={highlight}
                    onClearHighlight={() => setHighlight(null)}
                    initialEdge={initialGraphLink?.edge ?? null}
                  />
                )}
              </div>
            </section>
          )}

          {tab === "dashboard" && (
            <section data-testid="dashboard-section">
              <h2 className="text-[22px] font-[420] tracking-[-0.03em]">Dashboard</h2>
              <div className="mt-4">
                <DashboardTab
                  summary={dashboard}
                  failed={dashboardFailed && !dashboard}
                  onRetry={() => setDashboardAttempt((n) => n + 1)}
                  displayName={displayName}
                  joinedAt={joinedAt}
                  preferences={profile.preferences}
                  onEditProfile={() => setDrawerOpen(true)}
                  goalTitle={profile.goals[0] ? (profile.goals[0].type === "role" ? templateTitle(profile.goals[0].templateId) : profile.goals[0].text) : null}
                  onAskNova={() => {
                    setTab("nova");
                    chatInputRef.current?.focus();
                  }}
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
                  <p className="mt-1 max-w-[70ch] text-[13px] text-ink-3">Tell Pathwise how each item went — Done, Too hard, Too easy or Not for me — and the path adapts with a stated reason.</p>
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
              <EmptyPath
                displayName={displayName}
                returning={initialMessages.length > 0}
                onTalk={talkToNova}
                resting={nova.state === "resting"}
                goals={goals}
                onBuildFromGoal={buildFromGoal}
              />
            )}

          </section>
        </>
      }
    >
      <ProfileDrawer profile={profile} changes={changes} skillName={skillName} templateTitle={templateTitle} open={drawerOpen} onClose={() => setDrawerOpen(false)} onSave={saveProfileEdits} />
    </AppShell>
  );
}
