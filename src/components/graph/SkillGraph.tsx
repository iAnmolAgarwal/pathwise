"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dagre from "@dagrejs/dagre";
import { Check, Crosshair, LayoutGrid, MoveRight, X } from "lucide-react";
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
import { prereqMap, type PrereqMap } from "@/engine/edges";
import type { GraphEdge, GraphEvidence } from "@/lib/graphEvidence";
import type { Evidence } from "@/schemas";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type { SkillLite } from "../path/types";
import { BranchOverlay } from "./BranchOverlay";
import { EdgeCard } from "./EdgeCard";
import { CandidateList } from "./CandidateList";
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

const NODE_W = 188;
const NODE_H = 32;
/** The one arrow colour; matches .edge in graph.module.css. */
const EDGE_MARKER = "rgba(255,255,255,0.30)";

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

/** Layout over the path-driving edges only: mined candidates are evidence, not structure. */
function dagreLayout(skills: SkillLite[], prereqs: PrereqMap, rankdir: "LR" | "TB"): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir, nodesep: rankdir === "LR" ? 12 : 16, ranksep: rankdir === "LR" ? 70 : 52, marginx: 12, marginy: 12 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const s of skills) g.setNode(s.id, { width: NODE_W, height: NODE_H });
  const ids = new Set(skills.map((s) => s.id));
  for (const s of skills) for (const p of prereqs.get(s.id) ?? []) if (ids.has(p)) g.setEdge(p, s.id);
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

/** Layout for each option; memoised per (skills, layout, focus set, canvas width). */
function computeLayout(skills: SkillLite[], prereqs: PrereqMap, layout: GraphLayout, focusIds: Set<string> | null, maxWidth: number): Positioned {
  // Ranks fold to the canvas width rather than a fixed one: anything wider only reads after a
  // pan, and panning slices the node labels at the canvas edge.
  const wrapTo = Math.max(NODE_W + 12, maxWidth - 24);
  // The whole taxonomy ranks ~80 skills at depth 0: lay it out top-to-bottom and wrap the wide ranks.
  if (layout === "lr" || (layout === "focus" && !focusIds)) {
    return { positions: wrapRanks(dagreLayout(skills, prereqs, "TB"), wrapTo), domains: [], horizontal: false };
  }
  if (layout === "focus" && focusIds) {
    const subset = skills.filter((s) => focusIds.has(s.id));
    return { positions: wrapRanks(dagreLayout(subset, prereqs, "TB"), wrapTo), domains: [], horizontal: false };
  }
  // domains: lay each domain out on its own, then pack the clusters into rows.
  const byDomain = new Map<string, SkillLite[]>();
  for (const s of skills) byDomain.set(s.domain, [...(byDomain.get(s.domain) ?? []), s]);
  const clusters = [...byDomain.entries()]
    .map(([domain, list]) => {
      const pos = dagreLayout(list, prereqs, "TB");
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
  /** Tiered edges with provenance (server-built slice of skill_edges.json). */
  evidence: GraphEvidence;
  skillStatus: Record<string, SkillStatus>;
  levels: Record<string, number>;
  highlight: GraphHighlight;
  /** Clears the traced path item (the "Tracing" strip's close button). */
  onClearHighlight?: () => void;
  onSelectSkill?: (skillId: string) => void;
  /** Initial layout; the learner can switch. */
  defaultLayout?: GraphLayout;
  /** Open this arrow's card, details expanded, once the canvas is laid out (the landing badge lands here). */
  initialEdge?: { from: string; to: string } | null;
};

/** Pointer interaction on an edge, reported with viewport coordinates for the popover. */
export type EdgeInteraction = { kind: "enter" | "leave" | "click"; edge: GraphEdge; clientX: number; clientY: number };

type InnerProps = Props & {
  layout: GraphLayout;
  prereqs: PrereqMap;
  selectedSkill: string | null;
  /** Measured width of the canvas element; 0 before the first measurement. */
  canvasWidth: number;
  onEdgeInteraction: (i: EdgeInteraction) => void;
  onPaneClick: () => void;
};

function SkillGraphInner({ skills, evidence, prereqs, skillStatus, levels, highlight, onSelectSkill, layout, selectedSkill, canvasWidth, onEdgeInteraction, onPaneClick }: InnerProps) {
  const { fitView } = useReactFlow();

  // Focus = every skill the path touches plus everything it builds on (over path-driving edges).
  const focusIds = useMemo(() => {
    const seed = skills.filter((s) => (skillStatus[s.id] ?? "unrelated") !== "unrelated").map((s) => s.id);
    if (seed.length === 0) return null;
    const out = new Set<string>();
    const stack = [...seed];
    while (stack.length) {
      const id = stack.pop()!;
      if (out.has(id)) continue;
      out.add(id);
      for (const p of prereqs.get(id) ?? []) stack.push(p);
    }
    return out;
  }, [skills, prereqs, skillStatus]);

  const laid = useMemo(() => computeLayout(skills, prereqs, layout, focusIds, canvasWidth || 1900), [skills, prereqs, layout, focusIds, canvasWidth]);

  const edgeByKey = useMemo(() => new Map(evidence.edges.map((e) => [`${e.from}->${e.to}`, e])), [evidence]);

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
    // Only the path-driving (authored ∪ promoted) arrows are drawn, every one in the same stroke:
    // the evidence behind an arrow is one click away, never a line style. Mined candidates are
    // listed in the selected skill's card, not drawn.
    const shown = evidence.edges.filter((e) => e.drivesPath && ids.has(e.from) && ids.has(e.to));
    const edges: Edge[] = shown.map((e) => {
      const key = `${e.from}->${e.to}`;
      const on = highlightSet.edgeKeys.has(key);
      const selectedEnd = selectedSkill !== null && (e.from === selectedSkill || e.to === selectedSkill);
      return {
        id: key,
        source: e.from,
        target: e.to,
        animated: on,
        interactionWidth: 30,
        className: cn(styles.edge, on && styles.edgeOn, dim && !on && styles.edgeDim, selectedEnd && styles.edgeNear),
        markerEnd: { type: MarkerType.ArrowClosed, color: on ? "#a78bfa" : EDGE_MARKER, width: 14, height: 14 },
        data: { key },
      };
    });
    return { nodes: [...(domainNodes as Node[]), ...(nodes as Node[])], edges };
  }, [skills, evidence, laid, skillStatus, highlightSet, levels, selectedSkill]);

  const interact = useCallback(
    (kind: EdgeInteraction["kind"]) => (event: React.MouseEvent, edge: Edge) => {
      const ge = edgeByKey.get(edge.id);
      if (ge) onEdgeInteraction({ kind, edge: ge, clientX: event.clientX, clientY: event.clientY });
    },
    [edgeByKey, onEdgeInteraction],
  );

  const initial = useMemo(() => build(), [build]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  useEffect(() => {
    const next = build();
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [build, setNodes, setEdges]);

  // Refit only when the layout or the traced item changes — never on a selection, hover or zoom.
  useEffect(() => {
    const t = setTimeout(() => {
      if (highlightSet.ids.size > 0) fitView({ nodes: [...highlightSet.ids].map((id) => ({ id })), duration: 600, padding: 0.5 });
      else fitView({ duration: 500, padding: 0.08, minZoom: 0.7 });
    }, 50);
    return () => clearTimeout(t);
  }, [laid, highlightSet, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => node.type === "skill" && onSelectSkill?.(node.id)}
      onEdgeMouseEnter={interact("enter")}
      onEdgeMouseLeave={interact("leave")}
      onEdgeClick={interact("click")}
      onPaneClick={onPaneClick}
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

type PopoverState = { edge: GraphEdge; x: number; y: number; canvasWidth: number; canvasHeight: number; pinned: boolean; details: boolean };

/**
 * Skill-graph explorer (§7 renderings 1 and 3): gap colouring, click-to-highlight evidence
 * paths, one arrow style for every prerequisite, and a click card per arrow that opens to the
 * full provenance.
 */
export function SkillGraph({ defaultLayout, initialEdge, onClearHighlight, ...props }: Props) {
  const { skills, skillStatus, evidence } = props;
  const [selected, setSelected] = useState<string | null>(null);
  // Default: the learner's own subgraph once a path exists, the domain map before that; a manual pick sticks.
  const [picked, setPicked] = useState<GraphLayout | null>(defaultLayout ?? null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number | null>(null);
  // Memoised: a fresh map each render would relayout and refit the view on every hover or zoom click.
  const prereqs = useMemo(() => prereqMap(evidence.edges), [evidence]);
  // Measured so the layout can fold its ranks to the canvas instead of a fixed width.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setCanvasWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const skill = selected ? skills.find((s) => s.id === selected) : null;
  const status = skill ? (skillStatus[skill.id] ?? "unrelated") : null;
  const counts: Record<SkillStatus, number> = { acquired: 0, "in-progress": 0, gap: 0, unrelated: 0 };
  for (const s of skills) counts[skillStatus[s.id] ?? "unrelated"]++;
  const hasPath = counts.acquired + counts["in-progress"] + counts.gap > 0;
  const layout: GraphLayout = picked ?? (hasPath ? "focus" : "domains");
  const nameOf = (id: string) => skills.find((s) => s.id === id)?.name ?? id;

  const candidatesOfSelected = useMemo(
    () => (selected ? evidence.edges.filter((e) => !e.drivesPath && (e.from === selected || e.to === selected)) : []),
    [evidence, selected],
  );

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  }, []);
  const onEdgeInteraction = useCallback(
    (i: EdgeInteraction) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      const place = rect
        ? { x: i.clientX - rect.left, y: i.clientY - rect.top, canvasWidth: rect.width, canvasHeight: rect.height }
        : { x: i.clientX, y: i.clientY, canvasWidth: 0, canvasHeight: 0 };
      if (i.kind === "click") {
        clearLeaveTimer();
        setPopover((cur) => (cur?.pinned && cur.edge === i.edge ? null : { edge: i.edge, ...place, pinned: true, details: false }));
        return;
      }
      if (i.kind === "enter") {
        clearLeaveTimer();
        setPopover((cur) => (cur?.pinned ? cur : { edge: i.edge, ...place, pinned: false, details: false }));
        return;
      }
      // leave: give the pointer a moment to reach the popover itself.
      clearLeaveTimer();
      leaveTimer.current = window.setTimeout(() => setPopover((cur) => (cur?.pinned ? cur : null)), 160);
    },
    [clearLeaveTimer],
  );
  const closePopover = useCallback(() => {
    clearLeaveTimer();
    setPopover(null);
  }, [clearLeaveTimer]);
  // Deep link: pin the requested arrow's card with its details open, centred on the canvas.
  useEffect(() => {
    if (!initialEdge) return;
    const edge = evidence.edges.find((e) => e.drivesPath && e.from === initialEdge.from && e.to === initialEdge.to);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!edge || !rect) return;
    setPopover({ edge, x: rect.width * 0.5, y: rect.height * 0.3, canvasWidth: rect.width, canvasHeight: rect.height, pinned: true, details: true });
  }, [initialEdge, evidence]);
  // Escape closes whatever is open: the pinned card first, then the selected skill.
  useEffect(() => {
    if (!popover?.pinned && !selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (popover?.pinned) closePopover();
      else setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popover?.pinned, selected, closePopover]);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
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
        <ul className={styles.legend} data-testid="graph-legend" aria-label="Legend">
          {(Object.keys(STATUS_STYLE) as SkillStatus[]).map((k) => (
            <li key={k} className={cn(styles.legendItem, styles[`legend_${STATUS_STYLE[k].badge}`])}>
              <span className={styles.legendDot} aria-hidden />
              {STATUS_STYLE[k].label}
              <span className={styles.legendCount}>{counts[k]}</span>
            </li>
          ))}
        </ul>
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
          {onClearHighlight && (
            <button type="button" className={styles.traceClear} onClick={onClearHighlight} aria-label="Stop tracing">
              <X />
            </button>
          )}
        </p>
      )}

      <div className={styles.canvas} data-testid="skill-graph" ref={canvasRef}>

        <ReactFlowProvider>
          <SkillGraphInner
            {...props}
            layout={layout}
            prereqs={prereqs}
            selectedSkill={selected}
            canvasWidth={canvasWidth}
            onEdgeInteraction={onEdgeInteraction}
            onPaneClick={() => {
              closePopover();
              setSelected(null);
            }}
            onSelectSkill={(id) => {
              setSelected(id);
              closePopover();
              props.onSelectSkill?.(id);
            }}
          />
        </ReactFlowProvider>

        {popover && (
          <EdgeCard
            key={`${popover.edge.from}->${popover.edge.to}:${popover.pinned ? "pinned" : "hover"}`}
            defaultOpen={popover.details}
            edge={popover.edge}
            evidence={evidence}
            nameOf={nameOf}
            x={popover.x}
            y={popover.y}
            pinned={popover.pinned}
            canvasWidth={popover.canvasWidth}
            canvasHeight={popover.canvasHeight}
            onMouseEnter={clearLeaveTimer}
            onMouseLeave={() => {
              if (!popover.pinned) closePopover();
            }}
            onClose={closePopover}
          />
        )}

        {skill && status && (
          <div className={styles.detail} data-testid="graph-selected" role="dialog" aria-label={`${skill.name}: details`}>
            <div className={styles.detailHead}>
              <Badge variant={STATUS_STYLE[status].badge} dot>
                {STATUS_STYLE[status].label}
              </Badge>
              <span className={styles.detailDomain}>{domainLabel(skill.domain)}</span>
              <button type="button" className={styles.detailClose} onClick={() => setSelected(null)} aria-label="Close" data-testid="graph-selected-close">
                <X />
              </button>
            </div>
            <strong className={styles.detailTitle}>{skill.name}</strong>
            <p className={styles.detailMeta}>
              {props.levels[skill.id] ? `Your level ${props.levels[skill.id]} of 3` : "No level recorded"}
              {(prereqs.get(skill.id) ?? []).length > 0 && <> · builds on {(prereqs.get(skill.id) ?? []).map(nameOf).join(", ")}</>}
            </p>
            <CandidateList candidates={candidatesOfSelected} skillId={skill.id} evidence={evidence} nameOf={nameOf} />
            <BranchOverlay
              skillId={skill.id}
              evidence={evidence}
              nameOf={nameOf}
              onSelectSkill={(id) => {
                setSelected(id);
                closePopover();
                props.onSelectSkill?.(id);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
