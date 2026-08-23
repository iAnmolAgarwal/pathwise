"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";

import styles from "./bigtype.module.css";

const EASE = [0.22, 1, 0.36, 1] as const;

function RevealHeading({ text, id, as: Tag = "h2" }: { text: string; id?: string; as?: "h1" | "h2" }) {
  const reduce = useReducedMotion();
  const words = text.trim().split(/\s+/);
  return (
    <Tag id={id} aria-label={text} className={styles.heading}>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className={styles.word}
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.08 * index }}
        >
          {word}
        </motion.span>
      ))}
    </Tag>
  );
}

/** "What Pathwise does" — the showcase statement. */
export function Showcase({ id }: { id?: string }) {
  const reduce = useReducedMotion();
  return (
    <section id={id} className={`${styles.section} ${styles.showcase}`} aria-labelledby="showcase-heading">
      <p className={styles.label}>What Pathwise does</p>
      <RevealHeading text="Your goal, mapped." id="showcase-heading" />
      <motion.p
        className={styles.description}
        initial={reduce ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
      >
        One sentence about where you want to be becomes a measured gap across 159 skills, then a
        sequenced route through 246 real courses, projects and assessments — every pick with its
        evidence attached, every step open to change.
      </motion.p>
    </section>
  );
}

/** "Try it yourself" — the closing statement before the footer. */
export function TryIt({ id, appHref = "/learn" }: { id?: string; appHref?: string }) {
  const reduce = useReducedMotion();
  return (
    <section id={id} className={`${styles.section} ${styles.contact}`} aria-labelledby="tryit-heading">
      <p className={styles.label}>Try it yourself</p>
      <RevealHeading text="Start with a goal." id="tryit-heading" />
      <motion.div
        className={styles.cta}
        initial={reduce ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
      >
        <Button size="lg" asChild>
          <Link href={appHref}>
            Open Nova <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </motion.div>
    </section>
  );
}
