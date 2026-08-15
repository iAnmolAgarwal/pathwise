import { ArcDeck } from "@/components/landing/ArcDeck";
import { BeamNetwork } from "@/components/landing/BeamNetwork";
import { Showcase, TryIt } from "@/components/landing/BigType";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { MotionWall } from "@/components/landing/MotionWall";
import { SkillStream } from "@/components/landing/SkillStream";

export default function Home() {
  return (
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
  );
}
