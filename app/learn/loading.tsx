import { CenteredPage } from "@/components/learn/CenteredPage";
import { Orb } from "@/components/ui/orb";

/** The picker and the new-learner form read from the database first; this holds the frame meanwhile. */
export default function LearnIndexLoading() {
  return (
    <CenteredPage>
      <div className="mt-10 flex flex-col items-center gap-4" aria-busy="true" aria-live="polite">
        <Orb state="breathing" size={64} label="Loading your learners" />
        <p className="label-caps text-ink-3">Loading your learners</p>
      </div>
    </CenteredPage>
  );
}
