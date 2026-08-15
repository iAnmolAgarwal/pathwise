import { notFound } from "next/navigation";
import { getLearner, getLatestPath, getProfile, listChatMessages } from "@/db/queries";
import { loadEngineData } from "@/lib/engineData";
import { UuidSchema } from "@/lib/api";
import { LearnWorkspace } from "@/components/LearnWorkspace";
import type { CatalogLite, SkillLite } from "@/components/path/PathBuilder";

export const dynamic = "force-dynamic";

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
  const skills: SkillLite[] = data.skills.map((s) => ({ id: s.id, name: s.name, domain: s.domain, prereqs: s.prereqs }));
  const goals = data.goals.map((g) => ({ id: g.id, title: g.title, description: g.description, requiredSkills: g.requiredSkills }));

  return (
    <LearnWorkspace
      learnerId={learner.id}
      displayName={learner.displayName}
      initialProfile={profile}
      initialPath={latest ? { version: latest.version, path: latest.data } : null}
      initialMessages={messages.map((m) => ({ id: m.id, role: m.role, text: m.content.text, toolCalls: m.content.toolCalls, degraded: m.content.degraded }))}
      goals={goals}
      skills={skills}
      catalog={catalog}
    />
  );
}
