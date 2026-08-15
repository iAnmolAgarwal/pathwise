import { ArcDeck } from "@/components/landing/ArcDeck";
import { Showcase, TryIt } from "@/components/landing/BigType";
import { Hero } from "@/components/landing/Hero";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <Showcase id="story" />
      <ArcDeck id="how-it-works" />
      <TryIt id="try" />
    </main>
  );
}
