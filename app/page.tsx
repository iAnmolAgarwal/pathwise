import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-5xl font-semibold tracking-tight">Pathwise</h1>
      <p className="max-w-md text-lg text-neutral-500">
        Tell us where you want to go. Get a learning path that adapts to you.
      </p>
      <Link href="/learn" className="rounded bg-black px-4 py-2 text-white">
        Get started
      </Link>
    </main>
  );
}
