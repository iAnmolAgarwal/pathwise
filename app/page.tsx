import { Hero } from "@/components/landing/Hero";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <div id="story" />
    </main>
  );
}
