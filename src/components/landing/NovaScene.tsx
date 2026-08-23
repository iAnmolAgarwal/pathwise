"use client";

import dynamic from "next/dynamic";
import type { Application } from "@splinetool/runtime";

/**
 * Nova's Spline scene, loaded lazily so the page is interactive before the
 * runtime (~1 MB) and the scene (~1.3 MB) arrive.
 */
const Spline = dynamic(() => import("@splinetool/react-spline"), { ssr: false });

/**
 * The scene is served from this deploy (public/nova), not from Spline's CDN, so the hero
 * does not depend on a third-party host being up. Re-export from the Spline editor to
 * refresh it; the file is the editor's "scene.splinecode" download, unchanged.
 */
export const NOVA_SCENE_URL = "/nova/scene.splinecode";
/** Where the runtime finds its wasm modules (public/nova); unset, it would fetch them from unpkg. */
export const NOVA_WASM_PATH = "/nova";

export function NovaScene({
  className,
  onLoad,
}: {
  className?: string;
  onLoad?: (app: Application) => void;
}) {
  return <Spline scene={NOVA_SCENE_URL} wasmPath={NOVA_WASM_PATH} className={className} onLoad={onLoad} />;
}
