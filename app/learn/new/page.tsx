import type { Metadata } from "next";
import Link from "next/link";
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
      <p className="mt-4 max-w-[32ch] text-lead text-ink-2">
        The goal, the skills and every version of the path live under this name.
      </p>
      <div className="mt-8 w-full">
        <NewLearnerForm />
      </div>
      <Link href="/learn" className="mt-6 text-[13px] text-ink-3 transition-colors hover:text-ink-1">
        Back to your learners
      </Link>
    </CenteredPage>
  );
}
