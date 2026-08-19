import { describe, expect, it } from "vitest";
import { pathDrivingEdges, prereqMap } from "@/engine/edges";
import type { SkillEdge } from "@/schemas";

const edge = (from: string, to: string, drivesPath: boolean): SkillEdge =>
  drivesPath
    ? { from, to, origin: "authored", status: "no-data", drivesPath, sources: {} }
    : { from, to, origin: "mined", status: "candidate", drivesPath, sources: {} };

describe("path-driving edges (§5.1)", () => {
  const edges = [edge("js", "react", true), edge("css", "react", true), edge("python", "react", false), edge("js", "vue", true)];

  it("keeps only edges with drivesPath — mined candidates never reach the walk", () => {
    expect(pathDrivingEdges(edges).map((e) => `${e.from}>${e.to}`)).toEqual(["js>react", "css>react", "js>vue"]);
  });

  it("builds prerequisite lists per dependent skill in file order", () => {
    const map = prereqMap(edges);
    expect(map.get("react")).toEqual(["js", "css"]);
    expect(map.get("vue")).toEqual(["js"]);
    expect(map.get("python")).toBeUndefined();
  });

  it("a promoted mined edge drives paths like an authored one", () => {
    const promoted: SkillEdge = { from: "python", to: "pandas", origin: "mined", status: "promoted", drivesPath: true, sources: {} };
    expect(prereqMap([promoted]).get("pandas")).toEqual(["python"]);
  });
});
