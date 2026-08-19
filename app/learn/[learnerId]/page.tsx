import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLearner, getLatestPath, getProfile, listChatMessages } from "@/db/queries";
import { loadEngineData } from "@/lib/engineData";
import { loadGraphEvidence } from "@/lib/graphEvidence";
import { UuidSchema } from "@/lib/api";
import { LearnWorkspace } from "@/components/LearnWorkspace";
import type { CatalogLite, SkillLite } from "@/components/path/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/learn/[learnerId]">): Promise<Metadata> {
  const { learnerId } = await params;
  if (!UuidSchema.safeParse(learnerId).success) return { title: "Workspace" };
  const learner = await getLearner(learnerId);
  return {
    title: learner ? `${learner.displayName}'s workspace` : "Workspace",
    description: "Chat with Nova, follow your learning path, trace skills on the graph, and track progress.",
    robots: { index: false },
  };
}

export default async function LearnPage({ params }: PageProps<"/learn/[learnerId]">) {
  const { learnerId } = await params;
  if (!UuidSchema.safeParse(learnerId).success) notFound();
  const [learner, profile, latest, messages] = await Promise.all([
    getLearner(learnerId),
    getProfile(learnerId),
    getLatestPath(learnerId),
    listChatMessages(learnerId),
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
      initialProfile={profile}
      initialPath={latest ? { version: latest.version, path: latest.data } : null}
      initialMessages={messages.map((m) => ({ id: m.id, role: m.role, text: m.content.text, toolCalls: m.content.toolCalls, degraded: m.content.degraded, card: m.content.card }))}
      goals={goals}
      skills={skills}
      graphEvidence={graphEvidence}
      catalog={catalog}
    />
  );
}
