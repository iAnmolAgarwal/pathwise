import { ImageResponse } from "next/og";

export const alt = "Pathwise — Nova maps your skill gap and builds a learning path from real courses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social card: the wordmark on the ink base with the violet light, matching the landing. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(60% 70% at 80% 20%, rgba(135,101,255,0.28), rgba(5,5,6,0) 70%), #050506",
          color: "#f5f5f7",
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 22, letterSpacing: 6, textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: "#a78bfa", boxShadow: "0 0 18px #a78bfa" }} />
          Nova · your AI learning mentor
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 118, fontWeight: 600, letterSpacing: -8, lineHeight: 0.9 }}>
            <span>A learning path</span>
            <span style={{ color: "#a78bfa" }}>you can verify.</span>
          </div>
          <div style={{ fontSize: 30, color: "rgba(255,255,255,0.62)", maxWidth: 900, lineHeight: 1.35 }}>
            A hand-built skill map checked against millions of real learners. Every arrow shows its count. The AI explains; it never decides.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "rgba(255,255,255,0.5)" }}>
          <span style={{ fontWeight: 600, color: "#f5f5f7", letterSpacing: -1 }}>Pathwise</span>
          <span>trypathwise.vercel.app</span>
        </div>
      </div>
    ),
    size,
  );
}
