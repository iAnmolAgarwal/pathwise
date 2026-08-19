import type { SkillEdge } from "../schemas";

/** The part of a skill edge the path logic needs; the evidence layer reads the rest. */
export type PathEdge = Pick<SkillEdge, "from" | "to" | "drivesPath">;

/** prerequisite lists keyed by the dependent skill, in file order. */
export type PrereqMap = ReadonlyMap<string, readonly string[]>;

/**
 * The engine walks only path-driving edges (§5.1): authored ones plus any a human promoted.
 * Mined candidates are evidence and display, never control.
 */
export function pathDrivingEdges<E extends PathEdge>(edges: readonly E[]): E[] {
  return edges.filter((e) => e.drivesPath);
}

/** Prerequisites of each skill over the path-driving edges, keeping the file order of the edges. */
export function prereqMap(edges: readonly PathEdge[]): PrereqMap {
  const map = new Map<string, string[]>();
  for (const e of pathDrivingEdges(edges)) {
    const list = map.get(e.to);
    if (list) list.push(e.from);
    else map.set(e.to, [e.from]);
  }
  return map;
}
