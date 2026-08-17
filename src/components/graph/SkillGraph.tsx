"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dagre from "@dagrejs/dagre";
import { Check, Crosshair, LayoutGrid, MoveRight } from "lucide-react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { SkillStatus } from "@/engine/dashboard";
import type { Evidence } from "@/schemas";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type { SkillLite } from "../path/types";
import styles from "./graph.module.css";

/** Status language: identity is never colour alone — every status has a glyph and a label. */
export const STATUS_STYLE: Record<SkillStatus, { label: string; glyph: string; badge: "acquired" | "progress" | "gap" | "unrelated" }> = {
  acquired: { label: "Acquired", glyph: "✓", badge: "acquired" },
  "in-progress": { label: "In progress", glyph: "▶", badge: "progress" },
  gap: { label: "Gap", glyph: "○", badge: "gap" },
  unrelated: { label: "Not on your path", glyph: "·", badge: "unrelated" },
};

export type GraphLayout = "lr" | "domains" | "focus";
export const LAYOUTS: { id: GraphLayout; label: string; hint: string }[] = [
  { id: "lr", label: "Flow", hint: "The whole taxonomy, prerequisites flowing top to bottom" },
  { id: "domains", label: "Domains", hint: "Skills clustered by domain" },
  { id: "focus", label: "My path", hint: "Only the skills your path touches, and what they build on" },
];

const DOMAIN_LABEL: Record<string, string> = {
  foundations: "Foundations",
  "web-frontend": "Web frontend",
  "web-backend": "Web backend",
  "data-engineering": "Data engineering",
  "machine-learning": "Machine learning",
  "data-analysis": "Data analysis",
  "ai-engineering": "AI engineering",
  security: "Security",
  cloud: "Cloud",
  devops: "DevOps",
};
const domainLabel = (d: string) => DOMAIN_LABEL[d] ?? d.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

type SkillNodeData = {
  label: string;
  status: SkillStatus;
  highlighted: boolean;
  dimmed: boolean;
  level: number;
  horizontal: boolean;
  [key: string]: unknown;
};
type DomainNodeData = { label: string; count: number; width: number; height: number; [key: string]: unknown };

const NODE_W = 156;
const NODE_H = 32;

function SkillNode({ data, selected }: NodeProps<Node<SkillNodeData>>) {
  const style = STATUS_STYLE[data.status];
  return (
    <div
      className={cn(styles.node, styles[`node_${data.status}`], data.highlighted && styles.nodeHighlighted, data.dimmed && styles.nodeDimmed, selected && styles.nodeSelected)}
      style={{ width: NODE_W, height: NODE_H }}
      title={`${data.label} — ${style.label}${data.level ? ` (level ${data.level})` : ""}`}
    >
      <Handle type="target" position={data.horizontal ? Position.Left : Position.Top} className={styles.handle} />
      <span className={styles.glyph} aria-hidden>
        {data.status === "acquired" ? <Check /> : style.glyph}
      </span>
      <span className={styles.nodeLabel}>{data.label}</span>
      {data.level > 0 && <span className={styles.level}>L{data.level}</span>}
      <Handle type="source" position={data.horizontal ? Position.Right : Position.Bottom} className={styles.handle} />
    </div>
  );
}

function DomainNode({ data }: NodeProps<Node<DomainNodeData>>) {
  return (
    <div className={styles.domain} style={{ width: data.width, height: data.height }}>
      <span className={styles.domainLabel}>
        {data.label}
        <span className={styles.domainCount}>{data.count}</span>
      </span>
    </div>
  );
}

const nodeTypes = { skill: SkillNode, domain: DomainNode };

type Positioned = { positions: Map<string, { x: number; y: number }>; domains: (DomainNodeData & { id: string; x: number; y: number })[]; horizontal: boolean };

function dagreLayout(skills: SkillLite[], rankdir: "LR" | "TB"): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir, nodesep: rankdir === "LR" ? 12 : 16, ranksep: rankdir === "LR" ? 70 : 52, marginx: 12, marginy: 12 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const s of skills) g.setNode(s.id, { width: NODE_W, height: NODE_H });
  const ids = new Set(skills.map((s) => s.id));
  for (const s of skills) for (const p of s.prereqs) if (ids.has(p)) g.setEdge(p, s.id);
  dagre.layout(g);
  return new Map(skills.map((s) => [s.id, { x: g.node(s.id).x - NODE_W / 2, y: g.node(s.id).y - NODE_H / 2 }]));
}

/** Fold any dagre rank wider than `maxWidth` into several rows, shifting later ranks down. */
function wrapRanks(positions: Map<string, { x: number; y: number }>, maxWidth: number): Map<string, { x: number; y: number }> {
  const GAP_X = 12;
  const GAP_Y = 12;
  const ranks = new Map<number, string[]>();
  for (const [id, p] of positions) ranks.set(p.y, [...(ranks.get(p.y) ?? []), id]);
  const out = new Map<string, { x: number; y: number }>();
  const cols = Math.max(1, Math.floor(maxWidth / (NODE_W + GAP_X)));
  let shift = 0;
  for (const y of [...ranks.keys()].sort((a, b) => a - b)) {
    const ids = ranks.get(y)!.sort((a, b) => positions.get(a)!.x - positions.get(b)!.x);
    if (ids.length <= cols) {
      const width = ids.length * (NODE_W + GAP_X) - GAP_X;
      ids.forEach((id, i) => out.set(id, { x: i * (NODE_W + GAP_X) - width / 2, y: y + shift }));
      continue;
    }
    const rows = Math.ceil(ids.length / cols);
    const width = cols * (NODE_W + GAP_X) - GAP_X;
    ids.forEach((id, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      out.set(id, { x: c * (NODE_W + GAP_X) - width / 2, y: y + shift + r * (NODE_H + GAP_Y) });
    });
    shift += (rows - 1) * (NODE_H + GAP_Y);
  }
  return out;
}

/** Layout for each option; memoised per (skills, layout, focus set). */
function computeLayout(skills: SkillLite[], layout: GraphLayout, focusIds: Set<string> | null): Positioned {
  // The whole taxonomy ranks ~80 skills at depth 0: lay it out top-to-bottom and wrap the wide ranks.
  if (layout === "lr" || (layout === "focus" && !focusIds)) {
    return { positions: wrapRanks(dagreLayout(skills, "TB"), 1900), domains: [], horizontal: false };
  }
  if (layout === "focus" && focusIds) {
    const subset = skills.filter((s) => focusIds.has(s.id));
    return { positions: dagreLayout(subset, "LR"), domains: [], horizontal: true };
  }
  // domains: lay each domain out on its own, then pack the clusters into rows.
  const byDomain = new Map<string, SkillLite[]>();
  for (const s of skills) byDomain.set(s.domain, [...(byDomain.get(s.domain) ?? []), s]);
  const clusters = [...byDomain.entries()]
    .map(([domain, list]) => {
      const pos = dagreLayout(list, "TB");
      let w = 0;
      let h = 0;
      for (const p of pos.values()) {
        w = Math.max(w, p.x + NODE_W);
        h = Math.max(h, p.y + NODE_H);
      }
      return { domain, list, pos, w: w + 24, h: h + 52 };
    })
    .sort((a, b) => b.list.length - a.list.length);

  // Pack clusters into rows whose total width targets a landscape canvas.
  const PAD = 40;
  const area = clusters.reduce((sum, c) => sum + (c.w + PAD) * (c.h + PAD), 0);
  const MAX_ROW = Math.max(Math.sqrt(area * 1.7), ...clusters.map((c) => c.w));
  const positions = new Map<string, { x: number; y: number }>();
  const domains: Positioned["domains"] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const c of clusters) {
    if (x > 0 && x + c.w > MAX_ROW) {
      x = 0;
      y += rowH + PAD;
      rowH = 0;
    }
    domains.push({ id: `domain:${c.domain}`, label: domainLabel(c.domain), count: c.list.length, width: c.w, height: c.h, x, y });
    for (const s of c.list) {
      const p = c.pos.get(s.id)!;
      positions.set(s.id, { x: x + 12 + p.x, y: y + 40 + p.y });
    }
    x += c.w + PAD;
    rowH = Math.max(rowH, c.h);
  }
  return { positions, domains, horizontal: false };
}

export type GraphHighlight = { catalogId: string; title: string; evidence: Evidence } | null;

type Props = {
  skills: SkillLite[];
  skillStatus: Record<string, SkillStatus>;
  levels: Record<string, number>;
  highlight: GraphHighlight;
  onSelectSkill?: (skillId: string) => void;
  /** Initial layout; the learner can switch. */
  defaultLayout?: GraphLayout;
};

function SkillGraphInner({ skills, skillStatus, levels, highlight, onSelectSkill, layout }: Props & { layout: GraphLayout }) {
  const { fitView } = useReactFlow();

  // Focus = every skill the path touches plus everything it builds on.
  const focusIds = useMemo(() => {
    const byId = new Map(skills.map((s) => [s.id, s]));
    const seed = skills.filter((s) => (skillStatus[s.id] ?? "unrelated") !== "unrelated").map((s) => s.id);
    if (seed.length === 0) return null;
    const out = new Set<string>();
    const stack = [...seed];
    while (stack.length) {
      const id = stack.pop()!;
      if (out.has(id)) continue;
      out.add(id);
      for (const p of byId.get(id)?.prereqs ?? []) stack.push(p);
    }
    return out;
  }, [skills, skillStatus]);

  const laid = useMemo(() => computeLayout(skills, layout, focusIds), [skills, layout, focusIds]);

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
    const visible = skills.filter((s) => laid.positions.has(s.id));
    const ids = new Set(visible.map((s) => s.id));
    const domainNodes: Node<DomainNodeData>[] = laid.domains.map((d) => ({
      id: d.id,
      type: "domain",
      position: { x: d.x, y: d.y },
      data: { label: d.label, count: d.count, width: d.width, height: d.height },
      selectable: false,
      draggable: false,
      focusable: false,
      zIndex: -1,
    }));
    const nodes: Node<SkillNodeData>[] = visible.map((s) => ({
      id: s.id,
      type: "skill",
      position: laid.positions.get(s.id)!,
      data: {
        label: s.name,
        status: skillStatus[s.id] ?? "unrelated",
        highlighted: highlightSet.ids.has(s.id),
        dimmed: dim && !highlightSet.ids.has(s.id),
        level: levels[s.id] ?? 0,
        horizontal: laid.horizontal,
      },
    }));
    const edges: Edge[] = visible.flatMap((s) =>
      s.prereqs
        .filter((p) => ids.has(p))
        .map((p) => {
          const on = highlightSet.edgeKeys.has(`${p}->${s.id}`);
          return {
            id: `${p}->${s.id}`,
            source: p,
            target: s.id,
            animated: on,
            className: cn(styles.edge, on && styles.edgeOn, dim && !on && styles.edgeDim),
            markerEnd: { type: MarkerType.ArrowClosed, color: on ? "#a78bfa" : "rgba(255,255,255,0.28)", width: 14, height: 14 },
          };
        }),
    );
    return { nodes: [...(domainNodes as Node[]), ...(nodes as Node[])], edges };
  }, [skills, laid, skillStatus, highlightSet, levels]);

  const initial = useMemo(() => build(), [build]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  useEffect(() => {
    const next = build();
    setNodes(next.nodes);
    setEdges(next.edges);
    const t = setTimeout(() => {
      if (highlightSet.ids.size > 0) fitView({ nodes: [...highlightSet.ids].map((id) => ({ id })), duration: 600, padding: 0.5 });
      else fitView({ duration: 500, padding: 0.08 });
    }, 50);
    return () => clearTimeout(t);
  }, [build, setNodes, setEdges, highlightSet, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => node.type === "skill" && onSelectSkill?.(node.id)}
      fitView
      minZoom={0.1}
      maxZoom={2}
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
      className={styles.flow}
    >
      <Background variant={BackgroundVariant.Dots} gap={26} size={1.2} color="rgba(255,255,255,0.09)" />
      <Controls showInteractive={false} className={styles.controls} />
    </ReactFlow>
  );
}

const LAYOUT_ICON: Record<GraphLayout, typeof MoveRight> = { lr: MoveRight, domains: LayoutGrid, focus: Crosshair };

/** Skill-graph explorer (§7 rendering 1): gap colouring plus click-to-highlight evidence paths. */
export function SkillGraph({ defaultLayout, ...props }: Props) {
  const { skills, skillStatus } = props;
  const [selected, setSelected] = useState<string | null>(null);
  // Default: the learner's own subgraph once a path exists, the domain map before that; a manual pick sticks.
  const [picked, setPicked] = useState<GraphLayout | null>(defaultLayout ?? null);
  const skill = selected ? skills.find((s) => s.id === selected) : null;
  const status = skill ? (skillStatus[skill.id] ?? "unrelated") : null;
  const counts: Record<SkillStatus, number> = { acquired: 0, "in-progress": 0, gap: 0, unrelated: 0 };
  for (const s of skills) counts[skillStatus[s.id] ?? "unrelated"]++;
  const hasPath = counts.acquired + counts["in-progress"] + counts.gap > 0;
  const layout: GraphLayout = picked ?? (hasPath ? "focus" : "domains");

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <ul className={styles.legend} data-testid="graph-legend" aria-label="Legend">
          {(Object.keys(STATUS_STYLE) as SkillStatus[]).map((k) => (
            <li key={k}>
              <Badge variant={STATUS_STYLE[k].badge} dot>
                {STATUS_STYLE[k].label}
                <span className={styles.legendCount}>{counts[k]}</span>
              </Badge>
            </li>
          ))}
        </ul>
        <Tabs value={layout} onValueChange={(v) => setPicked(v as GraphLayout)}>
          <TabsList variant="pill" aria-label="Layout">
            {LAYOUTS.map((l) => {
              const Icon = LAYOUT_ICON[l.id];
              return (
                <TabsTrigger key={l.id} value={l.id} title={l.hint} disabled={l.id === "focus" && !hasPath} data-testid={`graph-layout-${l.id}`}>
                  <Icon /> {l.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {props.highlight && (
        <p className={styles.trace} data-testid="graph-highlight">
          <span className="label-caps">Tracing</span>
          <strong>{props.highlight.title}</strong>
          <span className={styles.traceChain}>
            {props.highlight.evidence.gapSkillsCovered
              .map((g) => g.graphPath.map((id) => props.skills.find((s) => s.id === id)?.name ?? id).join(" → "))
              .join(" · ")}
          </span>
        </p>
      )}

      <div className={styles.canvas} data-testid="skill-graph">
        <ReactFlowProvider>
          <SkillGraphInner
            {...props}
            layout={layout}
            onSelectSkill={(id) => {
              setSelected(id);
              props.onSelectSkill?.(id);
            }}
          />
        </ReactFlowProvider>

        {skill && status && (
          <div className={styles.detail} data-testid="graph-selected">
            <div className={styles.detailHead}>
              <Badge variant={STATUS_STYLE[status].badge} dot>
                {STATUS_STYLE[status].label}
              </Badge>
              <span className={styles.detailDomain}>{domainLabel(skill.domain)}</span>
            </div>
            <strong className={styles.detailTitle}>{skill.name}</strong>
            <p className={styles.detailMeta}>
              {props.levels[skill.id] ? `Your level ${props.levels[skill.id]} of 3` : "No level recorded"}
              {skill.prereqs.length > 0 && <> · builds on {skill.prereqs.map((p) => props.skills.find((s) => s.id === p)?.name ?? p).join(", ")}</>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
