"use client";

import { useEffect, useState } from "react";

import type { DashboardSummary } from "@/engine/dashboard";
import type { ProfileStats } from "@/engine/profileStats";

import { ActivityHeatmap } from "./ActivityHeatmap";
import { DashboardTab } from "./DashboardTab";
import { DifficultyCard } from "./DifficultyCard";
import { ProfileRail } from "./ProfileRail";
import styles from "./pane.module.css";

type Props = {
  learnerId: string;
  displayName: string;
  summary: DashboardSummary | null;
  onOpenItem?: (catalogId: string) => void;
};

/**
 * Drop-in replacement for DashboardTab: the identity rail on the left, and the existing
 * dashboard rendered untouched on the right with the difficulty split above it and the
 * activity calendar below. DashboardTab itself is not modified — it is rendered as-is.
 *
 * Profile stats are fetched separately from the summary so neither computation blocks the
 * other, and so a failure in one does not blank the other.
 */
export function DashboardPane({ learnerId, displayName, summary, onOpenItem }: Props) {
  const [stats, setStats] = useState<ProfileStats | null>(null);

  // Refetch whenever the summary changes: both derive from the same stored state.
  const version = summary?.progress.itemsDone ?? -1;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profile-stats/${learnerId}`)
      .then((r) => (r.ok ? (r.json() as Promise<ProfileStats>) : null))
      .then((d) => {
        if (!cancelled && d) setStats(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [learnerId, version]);

  return (
    <div className={styles.pane} data-testid="dashboard-pane">
      <div className={styles.rail}>
        <ProfileRail displayName={displayName} stats={stats} />
      </div>
      <div className={styles.main}>
        <DifficultyCard stats={stats} />
        <DashboardTab summary={summary} onOpenItem={onOpenItem} />
        <ActivityHeatmap stats={stats} />
      </div>
    </div>
  );
}
