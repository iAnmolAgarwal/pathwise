"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";

import styles from "./bigtype.module.css";

const EASE = [0.22, 1, 0.36, 1] as const;

function RevealHeading({ text, as: Tag = "h2" }: { text: string; as?: "h1" | "h2" }) {
  const words = text.trim().split(/\s+/);
  return (
    <Tag className={styles.heading}>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className={styles.word}
          initial={{ opacity: 0, y: 14 }}
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
  return (
    <section id={id} className={`${styles.section} ${styles.showcase}`} aria-labelledby="showcase-heading">
      <p className={styles.label}>What Pathwise does</p>
      <RevealHeading text="Your goal, mapped." />
      <motion.p
        className={styles.description}
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
      >
        Tell Nova where you want to be. Pathwise measures the gap between what you know and what
        the goal needs across 159 skills, builds the shortest evidenced route through 246 courses,
        projects and assessments — and rewrites it when you push back.
      </motion.p>
    </section>
  );
}

/** "Try it yourself" — the closing statement before the footer. */
export function TryIt({ id, appHref = "/learn" }: { id?: string; appHref?: string }) {
  return (
    <section id={id} className={`${styles.section} ${styles.contact}`} aria-labelledby="tryit-heading">
      <p className={styles.label}>Try it yourself</p>
      <RevealHeading text="Start with a goal." />
      <motion.div
        className={styles.cta}
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
      >
        <Button size="lg" asChild>
          <Link href={appHref}>
            Open Nova <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      </motion.div>
    </section>
  );
}
