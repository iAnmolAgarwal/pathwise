"use client";

import { useSyncExternalStore } from "react";

/** Never changes, so nothing to subscribe to — the snapshot only has to flip once. */
const noSubscribe = () => () => {};

/**
 * False through the server render and the hydration render, true immediately after.
 *
 * Anything the server cannot know — a media query, a browser preference, `navigator` — has to
 * render its pre-hydration state first and only take effect once this is true, or the server
 * markup and the hydration render disagree and React throws the whole tree away.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}
