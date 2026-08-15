"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dagre from "@dagrejs/dagre";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SkillStatus } from "@/engine/dashboard";
import type { Evidence } from "@/schemas";
import type { SkillLite } from "../path/PathBuilder";

/** Status colors follow the fixed status palette; identity is never color-alone (legend + label). */
export const STATUS_STYLE: Record<SkillStatus, { fill: string; label: string; glyph: string }> = {
  acquired: { fill: "#0ca30c", label: "Acquired", glyph: "✓" },
  "in-progress": { fill: "#2a78d6", label: "In progress", glyph: "▶" },
  gap: { fill: "#ec835a", label: "Gap", glyph: "○" },
  unrelated: { fill: "#c3c2b7", label: "Not on your path", glyph: "·" },
};

type SkillNodeData = {
  label: string;
  status: SkillStatus;
  highlighted: boolean;
  dimmed: boolean;
  level: number;
  [key: string]: unknown;
};

const NODE_W = 150;
const NODE_H = 30;

function SkillNode({ data }: NodeProps<Node<SkillNodeData>>) {
  const style = STATUS_STYLE[data.status];
  return (
    <div
      className="rounded-full border-2 px-2 text-[11px] leading-[26px] whitespace-nowrap overflow-hidden text-ellipsis bg-white"
      style={{
        width: NODE_W,
        height: NODE_H,
        borderColor: data.highlighted ? "#000" : style.fill,
        boxShadow: data.highlighted ? `0 0 0 3px ${style.fill}55` : undefined,
        opacity: data.dimmed ? 0.25 : 1,
        fontWeight: data.highlighted ? 600 : 400,
      }}
      title={`${data.label} — ${style.label}${data.level ? ` (level ${data.level})` : ""}`}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span className="mr-1" style={{ color: style.fill }} aria-hidden>
        {style.glyph}
      </span>
      {data.label}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { skill: SkillNode };

/** Layout once per skill set: dagre over the prerequisite DAG, top to bottom. */
function layout(skills: SkillLite[]): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 14, ranksep: 46, marginx: 10, marginy: 10 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const s of skills) g.setNode(s.id, { width: NODE_W, height: NODE_H });
  const ids = new Set(skills.map((s) => s.id));
  for (const s of skills) for (const p of s.prereqs) if (ids.has(p)) g.setEdge(p, s.id);
  dagre.layout(g);
  return new Map(skills.map((s) => [s.id, { x: g.node(s.id).x - NODE_W / 2, y: g.node(s.id).y - NODE_H / 2 }]));
}

export type GraphHighlight = { catalogId: string; title: string; evidence: Evidence } | null;

type Props = {
  skills: SkillLite[];
  skillStatus: Record<string, SkillStatus>;
  levels: Record<string, number>;
  highlight: GraphHighlight;
  onSelectSkill?: (skillId: string) => void;
};

function SkillGraphInner({ skills, skillStatus, levels, highlight, onSelectSkill }: Props) {
  const positions = useMemo(() => layout(skills), [skills]);
  const { fitView } = useReactFlow();

  const highlightSet = useMemo(() => {
    const ids = new Set<string>();
    const edgeKeys = new Set<string>();
    for (const g of highlight?.evidence.gapSkillsCovered ?? []) {
      g.graphPath.forEach((id, i) => {
        ids.add(id);
        if (i > 0) edgeKeys.add(`${g.graphPath[i - 1]}->${id}`);
      });
    }
    return { ids, edgeKeys };
  }, [highlight]);

  const build = useCallback(() => {
    const dim = highlightSet.ids.size > 0;
    const nodes: Node<SkillNodeData>[] = skills.map((s) => ({
      id: s.id,
      type: "skill",
      position: positions.get(s.id)!,
      data: {
        label: s.name,
        status: skillStatus[s.id] ?? "unrelated",
        highlighted: highlightSet.ids.has(s.id),
        dimmed: dim && !highlightSet.ids.has(s.id),
        level: levels[s.id] ?? 0,
      },
    }));
    const ids = new Set(skills.map((s) => s.id));
    const edges: Edge[] = skills.flatMap((s) =>
      s.prereqs
        .filter((p) => ids.has(p))
        .map((p) => {
          const on = highlightSet.edgeKeys.has(`${p}->${s.id}`);
          return {
            id: `${p}->${s.id}`,
            source: p,
            target: s.id,
            animated: on,
            style: { stroke: on ? "#000" : "#c3c2b7", strokeWidth: on ? 2.5 : 1, opacity: dim && !on ? 0.2 : 1 },
            markerEnd: { type: MarkerType.ArrowClosed, color: on ? "#000" : "#c3c2b7" },
          };
        }),
    );
    return { nodes, edges };
  }, [skills, positions, skillStatus, highlightSet, levels]);

  const initial = useMemo(() => build(), [build]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  useEffect(() => {
    const next = build();
    setNodes(next.nodes);
    setEdges(next.edges);
    if (highlightSet.ids.size > 0) {
      const t = setTimeout(() => fitView({ nodes: [...highlightSet.ids].map((id) => ({ id })), duration: 500, padding: 0.4 }), 50);
      return () => clearTimeout(t);
    }
  }, [build, setNodes, setEdges, highlightSet, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => onSelectSkill?.(node.id)}
      fitView
      minZoom={0.15}
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

/** Skill-graph explorer (§7 rendering 1): gap coloring plus click-to-highlight evidence paths. */
export function SkillGraph(props: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const skill = selected ? props.skills.find((s) => s.id === selected) : null;
  const status = skill ? (props.skillStatus[skill.id] ?? "unrelated") : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-xs" data-testid="graph-legend">
        {(Object.keys(STATUS_STYLE) as SkillStatus[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: STATUS_STYLE[k].fill }} aria-hidden />
            <span style={{ color: STATUS_STYLE[k].fill }} aria-hidden>{STATUS_STYLE[k].glyph}</span>
            {STATUS_STYLE[k].label}
          </span>
        ))}
        {props.highlight && (
          <span className="ml-auto rounded border border-black px-2 py-0.5" data-testid="graph-highlight">
            Showing why <strong>{props.highlight.title}</strong>:{" "}
            {props.highlight.evidence.gapSkillsCovered.map((g) => g.graphPath.map((id) => props.skills.find((s) => s.id === id)?.name ?? id).join(" → ")).join(" · ")}
          </span>
        )}
      </div>
      <div className="h-[32rem] rounded border" data-testid="skill-graph">
        <ReactFlowProvider>
          <SkillGraphInner {...props} onSelectSkill={(id) => { setSelected(id); props.onSelectSkill?.(id); }} />
        </ReactFlowProvider>
      </div>
      {skill && status && (
        <p className="text-sm" data-testid="graph-selected">
          <strong>{skill.name}</strong> · {STATUS_STYLE[status].label}
          {props.levels[skill.id] ? ` · your level ${props.levels[skill.id]}` : ""}
          {skill.prereqs.length > 0 && <> · builds on {skill.prereqs.map((p) => props.skills.find((s) => s.id === p)?.name ?? p).join(", ")}</>}
        </p>
      )}
    </div>
  );
}
