import { currentUser } from "@/auth";
import { ArcDeck } from "@/components/landing/ArcDeck";
import { BeamNetwork } from "@/components/landing/BeamNetwork";
import { Showcase, TryIt } from "@/components/landing/BigType";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { MotionWall } from "@/components/landing/MotionWall";
import { QuickChatProvider, type QuickChatVisitor } from "@/components/landing/QuickChat";
import { SkillStream } from "@/components/landing/SkillStream";
import { HowItWorks, KeepFresh, TrustBadge } from "@/components/landing/Trust";
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
        <Hero numbers={trust} />
        <HowItWorks id="story" />
        <TrustBadge id="trust" numbers={trust} />
        <Showcase id="showcase" />
        <ArcDeck id="how-it-works" />
        <BeamNetwork id="engine" />
        <SkillStream id="skills" />
        <MotionWall id="different" />
        <KeepFresh id="fresh" numbers={trust} />
        <TryIt id="try" />
        <Footer />
      </main>
    </QuickChatProvider>
  );
}
