"use client";

import { DropdownMenu } from "radix-ui";
import { Check, LogOut, Plus, UserRound, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/schemas";

import styles from "./shell.module.css";

export type RailLearner = { id: string; displayName: string };

export type RailProps = {
  /** The learner this workspace belongs to. */
  learnerId: string;
  displayName: string;
  /** The signed-in Google user behind the avatar button. */
  user: SessionUser;
  /** Every learner this user owns, for the switcher. */
  learners: RailLearner[];
  onOpenProfile: () => void;
  onSignOut: () => void;
  /** Extra controls (the Chat / Workspace switch on narrow screens). */
  children?: ReactNode;
};

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

/** The icon rail: mark, "new learner", and the signed-in user pinned at the end (§19). */
export function Rail({ learnerId, displayName, user, learners, onOpenProfile, onSignOut, children }: RailProps) {
  const userLabel = user.name ?? user.email ?? "Account";
  return (
    <nav className={styles.rail} aria-label="Workspace">
      <Link href="/" className={styles.mark} aria-label="Pathwise home">
        <svg viewBox="0 0 160 160" aria-hidden>
          <path d="M12 18h50c0 25 11 38 36 38v22c-25 0-36 13-36 38H12V18Z" fill="currentColor" />
          <path d="M148 142H98c0-25-11-38-36-38V82c25 0 36-13 36-38h50v98Z" fill="currentColor" />
        </svg>
      </Link>

      <div className={styles.railGroup}>
        <RailButton label="New learner" href="/learn/new">
          <Plus />
        </RailButton>
      </div>

      {children}

      <DropdownMenu.Root modal={false}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenu.Trigger asChild>
              <button type="button" className={styles.userButton} aria-label={`Account: ${userLabel}`} data-testid="user-button">
                {user.image ? (
                  // Google's avatar host varies per account; a plain img keeps it out of the image optimiser's allow-list.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span className={styles.avatar}>{initials(userLabel)}</span>
                )}
              </button>
            </DropdownMenu.Trigger>
          </TooltipTrigger>
          <TooltipContent side="right">{userLabel}</TooltipContent>
        </Tooltip>

        <DropdownMenu.Portal>
          <DropdownMenu.Content side="right" align="end" sideOffset={10} className={styles.menu}>
            <div className={styles.menuIdentity}>
              <strong>{user.name ?? "Signed in"}</strong>
              {user.email && <span>{user.email}</span>}
            </div>

            <DropdownMenu.Separator className={styles.menuSeparator} />
            <DropdownMenu.Label className={styles.menuLabel}>
              <Users /> Learner
            </DropdownMenu.Label>
            {learners.map((l) => (
              <DropdownMenu.Item key={l.id} asChild className={styles.menuItem} data-current={l.id === learnerId || undefined}>
                <Link href={`/learn/${l.id}`}>
                  <span className={styles.menuAvatar}>{initials(l.displayName)}</span>
                  <span className={styles.menuItemText}>{l.displayName}</span>
                  {l.id === learnerId && <Check className={styles.menuCheck} />}
                </Link>
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Item asChild className={styles.menuItem}>
              <Link href="/learn/new">
                <Plus /> New learner
              </Link>
            </DropdownMenu.Item>

            <DropdownMenu.Separator className={styles.menuSeparator} />
            <DropdownMenu.Item className={styles.menuItem} onSelect={onOpenProfile}>
              <UserRound /> {displayName}&rsquo;s profile
            </DropdownMenu.Item>
            <DropdownMenu.Item className={styles.menuItem} onSelect={onSignOut} data-testid="sign-out">
              <LogOut /> Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </nav>
  );
}
