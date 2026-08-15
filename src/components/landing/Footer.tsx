"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import styles from "./footer.module.css";
import { useInView } from "./useInView";

const NAV = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Skill graph", href: "#skills" },
  { label: "Dashboard", href: "/learn" },
  { label: "Source", href: "https://github.com/anmolagarwal2625/pathwise" },
];

/** Team links (LinkedIn); the row renders only once entries exist. */
const TEAM: Array<{ label: string; href: string }> = [];

/** Placeholder mark until the team picks one: two interlocking forms in the reference's construction. */
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
  const inView = useInView(cardRef);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (card.dataset.quiet === "true") return;
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
    <footer ref={cardRef} className={`${styles.card} ${inView ? "" : styles.quiet}`} aria-label="Pathwise footer" data-quiet={inView ? "false" : "true"}>
      <div className={`${styles.aurora} bg-aurora`} aria-hidden />
      <div className={`${styles.aurora2} bg-aurora-2`} aria-hidden />
      <div className={styles.mouseLight} aria-hidden />
      <div className={`${styles.vignette} bg-vignette`} aria-hidden />
      <div className={`${styles.noise} bg-noise`} aria-hidden />

      <div className={styles.intro}>
        <div className={`${styles.eyebrow} ${styles.reveal} ${styles.delayOne}`}>
          <span className={styles.spark}>✦</span>
          Get in touch
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

      <p className={styles.copyright}>© 2026 Pathwise · built by Team Apprentice</p>

      {TEAM.length > 0 && (
        <div className={styles.socials}>
          {TEAM.map((member) => (
            <a key={member.href} href={member.href} target="_blank" rel="noreferrer">
              {member.label}
            </a>
          ))}
        </div>
      )}
    </footer>
  );
}
