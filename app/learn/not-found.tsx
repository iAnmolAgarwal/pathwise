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
      <p className="mt-4 max-w-[38ch] text-lead text-ink-2">
        This link does not belong to your account. Links made before Pathwise had sign-in no longer open — pick one
        of your learners or start a new one.
      </p>
      <Button size="lg" asChild className="mt-8">
        <Link href="/learn">
          Your learners <ArrowRight data-icon="inline-end" />
        </Link>
      </Button>
    </CenteredPage>
  );
}
