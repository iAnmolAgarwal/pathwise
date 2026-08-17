import { Orb } from "@/components/ui/orb";
import { Skeleton } from "@/components/ui/skeleton";

/** Shell-shaped placeholder while the learner's state loads: rail · chat · pane. */
export default function LearnLoading() {
  return (
    <div className="grid h-dvh grid-cols-[56px_minmax(0,1fr)] overflow-hidden bg-ink lg:grid-cols-[56px_minmax(360px,5fr)_minmax(0,6fr)]" aria-busy="true" aria-live="polite">
      <div className="flex flex-col items-center gap-3 border-r border-line bg-surface-1 py-4">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="mt-3 size-9 rounded-lg" />
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="mt-auto size-8 rounded-full" />
      </div>
      <div className="flex min-w-0 flex-col border-r border-line">
        <div className="flex h-14 items-center gap-3 border-b border-line px-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="ml-auto h-8 w-32 rounded-pill" />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="mt-2 h-10 w-full rounded-card" />
          <Skeleton className="h-10 w-full rounded-card" />
        </div>
        <div className="border-t border-line p-3">
          <Skeleton className="h-14 w-full rounded-card" />
        </div>
      </div>
      <div className="hidden min-w-0 flex-col bg-surface-1 lg:flex">
        <div className="flex h-14 items-center gap-6 border-b border-line px-5">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="grid flex-1 place-items-center">
          <div className="flex flex-col items-center gap-4">
            <Orb state="breathing" size={64} label="Loading your workspace" />
            <p className="label-caps text-ink-3">Loading your workspace</p>
          </div>
        </div>
      </div>
    </div>
  );
}
