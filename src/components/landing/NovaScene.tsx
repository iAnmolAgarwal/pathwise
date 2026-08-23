"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
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
/**
 * How long a host waits before it stops calling the scene "loading". A stalled request
 * resolves neither `onLoad` nor `onError`, so only a timer notices it.
 */
export const NOVA_SCENE_TIMEOUT_MS = 8000;

/**
 * @splinetool/react-spline (4.1.0) has no error callback: when `Application.load()`
 * rejects it stores the error and re-throws it from render, so the only way to hear
 * about a failed scene is to catch that throw. This boundary does, tells the host
 * once, and renders nothing — the host owns the fallback.
 */
class SceneErrorBoundary extends Component<{ onError?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function NovaScene({
  className,
  onLoad,
  onError,
}: {
  className?: string;
  onLoad?: (app: Application) => void;
  /** Called once if the scene or the runtime fails to load. */
  onError?: () => void;
}) {
  return (
    <SceneErrorBoundary onError={onError}>
      <Spline scene={NOVA_SCENE_URL} wasmPath={NOVA_WASM_PATH} className={className} onLoad={onLoad} />
    </SceneErrorBoundary>
  );
}
