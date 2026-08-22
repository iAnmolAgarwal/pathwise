import Link from "next/link";
import type { ReactNode } from "react";

/** The narrow, centred frame shared by sign-in, the picker and the new-learner page. */
export function CenteredPage({ children, width = 420 }: { children: ReactNode; width?: number }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink px-6 py-16">
      <div className="bg-vignette pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex w-full flex-col items-center text-center" style={{ maxWidth: width }}>
        <Link href="/" className="label-caps text-ink-3 transition-colors hover:text-ink-1">
          Pathwise
        </Link>
        {children}
      </div>
    </main>
  );
}
