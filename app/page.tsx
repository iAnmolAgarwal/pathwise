import { currentUser } from "@/auth";
import { ArcDeck } from "@/components/landing/ArcDeck";
import { BeamNetwork } from "@/components/landing/BeamNetwork";
import { TryIt } from "@/components/landing/BigType";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { MotionWall } from "@/components/landing/MotionWall";
import { ProofStrip } from "@/components/landing/ProofStrip";
import { QuickChatProvider, type QuickChatVisitor } from "@/components/landing/QuickChat";
import { SkillStream } from "@/components/landing/SkillStream";
import { loadTrustNumbers } from "@/lib/trust";
import { listLearners } from "@/db/queries";

export const dynamic = "force-dynamic";

async function visitorState(): Promise<QuickChatVisitor> {
  const user = await currentUser();
  if (!user) return { signedIn: false };
  const [latest] = await listLearners(user.id);
  return { signedIn: true, learner: latest ? { id: latest.id, displayName: latest.displayName } : null };
}

/** The landing stays public; only the quick chat needs to know who is here (§19). */
export default async function Home() {
  const visitor = await visitorState();
  const trust = loadTrustNumbers();
  return (
    <QuickChatProvider visitor={visitor}>
      <main className="flex flex-1 flex-col">
        <Hero numbers={trust} storyHref="#how-it-works" />
        <SkillStream id="skills" />
        <ArcDeck id="how-it-works" />
        <ProofStrip id="proof" numbers={trust} />
        <BeamNetwork id="engine" />
        <MotionWall id="different" />
        <TryIt id="try" />
        <Footer />
      </main>
    </QuickChatProvider>
  );
}
