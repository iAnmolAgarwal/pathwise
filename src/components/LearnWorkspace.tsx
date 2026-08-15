"use client";

import { useCallback, useMemo, useState } from "react";
import type { NovaState } from "@/llm/chat";
import type { Path, Profile, ProfileOp } from "@/schemas";
import { ChatPanel, type ChatMessageView } from "./chat/ChatPanel";
import { PathBuilder, type CatalogLite, type GenerateMeta, type SkillLite } from "./path/PathBuilder";
import { ExplainPanel } from "./path/ExplainPanel";
import { PathView } from "./path/PathView";
import { ProfileDrawer, type ProfileChange } from "./profile/ProfileDrawer";

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

  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const skillName = useCallback((id: string) => skillById.get(id)?.name ?? id, [skillById]);
  const templateTitle = useCallback((id: string) => goals.find((g) => g.id === id)?.title ?? id, [goals]);

  const onProfileUpdated = useCallback((next: Profile, ops: ProfileOp[]) => {
    setProfile(next);
    setChanges((prev) => [...prev, { id: prev.length + 1, at: new Date().toLocaleTimeString(), ops }]);
    setDrawerOpen(true);
  }, []);

  const onPathUpdated = useCallback((version: number, path: Path) => {
    setPathState({ version, path });
    setMeta(null);
    setExplaining(null);
    setPathFlash(true);
    setTimeout(() => setPathFlash(false), 1500);
  }, []);

  const selectedItem = pathState && explaining ? pathState.path.phases.flatMap((p) => p.items).find((i) => i.catalogId === explaining) ?? null : null;

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
          <section className={`rounded border p-4 transition-colors duration-700 ${pathFlash ? "bg-green-50" : ""}`} data-testid="path-section">
            {pathState ? (
              <>
                <h2 className="text-xl font-semibold">
                  Your path <span className="text-sm font-normal text-neutral-500">(version {pathState.version})</span>
                </h2>
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
                <PathView path={pathState.path} catalog={catalog} skillName={skillName} onExplain={setExplaining} selectedId={explaining} />
              </>
            ) : (
              <div className="text-sm text-neutral-600">
                <h2 className="text-xl font-semibold text-black">No path yet</h2>
                <p className="mt-1">Tell Nova what you want to become and it will generate one — or set up your profile by hand below.</p>
              </div>
            )}
          </section>

          <details className="rounded border p-4">
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
