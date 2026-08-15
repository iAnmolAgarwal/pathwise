"use client";

import dynamic from "next/dynamic";
import type { Application } from "@splinetool/runtime";

/**
 * Nova's Spline scene, loaded lazily so the page is interactive before the
 * runtime (~1 MB) and the scene (~1.3 MB) arrive.
 */
const Spline = dynamic(() => import("@splinetool/react-spline"), { ssr: false });

export const NOVA_SCENE_URL = "https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode";

export function NovaScene({
  className,
  onLoad,
}: {
  className?: string;
  onLoad?: (app: Application) => void;
}) {
  return <Spline scene={NOVA_SCENE_URL} className={className} onLoad={onLoad} />;
}
