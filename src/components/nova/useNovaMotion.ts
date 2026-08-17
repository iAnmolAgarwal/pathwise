"use client";

import { useEffect, useRef } from "react";
import type { Application, SPEObject } from "@splinetool/runtime";

import type { NovaState } from "@/schemas";

/**
 * Code-driven motion for the Spline scene (§9.2, plan A): the scene has no authored
 * triggers, so each Nova state becomes a target pose plus a small loop, applied as
 * offsets on top of the objects' rest transforms and eased between states.
 * Reduced motion: poses snap, loops are off.
 */

type V3 = { x: number; y: number; z: number };
type Rig = { head?: SPEObject; body?: SPEObject; handL?: SPEObject; handR?: SPEObject; bot?: SPEObject };
type Base = Record<string, { position: V3; rotation: V3 }>;

const NAMES = { head: "Head", body: "Body", handL: "Hand LEFT", handR: "Hand", bot: "Bot" } as const;

function v3(v: V3): V3 {
  return { x: v.x, y: v.y, z: v.z };
}
// The runtime exposes transforms through accessors, so copy component by component.
function snapshot(o?: SPEObject) {
  return o ? { position: v3(o.position), rotation: v3(o.rotation) } : undefined;
}
const finite = (n: number) => Number.isFinite(n);

/** Target pose per state (radians / scene units) and the loop amplitude/speed. */
function pose(state: NovaState, t: number, reduce: boolean) {
  const loop = reduce ? 0 : 1;
  switch (state) {
    case "listening":
      // Lean toward the conversation (it sits to the robot's right on screen = its left).
      return { headRx: -0.05, headRy: 0.32, headRz: 0.1, bodyRy: 0.08, bodyY: 0, handL: 0, handR: 0, headBob: 0 };
    case "thinking":
      return {
        headRx: -0.16 + Math.sin(t * 1.6) * 0.03 * loop,
        headRy: Math.sin(t * 0.9) * 0.22 * loop,
        headRz: 0.06,
        bodyRy: 0,
        bodyY: 0,
        handL: 0.15,
        handR: 0,
        headBob: 0,
      };
    case "speaking":
      return { headRx: Math.sin(t * 5.2) * 0.05 * loop, headRy: 0.12, headRz: 0, bodyRy: 0.03, bodyY: Math.sin(t * 2.6) * 1.5 * loop, handL: 0.05, handR: 0.05, headBob: 0 };
    case "celebrating":
      return {
        headRx: -0.12,
        headRy: Math.sin(t * 6) * 0.12 * loop,
        headRz: 0,
        bodyRy: 0,
        bodyY: Math.abs(Math.sin(t * 5)) * 10 * loop,
        handL: 1.1,
        handR: -1.1,
        headBob: 0,
      };
    case "resting":
      return { headRx: 0.28, headRy: 0, headRz: 0.04, bodyRy: 0, bodyY: Math.sin(t * 0.7) * 1 * loop, handL: 0, handR: 0, headBob: 0 };
    case "idle":
    default:
      return { headRx: Math.sin(t * 0.8) * 0.02 * loop, headRy: Math.sin(t * 0.5) * 0.06 * loop, headRz: 0, bodyRy: 0, bodyY: Math.sin(t * 1.3) * 2 * loop, handL: 0, handR: 0, headBob: 0 };
  }
}

export function useNovaMotion(app: Application | null, state: NovaState, transitions: number, reduce: boolean, running: boolean) {
  const rig = useRef<Rig>({});
  const base = useRef<Base>({});
  const current = useRef(pose("idle", 0, true));
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!app) return;
    const r: Rig = {};
    for (const [key, name] of Object.entries(NAMES) as [keyof Rig, string][]) r[key] = app.findObjectByName(name);
    rig.current = r;
    const b: Base = {};
    for (const [key, o] of Object.entries(r)) {
      const s = snapshot(o);
      if (s) b[key] = s;
    }
    base.current = b;
  }, [app]);

  useEffect(() => {
    if (!app || !running) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const target = pose(stateRef.current, t, reduce);
      const cur = current.current;
      const k = reduce ? 1 : 0.08;
      for (const key of Object.keys(target) as (keyof typeof target)[]) cur[key] += (target[key] - cur[key]) * k;

      const { head, body, handL, handR } = rig.current;
      const b = base.current;
      if (head && b.head && finite(b.head.rotation.x)) {
        head.rotation.x = b.head.rotation.x + cur.headRx;
        head.rotation.y = b.head.rotation.y + cur.headRy;
        head.rotation.z = b.head.rotation.z + cur.headRz;
      }
      if (body && b.body && finite(b.body.position.y)) {
        body.rotation.y = b.body.rotation.y + cur.bodyRy;
        body.position.y = b.body.position.y + cur.bodyY;
      }
      if (handL && b.handL && finite(b.handL.rotation.z)) handL.rotation.z = b.handL.rotation.z + cur.handL;
      if (handR && b.handR && finite(b.handR.rotation.z)) handR.rotation.z = b.handR.rotation.z + cur.handR;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `transitions` restarts the clock so a repeated state replays its entrance.
  }, [app, running, reduce, transitions]);
}
