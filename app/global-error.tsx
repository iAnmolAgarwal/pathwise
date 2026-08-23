"use client";

/**
 * The last line: an error in the root layout itself. No design tokens are guaranteed to
 * be loaded here, so the styles are inline and the page is plain.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#09090b", color: "#f5f5f7", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.6 }}>Pathwise</p>
          <h1 style={{ fontSize: 32, fontWeight: 420, margin: "16px 0 8px" }}>Something broke.</h1>
          <p style={{ opacity: 0.75, lineHeight: 1.5 }}>The app failed to load. Your profile and path are stored on the server and are not affected.</p>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.5 }}>ref {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 24, padding: "10px 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.2)", background: "#a78bfa", color: "#09090b", fontWeight: 500, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
