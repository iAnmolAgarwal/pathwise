import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CenteredPage } from "@/components/learn/CenteredPage";
import { Button } from "@/components/ui/button";

/**
 * A learner URL that is unknown, malformed, or not yours (§19 — the three look the same on
 * purpose). Workspace links made before sign-in existed also land here.
 */
export default function LearnerNotFound() {
  return (
    <CenteredPage>
      <h1 className="mt-6 text-[clamp(2.2rem,4vw,3rem)] font-[420] leading-[1.06] tracking-[-0.047em]">
        No learner <span className="text-gradient-violet">here</span>.
      </h1>
      <p className="mt-4 max-w-[36ch] text-lead text-ink-2">
        This link is not one of yours, or it was made before Pathwise had sign-in.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" asChild>
          <Link href="/learn">
            Your learners <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
        <Button size="lg" variant="ghost" asChild>
          <Link href="/learn/new">New learner</Link>
        </Button>
      </div>
    </CenteredPage>
  );
}
