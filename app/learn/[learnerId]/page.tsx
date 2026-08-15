import { notFound } from "next/navigation";
import { getLearner, getLatestPath, getProfile } from "@/db/queries";
import { loadEngineData } from "@/lib/engineData";
import { UuidSchema } from "@/lib/api";
import { PathBuilder, type CatalogLite, type SkillLite } from "@/components/path/PathBuilder";

export const dynamic = "force-dynamic";

export default async function LearnPage({ params }: PageProps<"/learn/[learnerId]">) {
  const { learnerId } = await params;
  if (!UuidSchema.safeParse(learnerId).success) notFound();
  const [learner, profile, latest] = await Promise.all([
    getLearner(learnerId),
    getProfile(learnerId),
    getLatestPath(learnerId),
  ]);
  if (!learner || !profile) notFound();

  const data = loadEngineData();
  const catalog: Record<string, CatalogLite> = Object.fromEntries(
    data.catalog.map((c) => [
      c.id,
      { title: c.title, provider: c.provider, url: c.url, kind: c.kind, durationHours: c.durationHours, difficulty: c.difficulty },
    ]),
  );
  const skills: SkillLite[] = data.skills.map((s) => ({
    id: s.id,
    name: s.name,
    domain: s.domain,
    prereqs: s.prereqs,
  }));
  const goals = data.goals.map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    requiredSkills: g.requiredSkills,
  }));

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">Pathwise — {learner.displayName}</h1>
      <p className="mt-1 text-sm text-neutral-500">Learner id: {learner.id}</p>
      <PathBuilder
        learnerId={learner.id}
        initialProfile={profile}
        initialPath={latest ? { version: latest.version, path: latest.data } : null}
        goals={goals}
        skills={skills}
        catalog={catalog}
      />
    </main>
  );
}
