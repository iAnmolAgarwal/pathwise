"use client";

import { Plus, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import styles from "./shell.module.css";

export type RailProps = {
  displayName: string;
  profileOpen: boolean;
  onToggleProfile: () => void;
  /** Extra controls (the Chat / Workspace switch on narrow screens). */
  children?: ReactNode;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function RailButton({
  label,
  active,
  onClick,
  href,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
}) {
  const className = cn(styles.railButton, active && styles.railButtonActive);
  const inner = href ? (
    <Link href={href} className={className} aria-label={label}>
      {children}
    </Link>
  ) : (
    <button type="button" className={className} onClick={onClick} aria-label={label} aria-pressed={active}>
      {children}
    </button>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** The icon rail: mark, a couple of global actions, and the learner pinned at the end. */
export function Rail({ displayName, profileOpen, onToggleProfile, children }: RailProps) {
  return (
    <nav className={styles.rail} aria-label="Workspace">
      <Link href="/" className={styles.mark} aria-label="Pathwise home">
        <svg viewBox="0 0 160 160" aria-hidden>
          <path d="M12 18h50c0 25 11 38 36 38v22c-25 0-36 13-36 38H12V18Z" fill="currentColor" />
          <path d="M148 142H98c0-25-11-38-36-38V82c25 0 36-13 36-38h50v98Z" fill="currentColor" />
        </svg>
      </Link>

      <div className={styles.railGroup}>
        <RailButton label="New learner" href="/learn">
          <Plus />
        </RailButton>
        <RailButton label={profileOpen ? "Hide profile" : "Show profile"} active={profileOpen} onClick={onToggleProfile}>
          <UserRound />
        </RailButton>
      </div>

      {children}

      <Tooltip>
        <TooltipTrigger asChild>
          <div className={styles.avatar} aria-label={displayName} role="img">
            {initials(displayName)}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">{displayName}</TooltipContent>
      </Tooltip>
    </nav>
  );
}
