import { ArrowRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { CenteredPage } from "@/components/learn/CenteredPage";
import { NewLearnerForm } from "@/components/learn/NewLearnerForm";
import { listLearners } from "@/db/queries";
import { initials } from "@/lib/initials";
import { signInUrl } from "@/lib/authz";
import { carryGraphQuery } from "@/lib/graphLink";

export const metadata: Metadata = { title: "Your learners" };
export const dynamic = "force-dynamic";

/**
 * The learner picker (§19). Signed out → sign in and come back. Exactly one learner →
 * straight into it. None → the new-learner form. Otherwise the list, newest first.
 */
export default async function LearnersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // A graph deep link from the landing (trust badge) rides along through every hop.
  const carry = carryGraphQuery(await searchParams);
  const user = await currentUser();
  if (!user) redirect(signInUrl(`/learn${carry}`));
  const learners = await listLearners(user.id);
  if (learners.length === 1) redirect(`/learn/${learners[0].id}${carry}`);

  if (learners.length === 0) {
    return (
      <CenteredPage>
        <h1 className="mt-6 text-[clamp(2.2rem,4vw,3rem)] font-[420] leading-[1.06] tracking-[-0.047em]">
          Start with a <span className="text-gradient-violet">name</span>.
        </h1>
        <p className="mt-4 max-w-[36ch] text-lead text-ink-2">
          Nova keeps everything under it — the goal, the skills, every version of the path. Signed in as {user.email ?? user.name}.
        </p>
        <div className="mt-8 w-full">
          <NewLearnerForm carry={carry} />
        </div>
      </CenteredPage>
    );
  }

  return (
    <CenteredPage width={480}>
      <h1 className="mt-6 text-[clamp(2.2rem,4vw,3rem)] font-[420] leading-[1.06] tracking-[-0.047em]">
        Pick a <span className="text-gradient-violet">learner</span>.
      </h1>
      <p className="mt-4 max-w-[36ch] text-lead text-ink-2">Each one keeps its own goal, skills and path.</p>
      <ul className="mt-8 flex w-full flex-col gap-2 text-left" data-testid="learner-list">
        {learners.map((l) => (
          <li key={l.id}>
            <Link
              href={`/learn/${l.id}${carry}`}
              className="group flex items-center gap-3 rounded-panel border border-line bg-surface-2 px-4 py-3 transition-colors hover:border-line-strong hover:bg-glass-strong"
            >
              <span
                aria-hidden
                className="grid h-8 w-8 flex-none place-items-center rounded-full border border-line bg-glass-strong font-mono text-[11px] font-medium tracking-[0.04em] text-ink-1"
              >
                {initials(l.displayName)}
              </span>
              <span className="flex-1 truncate text-[15px] text-ink-1">{l.displayName}</span>
              <ArrowRight className="h-4 w-4 text-ink-3 transition-transform duration-(--dur-fast) group-hover:translate-x-[3px] group-hover:text-ink-1" />
            </Link>
          </li>
        ))}
        <li className="mt-2">
          <Link
            href="/learn/new"
            className="flex items-center gap-3 rounded-panel border border-dashed border-line px-4 py-3 text-ink-2 transition-colors hover:border-line-strong hover:text-ink-1"
          >
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full border border-line">
              <Plus className="h-4 w-4" />
            </span>
            New learner
          </Link>
        </li>
      </ul>
      <p className="mt-6 text-[13px] text-ink-3">Signed in as {user.email ?? user.name}.</p>
    </CenteredPage>
  );
}
