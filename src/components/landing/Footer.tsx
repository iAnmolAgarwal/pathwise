"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import styles from "./footer.module.css";
import { useInView } from "./useInView";

const NAV = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Open Nova", href: "/learn" },
  { label: "Source", href: "https://github.com/iAnmolAgarwal/pathwise" },
];

/** Attribution the evidence numbers on this page require (README, "Data sources and attribution"). */
const CREDIT = {
  licence: { label: "CC BY-SA 4.0", href: "https://creativecommons.org/licenses/by-sa/4.0/" },
  corpus: { label: "Kaggle", href: "https://www.kaggle.com/datasets/imuhammad/course-reviews-on-coursera" },
};

/** Team row: names link to LinkedIn where a profile has been provided. */
const TEAM: Array<{ label: string; href?: string }> = [
  { label: "Anmol Agarwal", href: "https://www.linkedin.com/in/anmolagarwal26" },
  { label: "Riyan Garg", href: "https://www.linkedin.com/in/riyan-garg-b0221a320/" },
  { label: "Sansriti Mishra", href: "https://www.linkedin.com/in/sansriti-mishra/" },
  { label: "Luv", href: "https://www.linkedin.com/in/luvbansal1" },
  { label: "Archi" },
];

/** Placeholder mark until the team picks one: two interlocking forms in the reference's construction. */
function PathwiseMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 160 160" aria-hidden>
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
          Your goal becomes a path,
          <span>and every step on it says why it is there.</span>
        </h2>
      </div>

      <div className={`${styles.contact} ${styles.reveal} ${styles.delayThree}`}>
        <span className={styles.contactLabel}>Write to the team at:</span>
        <a href={`mailto:${email}`} className={styles.email} aria-label={`Email ${email}`}>
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
        <div className={styles.wordmark}>
          pathwise
        </div>
      </div>

      <div className={styles.copyright}>
        <p className={styles.credit}>
          Stack Overflow data under{" "}
          <a href={CREDIT.licence.href} target="_blank" rel="noreferrer">
            {CREDIT.licence.label}
          </a>
          . Coursera review order via{" "}
          <a href={CREDIT.corpus.href} target="_blank" rel="noreferrer">
            {CREDIT.corpus.label}
          </a>
          .
        </p>
        <p>© 2026 Pathwise · built by Team Apprentice</p>
      </div>

      {TEAM.length > 0 && (
        <div className={styles.socials}>
          {TEAM.map((member) =>
            member.href ? (
              <a key={member.label} href={member.href} target="_blank" rel="noreferrer">
                {member.label}
              </a>
            ) : (
              <span key={member.label}>{member.label}</span>
            ),
          )}
        </div>
      )}
    </footer>
  );
}
