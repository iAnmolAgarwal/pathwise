import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BADGE_ANCHOR_EDGE } from "@/lib/edgeCard";
import { loadEvidencePlates } from "@/lib/evidencePlates";
import { millionsInWords } from "@/lib/trustFormat";

const raw = JSON.parse(readFileSync(join(__dirname, "..", "src", "data", "skill_edges.json"), "utf8"));
const record = raw.edges.find((e: { from: string; to: string }) => e.from === BADGE_ANCHOR_EDGE.from && e.to === BADGE_ANCHOR_EDGE.to);

describe("evidence plates copy the anchor edge from skill_edges.json", () => {
  const plates = loadEvidencePlates();

  it("carries both sources with the six N-2 fields and the fixed caveat", () => {
    expect(plates.sources.map((s) => s.id)).toEqual(["stackoverflow", "coursera"]);
    for (const s of plates.sources) {
      const src = record.sources[s.id];
      expect(s.support).toBe(src.support);
      expect(s.reverse).toBe(src.reverse);
      expect(s.confidence).toBe(src.confidence);
      expect(s.n).toBe(src.n);
      expect(s.caveat).toBe(raw.caveats[s.id]);
      expect(s.caveat.length).toBeGreaterThan(0);
      expect(s.name.length).toBeGreaterThan(0);
    }
  });

  it("prints the same lines as the app's click card", () => {
    expect(plates.card.order).toBe(`${plates.from} before ${plates.to}`);
    expect(plates.card.verdictKind).toBe("verified");
    expect(plates.card.count).toContain("in this order");
  });

  it("uses no rating words anywhere (N-5)", () => {
    const text = JSON.stringify(plates).toLowerCase();
    for (const word of ["satisfied", "struggled", "liked", " hard"]) expect(text).not.toContain(word);
  });
});

describe("millionsInWords", () => {
  it("floors to whole millions in words and never rounds up", () => {
    expect(millionsInWords(2_210_622)).toBe("two million");
    expect(millionsInWords(2_999_999)).toBe("two million");
    expect(millionsInWords(1_000_000)).toBe("one million");
    expect(millionsInWords(72_774)).toBe("72,774");
  });
});
