"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import styles from "./footer.module.css";

const NAV = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Skill graph", href: "#skills" },
  { label: "Dashboard", href: "/learn" },
  { label: "Source", href: "https://github.com/anmolagarwal2625/pathwise" },
];

/** Placeholder until the team picks a mark: two interlocking forms in the reference's construction. */
const TEAM = [
  { label: "Anmol", href: "#" },
  { label: "Teammate", href: "#" },
  { label: "Teammate", href: "#" },
];

function PathwiseMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 160 160" role="img" aria-label="Pathwise symbol">
      <path d="M12 18h50c0 25 11 38 36 38v22c-25 0-36 13-36 38H12V18Z" fill="currentColor" />
      <path d="M148 142H98c0-25-11-38-36-38V82c25 0 36-13 36-38h50v98Z" fill="currentColor" />
    </svg>
  );
}

export function Footer({ email = "teamApprentice@gmail.com" }: { email?: string }) {
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
        card.style.setProperty("--mouse-x", `${x}%`);
        card.style.setProperty("--mouse-y", `${y}%`);
      });
    };
    const reset = () => {
      card.style.setProperty("--mouse-x", "52%");
      card.style.setProperty("--mouse-y", "73%");
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("blur", reset);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("blur", reset);
    };
  }, []);

  return (
    <footer ref={cardRef} className={styles.card} aria-label="Pathwise footer">
      <div className={`${styles.aurora} bg-aurora`} aria-hidden />
      <div className={`${styles.aurora2} bg-aurora-2`} aria-hidden />
      <div className={styles.mouseLight} aria-hidden />
      <div className={`${styles.vignette} bg-vignette`} aria-hidden />
      <div className={`${styles.noise} bg-noise`} aria-hidden />

      <div className={styles.intro}>
        <div className={`${styles.eyebrow} ${styles.reveal} ${styles.delayOne}`}>
          <span className={styles.spark}>✦</span>
          Start with a goal
        </div>
        <h2 className={`${styles.heading} ${styles.reveal} ${styles.delayTwo}`}>
          Ready to learn what matters,
          <span>skip what you already know, and see exactly why every step is there?</span>
        </h2>
      </div>

      <div className={`${styles.contact} ${styles.reveal} ${styles.delayThree}`}>
        <span className={styles.contactLabel}>Write to the team at:</span>
        <a href={`mailto:${email}`} className={styles.email} aria-label="Email the Pathwise team">
          <span>{email}</span>
          <span className={styles.emailArrow} aria-hidden>
            ↗
          </span>
        </a>
      </div>

      <nav className={`${styles.navigation} ${styles.reveal} ${styles.delayFour}`} aria-label="Footer navigation">
        {NAV.map((item) =>
          item.href.startsWith("http") ? (
            <a key={item.label} href={item.href} target="_blank" rel="noreferrer">
              <span>{item.label}</span>
            </a>
          ) : (
            <Link key={item.label} href={item.href}>
              <span>{item.label}</span>
            </Link>
          ),
        )}
      </nav>

      <div className={styles.brand}>
        <div className={styles.markWrap}>
          <PathwiseMark />
        </div>
        <div className={styles.wordmark} aria-label="Pathwise">
          pathwise
        </div>
      </div>

      <p className={styles.copyright}>© 2026 Pathwise · Team Apprentice. All rights reserved.</p>

      <div className={styles.socials}>
        {TEAM.map((member, index) => (
          <a key={`${member.label}-${index}`} href={member.href} target={member.href === "#" ? undefined : "_blank"} rel="noreferrer">
            {member.label}
          </a>
        ))}
      </div>
    </footer>
  );
}
