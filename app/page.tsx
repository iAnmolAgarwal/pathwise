import { currentUser } from "@/auth";
import { ArcDeck } from "@/components/landing/ArcDeck";
import { BeamNetwork } from "@/components/landing/BeamNetwork";
import { Showcase, TryIt } from "@/components/landing/BigType";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { MotionWall } from "@/components/landing/MotionWall";
import { QuickChatProvider, type QuickChatVisitor } from "@/components/landing/QuickChat";
import { SkillStream } from "@/components/landing/SkillStream";
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
  return (
    <QuickChatProvider visitor={visitor}>
      <main className="flex flex-1 flex-col">
        <Hero />
        <Showcase id="story" />
        <ArcDeck id="how-it-works" />
        <BeamNetwork id="engine" />
        <SkillStream id="skills" />
        <MotionWall id="different" />
        <TryIt id="try" />
        <Footer />
      </main>
    </QuickChatProvider>
  );
}
