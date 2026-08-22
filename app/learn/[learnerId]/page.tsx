import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { getOwnedLearner, getLatestPath, getProfile, listChatMessages, listLearners } from "@/db/queries";
import { loadEngineData } from "@/lib/engineData";
import { loadGraphEvidence } from "@/lib/graphEvidence";
import { signInUrl } from "@/lib/authz";
import { carryGraphQuery, parseGraphQuery } from "@/lib/graphLink";
import { UuidSchema } from "@/lib/api";
import { LearnWorkspace } from "@/components/LearnWorkspace";
import type { CatalogLite, SkillLite } from "@/components/path/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/learn/[learnerId]">): Promise<Metadata> {
  const { learnerId } = await params;
  const user = await currentUser();
  const learner = user && UuidSchema.safeParse(learnerId).success ? await getOwnedLearner(user.id, learnerId) : null;
  return {
    title: learner ? `${learner.displayName}'s workspace` : "Workspace",
    description: "Chat with Nova, follow your learning path, trace skills on the graph, and track progress.",
    robots: { index: false },
  };
}

/**
 * The workspace for one learner (§9.1). Signed out → sign-in and back here; a learner
 * that is missing or belongs to someone else → 404, indistinguishable on purpose (§19).
 */
export default async function LearnPage({ params, searchParams }: PageProps<"/learn/[learnerId]">) {
  const { learnerId } = await params;
  const graphLink = parseGraphQuery(await searchParams);
  const user = await currentUser();
  if (!user) redirect(signInUrl(`/learn/${learnerId}${carryGraphQuery(await searchParams)}`));
  if (!UuidSchema.safeParse(learnerId).success) notFound();
  const [learner, profile, latest, messages, siblings] = await Promise.all([
    getOwnedLearner(user.id, learnerId),
    getProfile(learnerId),
    getLatestPath(learnerId),
    listChatMessages(learnerId),
    listLearners(user.id),
  ]);
  if (!learner || !profile) notFound();

  const data = loadEngineData();
  const catalog: Record<string, CatalogLite> = Object.fromEntries(
    data.catalog.map((c) => [
      c.id,
      { title: c.title, provider: c.provider, url: c.url, kind: c.kind, durationHours: c.durationHours, difficulty: c.difficulty },
    ]),
  );
  const skills: SkillLite[] = data.skills.map((s) => ({ id: s.id, name: s.name, domain: s.domain }));
  const graphEvidence = loadGraphEvidence();
  const goals = data.goals.map((g) => ({ id: g.id, title: g.title, description: g.description, requiredSkills: g.requiredSkills }));

  return (
    <LearnWorkspace
      learnerId={learner.id}
      displayName={learner.displayName}
      user={user}
      learners={siblings.map((l) => ({ id: l.id, displayName: l.displayName }))}
      initialProfile={profile}
      initialPath={latest ? { version: latest.version, path: latest.data } : null}
      initialMessages={messages.map((m) => ({ id: m.id, role: m.role, text: m.content.text, toolCalls: m.content.toolCalls, degraded: m.content.degraded, card: m.content.card }))}
      goals={goals}
      skills={skills}
      graphEvidence={graphEvidence}
      catalog={catalog}
      initialGraphLink={graphLink}
    />
  );
}
