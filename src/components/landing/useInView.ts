"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True while the element intersects the viewport (plus a margin). Used to pause
 * continuous animations in sections the visitor is not looking at.
 */
export function useInView(ref: RefObject<Element | null>, rootMargin = "20% 0px"): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);
  return inView;
}
