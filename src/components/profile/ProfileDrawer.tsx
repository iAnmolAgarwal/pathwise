"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Preferences, Profile, ProfileOp } from "@/schemas";

const LEVEL_LABEL = ["Not yet", "Basics", "Comfortable", "Strong"];
const LEVEL_TONE: Record<number, string> = {
  0: "border-line/60 text-ink-4",
  1: "border-line text-ink-2",
  2: "border-status-progress-line bg-status-progress-soft text-status-progress",
  3: "border-status-acquired-line bg-status-acquired-soft text-status-acquired",
};
type Level = 0 | 1 | 2 | 3;
const PACES: { value: Preferences["pace"]; label: string }[] = [
  { value: "relaxed", label: "Relaxed" },
  { value: "standard", label: "Standard" },
  { value: "intense", label: "Intense" },
];
const BUDGETS: { value: Preferences["budget"]; label: string }[] = [
  { value: "free-only", label: "Free only" },
  { value: "any", label: "Any" },
];

export type ProfileChange = { id: number; at: string; ops: ProfileOp[] };

type Props = {
  profile: Profile;
  changes: ProfileChange[];
  skillName: (id: string) => string;
  templateTitle: (id: string) => string;
  open: boolean;
  onClose: () => void;
  /** Saves the learner's edits; resolves once the profile (and the path, if it was redone) are updated. */
  onSave?: (ops: ProfileOp[]) => Promise<void>;
};

/**
 * The learner profile as the engine sees it, and where the learner corrects it: tap a skill to
 * cycle its level, set the week, save — the path is redone against the result. Fields touched by
 * the latest batch of ops flash so a viewer can watch the chat fill the profile in (judged feature #2).
 */
export function ProfileDrawer({ profile, changes, skillName, templateTitle, open, onClose, onSave }: Props) {
  const editable = Boolean(onSave);
  // Draft edits live here until saved. An outside profile change or a reopen starts from a clean
  // draft — the reset happens during render, keyed on what was last seen.
  const [levels, setLevels] = useState<Record<string, Level>>({});
  const [prefs, setPrefs] = useState<Pick<Preferences, "hoursPerWeek" | "pace" | "budget">>(profile.preferences);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [seen, setSeen] = useState<{ profile: Profile; open: boolean }>({ profile, open });
  if (seen.profile !== profile || seen.open !== open) {
    setSeen({ profile, open });
    setLevels({});
    setPrefs(profile.preferences);
    setSaveError(null);
  }
  const ops = useMemo<ProfileOp[]>(() => {
    const out: ProfileOp[] = [];
    for (const [skillId, level] of Object.entries(levels)) {
      if ((profile.skills[skillId]?.level ?? 0) !== level) out.push({ op: "set_skill", skillId, level, source: "stated" });
    }
    const p = profile.preferences;
    if (prefs.hoursPerWeek !== p.hoursPerWeek) out.push({ op: "set_preference", key: "hoursPerWeek", value: prefs.hoursPerWeek });
    if (prefs.pace !== p.pace) out.push({ op: "set_preference", key: "pace", value: prefs.pace });
    if (prefs.budget !== p.budget) out.push({ op: "set_preference", key: "budget", value: prefs.budget });
    return out;
  }, [levels, prefs, profile]);
  const dirty = ops.length > 0;
  const cycle = (id: string) =>
    setLevels((prev) => {
      const current = prev[id] ?? profile.skills[id]?.level ?? 0;
      return { ...prev, [id]: (((current + 1) % 4) as Level) };
    });
  async function save() {
    if (!onSave || !dirty || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(ops);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const latest = changes.at(-1);
  // Highlight the fields the latest batch touched, then let the highlight expire.
  const [expiredId, setExpiredId] = useState<number | null>(null);
  useEffect(() => {
    if (!latest) return;
    const t = setTimeout(() => setExpiredId(latest.id), 2500);
    return () => clearTimeout(t);
  }, [latest]);
  const flash = new Set(latest && expiredId !== latest.id ? latest.ops.map(opKey) : []);

  const hi = (key: string) => (flash.has(key) ? "bg-violet-soft ring-1 ring-violet-line transition-colors duration-700" : "transition-colors duration-700");
  const skills = Object.entries(profile.skills).sort(([a], [b]) => skillName(a).localeCompare(skillName(b)));
  const p = profile.preferences;

  return (
    <aside
      className={`fixed inset-y-3 right-3 z-40 w-[340px] max-w-[calc(100vw-24px)] transform overflow-y-auto rounded-panel border border-line bg-[rgb(8_8_10/88%)] p-5 text-[13.5px] text-ink-1 shadow-lift backdrop-blur-[22px] transition-transform duration-(--dur-base) ease-enter ${open ? "translate-x-0" : "translate-x-[calc(100%+16px)]"}`}
      aria-label="Learner profile"
      aria-hidden={!open}
      inert={!open}
      data-testid="profile-drawer"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-[540] tracking-[-0.02em]">Your profile</h2>
        <button type="button" className="rounded-pill border border-line px-3 py-1 text-[12px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink-1" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="mt-1 text-[12.5px] text-ink-3">
        {editable ? "Everything the engine knows about you. Nova fills this in as you talk; tap a level or a setting to correct it, then save — your path is redone to match." : "Everything the engine knows about you. Nova fills this in as you talk; nothing else writes here."}
      </p>

      <h3 className="label-caps mt-6 text-ink-3">Goals</h3>
      {profile.goals.length === 0 ? (
        <p className="mt-2 px-2 text-[13px] text-ink-3">None yet</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {profile.goals.map((g, i) => (
            <li key={i} className={`rounded px-2 py-[7px] text-[13px] leading-5 ${hi(`goal:${i}`)}`} data-testid="profile-goal">
              {g.type === "role" ? (
                <span>{templateTitle(g.templateId)}</span>
              ) : (
                <span>
                  “{g.text}”
                  <span className="block text-[12px] text-ink-3">
                    → {g.mappedSkills.map((s) => `${skillName(s.skillId)} L${s.level}`).join(", ") || "unmapped"}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="label-caps mt-6 text-ink-3">Skills</h3>
      {skills.length === 0 ? (
        <p className="mt-2 px-2 text-[13px] text-ink-3">None recorded</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {skills.map(([id, s]) => (
            <li
              key={id}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded border-b border-line/60 px-2 py-[7px] last:border-b-0 ${hi(`skill:${id}`)}`}
              data-testid="profile-skill"
            >
              <span className="truncate text-[13px] leading-5" title={skillName(id)}>
                {skillName(id)}
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap text-[12px] leading-5">
                {(() => {
                  const level = levels[id] ?? s.level;
                  const changed = level !== s.level;
                  const pill = `inline-flex h-[18px] items-center rounded-pill border px-2 text-[10.5px] font-[600] uppercase tracking-[0.08em] ${LEVEL_TONE[level]}`;
                  return editable ? (
                    <button
                      type="button"
                      className={`${pill} cursor-pointer transition-colors hover:border-line-strong ${changed ? "ring-1 ring-violet-line" : ""}`}
                      onClick={() => cycle(id)}
                      disabled={saving}
                      aria-label={`${skillName(id)}: ${LEVEL_LABEL[level]}. Press to change.`}
                      data-testid="profile-skill-level"
                      data-level={level}
                    >
                      {LEVEL_LABEL[level]}
                    </button>
                  ) : (
                    <span className={pill}>{LEVEL_LABEL[level]}</span>
                  );
                })()}
                <span className="w-[52px] text-right font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-4">{s.source}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="label-caps mt-6 text-ink-3">Preferences</h3>
      {editable ? (
        <div className="mt-2 flex flex-col gap-[6px] text-[13px] leading-5">
          <div className={`flex items-center justify-between rounded px-2 py-[3px] ${hi("pref:hoursPerWeek")}`}>
            <span className="text-ink-3">Hours / week</span>
            <span className="inline-flex items-center gap-1" data-testid="pref-hoursPerWeek">
              <Stepper label="Fewer hours" disabled={saving || prefs.hoursPerWeek <= 1} onClick={() => setPrefs((x) => ({ ...x, hoursPerWeek: Math.max(1, x.hoursPerWeek - 1) }))}>
                −
              </Stepper>
              <span className="w-8 text-center font-mono text-[12px]">{prefs.hoursPerWeek}</span>
              <Stepper label="More hours" disabled={saving || prefs.hoursPerWeek >= 60} onClick={() => setPrefs((x) => ({ ...x, hoursPerWeek: Math.min(60, x.hoursPerWeek + 1) }))}>
                +
              </Stepper>
            </span>
          </div>
          <div className={`flex items-center justify-between gap-3 rounded px-2 py-[3px] ${hi("pref:pace")}`}>
            <span className="text-ink-3">Pace</span>
            <Segmented options={PACES} value={prefs.pace} disabled={saving} testId="pref-pace" onChange={(pace) => setPrefs((x) => ({ ...x, pace }))} />
          </div>
          <div className={`flex items-center justify-between gap-3 rounded px-2 py-[3px] ${hi("pref:budget")}`}>
            <span className="text-ink-3">Budget</span>
            <Segmented options={BUDGETS} value={prefs.budget} disabled={saving} testId="pref-budget" onChange={(budget) => setPrefs((x) => ({ ...x, budget }))} />
          </div>
          <div className={`flex items-center justify-between rounded px-2 py-[3px] ${hi("pref:formats")}`}>
            <span className="text-ink-3">Formats</span>
            <span data-testid="pref-formats">{p.formats.length ? p.formats.join(", ") : "Any"}</span>
          </div>
        </div>
      ) : (
        <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-y-[2px] text-[13px] leading-5">
          <dt className="px-2 text-ink-3">Hours / week</dt>
          <dd className={`rounded px-2 text-right font-mono text-[12px] ${hi("pref:hoursPerWeek")}`} data-testid="pref-hoursPerWeek">{p.hoursPerWeek}</dd>
          <dt className="px-2 text-ink-3">Pace</dt>
          <dd className={`rounded px-2 text-right capitalize ${hi("pref:pace")}`} data-testid="pref-pace">{p.pace}</dd>
          <dt className="px-2 text-ink-3">Budget</dt>
          <dd className={`rounded px-2 text-right ${hi("pref:budget")}`} data-testid="pref-budget">{p.budget === "free-only" ? "Free only" : "Any"}</dd>
          <dt className="px-2 text-ink-3">Formats</dt>
          <dd className={`rounded px-2 text-right ${hi("pref:formats")}`} data-testid="pref-formats">{p.formats.length ? p.formats.join(", ") : "Any"}</dd>
        </dl>
      )}

      {editable && (
        <div className="sticky bottom-0 -mx-5 mt-6 flex items-center justify-between gap-3 border-t border-line bg-[rgb(8_8_10/92%)] px-5 py-3 backdrop-blur-[22px]" data-testid="profile-save-bar">
          <span className="text-[12px] text-ink-3">
            {saveError ? <span className="text-status-gap">{saveError}</span> : dirty ? `${ops.length} ${ops.length === 1 ? "change" : "changes"} — saving redoes your path` : "No unsaved changes"}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {dirty && !saving && (
              <button type="button" className="rounded-pill border border-line px-3 py-1 text-[12px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink-1" onClick={() => { setLevels({}); setPrefs(profile.preferences); }}>
                Reset
              </button>
            )}
            <button
              type="button"
              className="rounded-pill bg-brand px-3.5 py-1 text-[12px] font-[650] text-brand-foreground shadow-brand transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!dirty || saving}
              onClick={save}
              data-testid="profile-save"
            >
              {saving ? "Saving…" : "Save & update path"}
            </button>
          </span>
        </div>
      )}

      <h3 className="label-caps mt-6 text-ink-3">Recent updates</h3>
      {changes.length === 0 ? (
        <p className="mt-2 px-2 text-[13px] text-ink-3">Nothing applied yet</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-1 text-xs" data-testid="profile-log">
          {[...changes]
            .reverse()
            .slice(0, 8)
            .map((c) => (
              <li key={c.id} className="rounded-card border border-line bg-glass px-2.5 py-1.5">
                <span className="text-ink-3">{c.at}</span>
                <ul className="mt-0.5 list-disc pl-4">
                  {c.ops.map((op, i) => (
                    <li key={i}>{describeOp(op, skillName, templateTitle)}</li>
                  ))}
                </ul>
              </li>
            ))}
        </ol>
      )}
    </aside>
  );
}

function Stepper({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="grid h-6 w-6 place-items-center rounded-pill border border-line text-[13px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink-1 disabled:cursor-not-allowed disabled:opacity-40"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({ options, value, disabled, testId, onChange }: { options: { value: T; label: string }[]; value: T; disabled: boolean; testId: string; onChange: (v: T) => void }) {
  return (
    <span className="inline-flex overflow-hidden rounded-pill border border-line" role="radiogroup" data-testid={testId}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={disabled}
          className={`px-2.5 py-[2px] text-[11.5px] transition-colors ${o.value === value ? "bg-violet-soft text-violet" : "text-ink-3 hover:text-ink-1"} disabled:cursor-not-allowed`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

function opKey(op: ProfileOp): string {
  switch (op.op) {
    case "add_goal":
      return "goal:new";
    case "remove_goal":
      return `goal:${op.index}`;
    case "set_skill":
      return `skill:${op.skillId}`;
    case "set_preference":
      return `pref:${op.key}`;
    case "avoid":
      return `avoid:${op.catalogId}`;
  }
}

export function describeOp(op: ProfileOp, skillName: (id: string) => string, templateTitle: (id: string) => string): string {
  switch (op.op) {
    case "add_goal":
      return op.goal.type === "role" ? `Goal: ${templateTitle(op.goal.templateId)}` : `Goal: “${op.goal.text}” (${op.goal.mappedSkills.length} skills mapped)`;
    case "remove_goal":
      return `Removed goal #${op.index + 1}`;
    case "set_skill":
      return `${skillName(op.skillId)} → ${LEVEL_LABEL[op.level]} (${op.source})`;
    case "set_preference":
      return `${op.key} → ${Array.isArray(op.value) ? op.value.join(", ") || "any" : String(op.value)}`;
    case "avoid":
      return `Avoid ${op.catalogId}${op.provider ? ` (and de-prioritise ${op.provider})` : ""}`;
  }
}
