"use client";

import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import styles from "./empty.module.css";

type Props = {
  displayName: string;
  /** True once the learner has spoken to Nova at least once. */
  returning: boolean;
  onTalk: () => void;
};

/** The pane before a path exists: a greeting and the way to get one. */
export function EmptyPath({ displayName, returning, onTalk }: Props) {
  const first = displayName.trim().split(/\s+/)[0] || displayName;
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
        <p className={styles.lead}>
          Tell Nova what you want to become. She&apos;ll check what you already know, map the gap, and
          build your first path from real courses.
        </p>
        <div className={styles.actions}>
          <Button onClick={onTalk}>
            Talk to Nova <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </section>
  );
}
