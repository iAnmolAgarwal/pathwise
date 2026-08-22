import { describe, expect, it } from "vitest";
import { loadEngineData } from "@/lib/engineData";
import { BRANCH_OVERLAY_COLLAPSED_LIMIT, BRANCH_OVERLAY_LIMIT, branchOverlayFor, branchOverlayView, buildBranchOverlay } from "@/lib/branchOverlay";
import { loadGraphEvidence } from "@/lib/graphEvidence";
import type { Branch } from "@/schemas";

const CAVEAT = "asking ≠ completing";
const above: Branch = {
  from: "javascript", source: "stackoverflow", nTotal: 2000, nNextObserved: 6, minSupportMet: true, caveat: CAVEAT,
  next: [
    { to: "react", n: 900, shareRaw: 0.45, shareShrunk: 0.44, inCatalog: true },
    { to: "css", n: 500, shareRaw: 0.25, shareShrunk: 0.25, inCatalog: true },
    { to: "node", n: 300, shareRaw: 0.15, shareShrunk: 0.15, inCatalog: true },
    { to: "typescript", n: 200, shareRaw: 0.1, shareShrunk: 0.1, inCatalog: false },
    { to: "vue", n: 60, shareRaw: 0.03, shareShrunk: 0.03, inCatalog: true },
    { to: "angular", n: 40, shareRaw: 0.02, shareShrunk: 0.03, inCatalog: true },
  ],
};
const below: Branch = { ...above, source: "coursera", nTotal: 40, minSupportMet: false, next: [{ to: "react", n: 40, shareRaw: 1, shareShrunk: 1, inCatalog: true }] };

describe("branch overlay model (§15.8, D-18)", () => {
  it("shows steps only when minSupportMet; below the floor it carries nothing but nTotal", () => {
    const a = branchOverlayFor(above);
    expect(a.minSupportMet).toBe(true);
    expect(branchOverlayFor(below)).toEqual({ source: "coursera", minSupportMet: false, nTotal: 40 });
    // A file entry flagged met but under the floor is still treated as below it.
    expect(branchOverlayFor({ ...above, nTotal: 49 }).minSupportMet).toBe(false);
  });

  it("lists at most the limit, by shrunk share then count, keeping out-of-catalog steps (greyed, never hidden)", () => {
    const a = branchOverlayFor(above);
    if (!a.minSupportMet) throw new Error("expected steps");
    expect(a.steps.map((s) => s.to)).toEqual(["react", "css", "node", "typescript"]);
    expect(a.steps).toHaveLength(BRANCH_OVERLAY_LIMIT);
    expect(a.steps[3].inCatalog).toBe(false);
    expect(a.listed).toBe(6);
    expect(a.nNextObserved).toBe(6);
    // Ties on share break by count: vue (60) before angular (40).
    const five = branchOverlayFor(above, 5);
    if (!five.minSupportMet) throw new Error("expected steps");
    expect(five.steps[4].to).toBe("vue");
  });

  it("never shows a share for a successor with n < 5, even if the file listed one", () => {
    const thin: Branch = { ...above, next: [...above.next, { to: "svelte", n: 4, shareRaw: 0.002, shareShrunk: 0.01, inCatalog: true }] };
    const t = branchOverlayFor(thin, 10);
    if (!t.minSupportMet) throw new Error("expected steps");
    expect(t.steps.some((s) => s.to === "svelte")).toBe(false);
    expect(t.steps.every((s) => s.n >= 5)).toBe(true);
  });

  it("shares of the shown steps never exceed the listed total, which never exceeds 1", () => {
    const a = branchOverlayFor(above);
    if (!a.minSupportMet) throw new Error("expected steps");
    const shown = a.steps.reduce((s, x) => s + x.shareShrunk, 0);
    const listed = above.next.reduce((s, x) => s + x.shareShrunk, 0);
    expect(shown).toBeLessThanOrEqual(listed + 1e-9);
    expect(listed).toBeLessThanOrEqual(1 + 1e-6);
    expect(Math.abs(listed - 1)).toBeLessThan(1e-6); // every successor listed here → sums to 1
  });
});

describe("branch overlay over the real data", () => {
  const data = loadEngineData();
  const overlay = buildBranchOverlay(data.branches);
  const graph = loadGraphEvidence();

  it("is the slice the explorer receives, keyed by (skill, source), with the file's floors", () => {
    expect(graph.branches).toEqual(overlay);
    expect(graph.branchFloors).toEqual({ minTotal: 50, minListed: 5, alpha: 20 });
    expect(Object.keys(overlay).length).toBeGreaterThanOrEqual(10); // D-18 gate: the overlay ships
  });

  it("matches branches.json entry by entry: met ⇔ steps, counts verbatim, shown shares ≤ listed ≤ 1, no step under n 5", () => {
    for (const b of data.branches) {
      const o = overlay[b.from]?.[b.source];
      expect(o, `${b.from}/${b.source}`).toBeDefined();
      expect(o!.minSupportMet).toBe(b.minSupportMet && b.nTotal >= 50);
      expect(o!.nTotal).toBe(b.nTotal);
      if (!o!.minSupportMet) continue;
      expect(o!.steps.length).toBeLessThanOrEqual(BRANCH_OVERLAY_LIMIT);
      const listed = b.next.reduce((s, x) => s + x.shareShrunk, 0);
      const shown = o!.steps.reduce((s, x) => s + x.shareShrunk, 0);
      expect(shown).toBeLessThanOrEqual(listed + 1e-9);
      expect(listed).toBeLessThanOrEqual(1 + 1e-6);
      for (const s of o!.steps) {
        expect(s.n).toBeGreaterThanOrEqual(5);
        const x = b.next.find((y) => y.to === s.to)!;
        expect([s.n, s.shareShrunk, s.inCatalog]).toEqual([x.n, x.shareShrunk, x.inCatalog]);
      }
      // The shown steps are the largest listed shares.
      const floor = Math.min(...o!.steps.map((s) => s.shareShrunk));
      expect(b.next.filter((x) => x.shareShrunk > floor).length).toBeLessThanOrEqual(o!.steps.length);
    }
  });

  it("every source name and caveat the overlay will render is the file's caveat, free of satisfaction wording (N-5)", () => {
    for (const src of ["stackoverflow", "coursera"] as const) {
      const fromFile = data.branches.find((b) => b.source === src)!.caveat;
      expect(graph.caveats[src]).toBe(fromFile);
      expect(fromFile).not.toMatch(/satisf|struggl|liked|enjoy|\bhard\b/i);
    }
  });
});

describe("branch overlay default view (de-clutter, item 8)", () => {
  const soMet = branchOverlayFor(above);
  const csMet = branchOverlayFor({ ...above, source: "coursera", nTotal: 90000 });
  const csBelow = branchOverlayFor(below);

  it("collapsed: one source, the larger population, three steps", () => {
    const v = branchOverlayView({ stackoverflow: soMet, coursera: csMet }, false);
    expect(v).toEqual({ sources: ["coursera"], stepLimit: BRANCH_OVERLAY_COLLAPSED_LIMIT, canExpand: true });
    expect(BRANCH_OVERLAY_COLLAPSED_LIMIT).toBe(3);
  });

  it("expanded: every source, larger first, up to four steps each; below-floor sources come last", () => {
    expect(branchOverlayView({ stackoverflow: soMet, coursera: csBelow }, true)).toEqual({ sources: ["stackoverflow", "coursera"], stepLimit: BRANCH_OVERLAY_LIMIT, canExpand: true });
    expect(branchOverlayView({ stackoverflow: soMet, coursera: csMet }, true).sources).toEqual(["coursera", "stackoverflow"]);
  });

  it("never picks a below-floor source as the default, and offers nothing to expand when one source has at most three steps", () => {
    expect(branchOverlayView({ stackoverflow: soMet, coursera: csBelow }, false).sources).toEqual(["stackoverflow"]);
    const three = branchOverlayFor({ ...above, next: above.next.slice(0, 3) });
    expect(branchOverlayView({ stackoverflow: three }, false)).toEqual({ sources: ["stackoverflow"], stepLimit: 3, canExpand: false });
    expect(branchOverlayView({ coursera: csBelow }, false)).toEqual({ sources: ["coursera"], stepLimit: 0, canExpand: false });
    expect(branchOverlayView({}, false).sources).toEqual([]);
  });
});
