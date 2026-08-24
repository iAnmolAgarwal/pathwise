"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import styles from "./empty.module.css";

type GoalOption = { id: string; title: string; description: string };

type Props = {
  displayName: string;
  /** True once the learner has spoken to Nova at least once. */
  returning: boolean;
  onTalk: () => void;
  /** Nova is resting (judge mode): offer the goal picker so the engine can still build a path. */
  resting?: boolean;
  goals?: GoalOption[];
  /** Records the chosen role goal and asks the engine for the first path; rejects with a message on failure. */
  onBuildFromGoal?: (templateId: string) => Promise<void>;
};

/** The pane before a path exists: a greeting and the way to get one. */
export function EmptyPath({ displayName, returning, onTalk, resting = false, goals = [], onBuildFromGoal }: Props) {
  const first = displayName.trim().split(/\s+/)[0] || displayName;
  const [templateId, setTemplateId] = useState(goals[0]?.id ?? "");
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickGoal = resting && goals.length > 0 && onBuildFromGoal;

  async function build() {
    if (!onBuildFromGoal || !templateId) return;
    setBuilding(true);
    setError(null);
    try {
      await onBuildFromGoal(templateId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the path");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <section className={styles.empty} data-testid="empty-path" aria-labelledby="empty-path-title">
      <div className={styles.card}>
        <Badge variant="eyebrow" dot>
          No path yet
        </Badge>
        <h2 id="empty-path-title" className={styles.title}>
          {returning ? "Back at it, " : "Hi, "}
          <span className="text-gradient-violet">{first}</span>.
        </h2>
        {pickGoal ? (
          <>
            <p className={styles.lead}>
              Nova is resting, so she can&apos;t ask about you right now — but the engine that builds paths
              doesn&apos;t need her. Pick a goal and it maps the gap from real courses; you can tell Nova the
              rest later.
            </p>
            <form
              className={styles.picker}
              onSubmit={(e) => {
                e.preventDefault();
                void build();
              }}
            >
              <label className={styles.pickerLabel} htmlFor="empty-path-goal">
                I want to become
              </label>
              <select
                id="empty-path-goal"
                className={styles.select}
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={building}
                data-testid="empty-path-goal"
              >
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
              <div className={styles.actions}>
                <Button type="submit" disabled={building || !templateId} data-testid="empty-path-build">
                  {building ? "Building…" : "Build my path"} <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
            </form>
          </>
        ) : (
          <>
            <p className={styles.lead}>
              Tell Nova what you want to become. She&apos;ll check what you already know, map the gap, and
              build your first path from real courses.
            </p>
            <div className={styles.actions}>
              <Button onClick={onTalk}>
                Talk to Nova <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
