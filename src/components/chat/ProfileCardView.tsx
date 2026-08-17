"use client";

import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import type { ProfileCard, ProfileCardAnswer } from "@/schemas/profileCard";
import { Orb } from "@/components/ui/orb";
import { cn } from "@/lib/utils";

import styles from "./card.module.css";

type Level = 0 | 1 | 2 | 3;
const LEVEL_LABEL: Record<Level, string> = { 0: "New to it", 1: "Basics", 2: "Comfortable", 3: "Strong" };
const PACES: ProfileCard["preferences"]["pace"][] = ["relaxed", "standard", "intense"];
const BUDGETS: { value: ProfileCard["preferences"]["budget"]; label: string }[] = [
  { value: "free-only", label: "Free only" },
  { value: "any", label: "Paid is fine" },
];
const FORMATS: ProfileCard["preferences"]["formats"][number][] = ["video", "interactive", "text", "project"];

const DOMAIN_LABEL: Record<string, string> = {
  foundations: "Foundations",
  "web-frontend": "Web frontend",
  "web-backend": "Web backend",
  "data-engineering": "Data engineering",
  "machine-learning": "Machine learning",
  "data-analysis": "Data analysis",
  "ai-engineering": "AI engineering",
  security: "Security",
  cloud: "Cloud",
  devops: "DevOps",
};

type Props = {
  card: ProfileCard;
  /** Once answered the card is inert and shows what was said. */
  answered?: { skipped: boolean; stated: number } | null;
  busy?: boolean;
  onSubmit: (answer: ProfileCardAnswer) => void;
  onSkip: (answer: ProfileCardAnswer) => void;
};

/** The structured intake card (D-13): tap a skill to cycle its level, set the pace of life, build. */
export function ProfileCardView({ card, answered, busy = false, onSubmit, onSkip }: Props) {
  const [levels, setLevels] = useState<Record<string, Level>>(() => Object.fromEntries(card.skills.map((s) => [s.skillId, s.current])));
  const [hours, setHours] = useState(card.preferences.hoursPerWeek);
  const [pace, setPace] = useState(card.preferences.pace);
  const [budget, setBudget] = useState(card.preferences.budget);
  const [formats, setFormats] = useState<ProfileCard["preferences"]["formats"]>(card.preferences.formats);

  const groups = useMemo(() => {
    const m = new Map<string, ProfileCard["skills"]>();
    for (const s of card.skills) m.set(s.domain, [...(m.get(s.domain) ?? []), s]);
    return [...m.entries()];
  }, [card.skills]);

  const stated = Object.values(levels).filter((l) => l > 0).length;
  const answer = (): ProfileCardAnswer => ({ cardId: card.id, skills: levels, hoursPerWeek: hours, pace, budget, formats });

  if (answered) {
    return (
      <div className={cn(styles.card, styles.cardDone)} data-testid="profile-card-done">
        <span className={styles.doneIcon} aria-hidden>
          <Check />
        </span>
        <span className={styles.doneText}>
          {answered.skipped ? "Check-in skipped — built from what Nova already knew." : `Check-in done · ${answered.stated} ${answered.stated === 1 ? "skill" : "skills"} stated`}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.card} data-testid="profile-card" aria-busy={busy}>
      <header className={styles.head}>
        <span className="label-caps">Check-in</span>
        <h3 className={styles.title}>
          What do you already know for <span className="text-gradient-violet">{card.goal.label}</span>?
        </h3>
        <p className={styles.hint}>Tap a skill to cycle its level — leave it if you&apos;re new to it. Then set your week.</p>
      </header>

      <div className={styles.groups}>
        {groups.map(([domain, skills]) => (
          <section key={domain} className={styles.group}>
            <p className={styles.groupLabel}>{DOMAIN_LABEL[domain] ?? domain}</p>
            <ul className={styles.chips}>
              {skills.map((s) => {
                const level = levels[s.skillId] ?? 0;
                return (
                  <li key={s.skillId}>
                    <button
                      type="button"
                      className={cn(styles.chip, level > 0 && styles.chipOn)}
                      data-level={level}
                      aria-label={`${s.name}: ${LEVEL_LABEL[level]}. Press to change.`}
                      title={`${s.name} — ${LEVEL_LABEL[level]}`}
                      disabled={busy}
                      onClick={() => setLevels((prev) => ({ ...prev, [s.skillId]: (((prev[s.skillId] ?? 0) + 1) % 4) as Level }))}
                    >
                      <span className={styles.chipName}>{s.name}</span>
                      <span className={styles.meter} aria-hidden>
                        {[1, 2, 3].map((n) => (
                          <i key={n} className={cn(n <= level && styles.meterOn)} />
                        ))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className={styles.prefs}>
        <div className={styles.pref}>
          <span className={styles.prefLabel}>Hours a week</span>
          <div className={styles.stepper}>
            <button type="button" onClick={() => setHours((h) => Math.max(1, h - 1))} disabled={busy || hours <= 1} aria-label="Fewer hours">
              <Minus />
            </button>
            <span className={styles.stepperValue}>{hours}</span>
            <button type="button" onClick={() => setHours((h) => Math.min(60, h + 1))} disabled={busy || hours >= 60} aria-label="More hours">
              <Plus />
            </button>
          </div>
        </div>
        <div className={styles.pref}>
          <span className={styles.prefLabel}>Pace</span>
          <div className={styles.seg} role="group" aria-label="Pace">
            {PACES.map((p) => (
              <button key={p} type="button" className={cn(styles.segItem, pace === p && styles.segOn)} aria-pressed={pace === p} disabled={busy} onClick={() => setPace(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.pref}>
          <span className={styles.prefLabel}>Budget</span>
          <div className={styles.seg} role="group" aria-label="Budget">
            {BUDGETS.map((b) => (
              <button key={b.value} type="button" className={cn(styles.segItem, budget === b.value && styles.segOn)} aria-pressed={budget === b.value} disabled={busy} onClick={() => setBudget(b.value)}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.pref}>
          <span className={styles.prefLabel}>Formats <em>(optional)</em></span>
          <div className={styles.seg} role="group" aria-label="Formats">
            {FORMATS.map((f) => {
              const on = formats.includes(f);
              return (
                <button key={f} type="button" className={cn(styles.segItem, on && styles.segOn)} aria-pressed={on} disabled={busy} onClick={() => setFormats((prev) => (on ? prev.filter((x) => x !== f) : [...prev, f]))}>
                  {f}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <footer className={styles.foot}>
        <button type="button" className={styles.build} disabled={busy} onClick={() => onSubmit(answer())} data-testid="profile-card-build">
          {busy ? <Orb state="working" size={20} label="Building" /> : null}
          {busy ? "Building" : "Build my path"}
          {!busy && <ArrowRight data-icon="inline-end" />}
        </button>
        <button type="button" className={styles.skip} disabled={busy} onClick={() => onSkip(answer())} data-testid="profile-card-skip">
          Skip — just build it
        </button>
        <span className={styles.count} aria-live="polite">
          {stated} {stated === 1 ? "skill" : "skills"} stated
        </span>
      </footer>
    </div>
  );
}
