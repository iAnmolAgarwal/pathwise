"use client";

import { useMemo, useState } from "react";
import type { Domain, Path, Profile, ProfileOp } from "@/schemas";
import { PathView } from "./PathView";

export type CatalogLite = {
  title: string;
  provider: string;
  url: string;
  kind: "course" | "project" | "assessment";
  durationHours: number;
  difficulty: number;
};
export type SkillLite = { id: string; name: string; domain: Domain; prereqs: string[] };
type GoalLite = {
  id: string;
  title: string;
  description: string;
  requiredSkills: { skillId: string; level: 1 | 2 | 3 }[];
};

type Props = {
  learnerId: string;
  initialProfile: Profile;
  initialPath: { version: number; path: Path } | null;
  goals: GoalLite[];
  skills: SkillLite[];
  catalog: Record<string, CatalogLite>;
};

const LEVEL_LABEL = ["Not yet", "Basics", "Comfortable", "Strong"];

/** Plain form: template goal + declared skill levels + preferences → generate → render path. */
export function PathBuilder({ learnerId, initialProfile, initialPath, goals, skills, catalog }: Props) {
  const initialGoal = initialProfile.goals.find((g) => g.type === "role");
  const [goalId, setGoalId] = useState(initialGoal?.type === "role" ? initialGoal.templateId : goals[0].id);
  const [levels, setLevels] = useState<Record<string, number>>(
    Object.fromEntries(Object.entries(initialProfile.skills).map(([k, v]) => [k, v.level])),
  );
  const [hoursPerWeek, setHoursPerWeek] = useState(initialProfile.preferences.hoursPerWeek);
  const [pace, setPace] = useState(initialProfile.preferences.pace);
  const [budget, setBudget] = useState(initialProfile.preferences.budget);
  const [result, setResult] = useState(initialPath);
  const [meta, setMeta] = useState<{ budgetHours: number; usedHours: number; stoppedBecause: string; uncovered: { skillId: string; levelsMissing: number }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const goal = goals.find((g) => g.id === goalId) ?? goals[0];

  // Skills worth declaring for this goal: its requirements plus their prerequisite closure.
  const relevantSkills = useMemo(() => {
    const seen = new Set<string>();
    const stack = goal.requiredSkills.map((r) => r.skillId);
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(skillById.get(id)?.prereqs ?? []));
    }
    return [...seen]
      .map((id) => skillById.get(id)!)
      .filter(Boolean)
      .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));
  }, [goal, skillById]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ops: ProfileOp[] = [
      ...initialProfile.goals.map((): ProfileOp => ({ op: "remove_goal", index: 0 })),
      { op: "add_goal", goal: { type: "role", templateId: goalId } },
      ...Object.entries(levels).map(
        ([skillId, level]): ProfileOp => ({ op: "set_skill", skillId, level: level as 0 | 1 | 2 | 3, source: "stated" }),
      ),
      { op: "set_preference", key: "hoursPerWeek", value: hoursPerWeek },
      { op: "set_preference", key: "pace", value: pace },
      { op: "set_preference", key: "budget", value: budget },
    ];
    const saved = await fetch(`/api/learners/${learnerId}/profile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ops }),
    });
    if (!saved.ok) {
      setError((await saved.json()).error ?? "Could not save profile");
      setBusy(false);
      return;
    }
    const res = await fetch("/api/path/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ learnerId }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not generate path");
      setBusy(false);
      return;
    }
    const json = await res.json();
    setResult({ version: json.version, path: json.path });
    setMeta(json.working);
    setBusy(false);
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <form onSubmit={generate} className="flex flex-col gap-4 rounded border p-4">
        <label className="flex flex-col gap-1 text-sm">
          Goal
          <select className="rounded border px-2 py-1" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          <span className="text-neutral-500">{goal.description}</span>
        </label>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="font-medium">What do you already know?</legend>
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            {relevantSkills.map((s) => (
              <label key={s.id} className="flex items-center justify-between gap-2">
                <span>
                  {s.name} <span className="text-neutral-400">· {s.domain}</span>
                </span>
                <select
                  className="rounded border px-1 py-0.5"
                  value={levels[s.id] ?? 0}
                  onChange={(e) =>
                    setLevels((prev) => {
                      const next = { ...prev };
                      const v = Number(e.target.value);
                      if (v === 0) delete next[s.id];
                      else next[s.id] = v;
                      return next;
                    })
                  }
                >
                  {LEVEL_LABEL.map((label, i) => (
                    <option key={i} value={i}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            Hours / week
            <input
              type="number"
              min={1}
              max={60}
              className="w-20 rounded border px-2 py-1"
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2">
            Pace
            <select className="rounded border px-2 py-1" value={pace} onChange={(e) => setPace(e.target.value as Profile["preferences"]["pace"])}>
              <option value="relaxed">Relaxed (~18 months)</option>
              <option value="standard">Standard (~12 months)</option>
              <option value="intense">Intense (~6 months)</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            Budget
            <select className="rounded border px-2 py-1" value={budget} onChange={(e) => setBudget(e.target.value as Profile["preferences"]["budget"])}>
              <option value="any">Any</option>
              <option value="free-only">Free only</option>
            </select>
          </label>
        </div>

        <button className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={busy}>
          {busy ? "Generating…" : "Generate path"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {result && (
        <section>
          <h2 className="text-xl font-semibold">
            Your path <span className="text-sm font-normal text-neutral-500">(version {result.version})</span>
          </h2>
          {meta && (
            <p className="mt-1 text-sm text-neutral-600">
              {meta.usedHours} of {meta.budgetHours} budgeted hours planned · stopped because: {meta.stoppedBecause}
              {meta.uncovered.length > 0 && (
                <>
                  {" "}
                  · still uncovered:{" "}
                  {meta.uncovered.map((u) => `${skillById.get(u.skillId)?.name ?? u.skillId} (${u.levelsMissing})`).join(", ")}
                </>
              )}
            </p>
          )}
          <PathView path={result.path} catalog={catalog} skillName={(id) => skillById.get(id)?.name ?? id} />
        </section>
      )}
    </div>
  );
}
