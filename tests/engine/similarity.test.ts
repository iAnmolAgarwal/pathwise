import { describe, expect, it } from "vitest";
import { centroid, cosine, dot } from "@/engine/similarity";

describe("dot / cosine", () => {
  it("dot multiplies and sums", () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it("cosine of identical vectors is 1", () => {
    expect(cosine([3, 4], [3, 4])).toBeCloseTo(1);
  });

  it("cosine of orthogonal vectors is 0", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("cosine of a zero vector is 0, not NaN", () => {
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });

  it("throws on mismatched dimensions", () => {
    expect(() => dot([1], [1, 2])).toThrow();
  });
});

describe("centroid", () => {
  it("averages component-wise", () => {
    expect(centroid([[0, 2], [2, 0]])).toEqual([1, 1]);
  });

  it("returns null for an empty set", () => {
    expect(centroid([])).toBeNull();
  });
});
