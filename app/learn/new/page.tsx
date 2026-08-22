import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { CenteredPage } from "@/components/learn/CenteredPage";
import { NewLearnerForm } from "@/components/learn/NewLearnerForm";
import { signInUrl } from "@/lib/authz";

export const metadata: Metadata = { title: "New learner" };
export const dynamic = "force-dynamic";

export default async function NewLearnerPage() {
  const user = await currentUser();
  if (!user) redirect(signInUrl("/learn/new"));
  return (
    <CenteredPage>
      <h1 className="mt-6 text-[clamp(2.2rem,4vw,3rem)] font-[420] leading-[1.06] tracking-[-0.047em]">
        Start with a <span className="text-gradient-violet">name</span>.
      </h1>
      <p className="mt-4 max-w-[36ch] text-lead text-ink-2">
        Nova keeps everything under it — the goal, the skills, every version of the path. You can have as many learners as you like.
      </p>
      <div className="mt-8 w-full">
        <NewLearnerForm />
      </div>
    </CenteredPage>
  );
}
