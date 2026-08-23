Nova's 3D scene, served from this deploy rather than Spline's CDN.

- `scene.splinecode` — the scene as exported from the Spline editor. Replace it with a new export to update Nova.
- `process.wasm` — the modelling module the runtime loads for this scene, copied from
  `@splinetool/modelling-wasm@1.12.98/build`. It must match the installed `@splinetool/runtime`
  version; when that package is upgraded, copy the matching wasm here again.
