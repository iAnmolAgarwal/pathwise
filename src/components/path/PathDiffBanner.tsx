"use client";

import type { PathDiff } from "@/schemas";
import type { CatalogLite } from "./PathBuilder";

type Props = {
  diff: PathDiff;
  version: number;
  catalog: Record<string, CatalogLite>;
  onDismiss: () => void;
};

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const list = (titles: string[]) =>
  titles.length <= 1 ? titles.join("") : `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;

/** One sentence a learner can read: "Swapped X for Y because you found Z too hard." */
export function diffHeadline(diff: PathDiff, title: (id: string) => string): string {
  const because = `because ${lowerFirst(diff.cause.humanReadable)}`;
  const added = diff.added.map((d) => title(d.catalogId));
  const removed = diff.removed.map((d) => title(d.catalogId));
  if (added.length === 1 && removed.length === 1) return `Swapped ${removed[0]} for ${added[0]} ${because}.`;
  const parts: string[] = [];
  if (added.length) parts.push(`added ${list(added)}`);
  if (removed.length) parts.push(`removed ${list(removed)}`);
  if (!parts.length && diff.reordered) return `Reordered your path ${because}.`;
  if (!parts.length) return `Nothing on the path needed to change — ${lowerFirst(diff.cause.humanReadable)}, so your skill levels were updated.`;
  const sentence = parts.join(" and ");
  return `${sentence[0].toUpperCase()}${sentence.slice(1)}${diff.reordered ? ", and reordered the rest," : ""} ${because}.`;
}

/** The path diff is a first-class UI object (§5.5): shown on top of the path, never buried. */
export function PathDiffBanner({ diff, version, catalog, onDismiss }: Props) {
  const title = (id: string) => catalog[id]?.title ?? id;
  return (
    <section
      className="rounded border-2 border-amber-400 bg-amber-50 p-4 text-sm"
      role="status"
      aria-live="polite"
      data-testid="path-diff"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Path updated · version {version}</p>
          <p className="mt-1 text-base font-medium">{diffHeadline(diff, title)}</p>
        </div>
        <button type="button" onClick={onDismiss} className="rounded border px-2 py-0.5 text-xs" aria-label="Dismiss path update">
          ×
        </button>
      </div>
      {(diff.added.length > 0 || diff.removed.length > 0) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ChangeList heading="Added" tone="text-green-800" items={diff.added} title={title} sign="+" />
          <ChangeList heading="Removed" tone="text-red-800" items={diff.removed} title={title} sign="−" />
        </div>
      )}
      {diff.reordered && <p className="mt-2 text-xs text-neutral-600">Some remaining items were reordered to respect prerequisites.</p>}
    </section>
  );
}

function ChangeList({ heading, tone, items, title, sign }: { heading: string; tone: string; items: PathDiff["added"]; title: (id: string) => string; sign: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`text-xs font-semibold ${tone}`}>{heading}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {items.map((d) => (
          <li key={d.catalogId} className="rounded border bg-white px-2 py-1">
            <span className={`mr-1 font-mono ${tone}`}>{sign}</span>
            <span className="font-medium">{title(d.catalogId)}</span>
            <span className="text-neutral-600"> — {d.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
