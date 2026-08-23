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
