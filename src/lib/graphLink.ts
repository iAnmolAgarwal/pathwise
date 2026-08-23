/**
 * The landing trust badge opens the skill graph on one arrow with its card already open. The
 * state travels as a query string (`?tab=graph&edge=from>to`) so it survives the sign-in
 * redirect, the learner picker and the new-learner form on its way to the workspace.
 */

export type GraphLinkState = { tab: "graph"; edge: { from: string; to: string } | null };

const ID = /^[a-z0-9-]+$/;

export function graphQuery(edge: { from: string; to: string } | null): string {
  const params = new URLSearchParams({ tab: "graph" });
  if (edge) params.set("edge", `${edge.from}>${edge.to}`);
  return `?${params.toString()}`;
}

/** Parse the query; anything malformed yields null rather than a half-open state. */
export function parseGraphQuery(params: { tab?: string | string[]; edge?: string | string[] } | URLSearchParams | null | undefined): GraphLinkState | null {
  if (!params) return null;
  const get = (k: string) => (params instanceof URLSearchParams ? params.get(k) : Array.isArray(params[k as "tab"]) ? null : ((params[k as "tab"] as string | undefined) ?? null));
  if (get("tab") !== "graph") return null;
  const edge = get("edge");
  if (!edge) return { tab: "graph", edge: null };
  const [from, to] = edge.split(">");
  if (!from || !to || !ID.test(from) || !ID.test(to)) return { tab: "graph", edge: null };
  return { tab: "graph", edge: { from, to } };
}

/** The query string to carry forward, or "" when there is nothing graph-related in it. */
export function carryGraphQuery(params: { tab?: string | string[]; edge?: string | string[] } | URLSearchParams | null | undefined): string {
  const state = parseGraphQuery(params);
  return state ? graphQuery(state.edge) : "";
}

const probe: number = "not a number";
void probe;
