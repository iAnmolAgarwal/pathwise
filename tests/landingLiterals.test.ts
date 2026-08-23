import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every number the landing page shows must be read from data (src/lib/trust.ts, demoStory.ts,
 * evidencePlates.ts), never typed into a component. This scans the text a landing component
 * can render (JSX text nodes and string literals) for any number above 99 and fails on each
 * one that is not on the structural allow-list below.
 */
const ROOT = join(__dirname, "..", "src", "components", "landing");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return name.endsWith(".tsx") ? [full] : [];
  });
}

/** Structural strings a number may legitimately live in: geometry, colour, timing, CSS, links. */
const STRUCTURAL = [
  /^https?:\/\//, // link targets
  /^#[0-9a-f]{3,8}$/i, // hex colours
  /^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$/, // SVG path data and plain numeric attribute values
  /%|px|ms|deg|cqw|vw|vh|rem|em\b/, // sizes, durations, CSS units
  /^\d+(\.\d+)?$/, // bare numeric attribute value (viewBox parts, sizes)
  /^[\d .-]+$/, // viewBox and point lists
];

/** Copy that carries a number on purpose; each entry is a literal the page shows and why. */
const COPY_ALLOW: Array<{ text: string; why: string }> = [
  { text: "© 2026 Pathwise · built by Team Apprentice", why: "copyright year" },
];

function renderableStrings(source: string): string[] {
  const out: string[] = [];
  // JSX text nodes: between a closing '>' and the next '<', no braces inside; a run that
  // contains ';' or '=' is code between comparison operators, not text.
  for (const m of source.matchAll(/>([^<>{}]+)</g)) if (!/[;=]/.test(m[1])) out.push(m[1]);
  // String literals (double, single, template chunks without expressions).
  for (const m of source.matchAll(/"([^"\\\n]*(?:\\.[^"\\\n]*)*)"/g)) out.push(m[1]);
  for (const m of source.matchAll(/'([^'\\\n]*(?:\\.[^'\\\n]*)*)'/g)) out.push(m[1]);
  for (const m of source.matchAll(/`([^`$\n]*)`/g)) out.push(m[1]);
  // Decode \uXXXX escapes so the digits of a quote mark are not read as a number.
  return out
    .map((s) => s.replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).trim())
    .filter(Boolean);
}

describe("landing components carry no typed numbers", () => {
  const files = tsxFiles(ROOT);

  it("finds the landing components", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    it(relative(ROOT, file), () => {
      const source = readFileSync(file, "utf8");
      const offenders: string[] = [];
      for (const text of renderableStrings(source)) {
        if (!/\d{3,}/.test(text)) continue;
        if (STRUCTURAL.some((re) => re.test(text))) continue;
        if (COPY_ALLOW.some((a) => a.text === text)) continue;
        offenders.push(text);
      }
      expect(offenders, `typed numbers in ${relative(ROOT, file)}:\n${offenders.join("\n")}`).toEqual([]);
    });
  }
});
