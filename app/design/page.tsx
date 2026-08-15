// Dev-only design reference. Remove before the M6 feature freeze.
import { ArrowRight, ArrowUpRight, Check, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, Spinner } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SWATCHES: Array<[string, string]> = [
  ["ink", "bg-ink"],
  ["surface-1", "bg-surface-1"],
  ["surface-2", "bg-surface-2"],
  ["surface-3", "bg-surface-3"],
  ["ink-1 / brand", "bg-ink-1"],
  ["ink-2", "bg-ink-2"],
  ["ink-3", "bg-ink-3"],
  ["violet", "bg-violet"],
  ["violet-2", "bg-violet-2"],
  ["coral", "bg-coral"],
];

const AURORA: Array<[string, string]> = [
  ["aurora-ink", "bg-aurora-ink"],
  ["aurora-text", "bg-aurora-text"],
  ["aurora-sky", "bg-aurora-sky"],
  ["indigo", "bg-[#483bff]"],
  ["magenta", "bg-[#d5399d]"],
  ["red", "bg-[#da372d]"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[180px_1fr] gap-10 border-t border-line py-10">
      <h2 className="label-caps font-sans text-ink-3 pt-1">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-28 shrink-0 font-mono text-[11px] text-ink-3">{label}</span>
      {children}
    </div>
  );
}

export default function DesignPage() {
  return (
    <TooltipProvider>
      <main className="relative min-h-screen bg-ink px-16 py-14">
        <div className="pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-cursor-light" />
        <div className="relative mx-auto max-w-6xl">
          <p className="label-caps text-ink-3">Design reference · tokens &amp; primitives</p>
          <h1 className="mt-4 text-display max-w-4xl">
            Learn what <span className="text-gradient-violet">matters</span>, in the right order.
          </h1>
          <p className="mt-6 max-w-xl text-lead text-ink-2">
            Inter throughout — 590 and tight for the hero, 420 for section headings, 15px body — with
            JetBrains Mono for identifiers. Black ink, white text and actions, violet only as light.
          </p>

          {/* ---------------------------------------------------------------- step 1 */}
          <Section title="Buttons">
            <div className="space-y-5">
              <Row label="primary">
                <Button>
                  Describe your goal <ArrowRight data-icon="inline-end" />
                </Button>
                <Button size="lg">
                  Explore experience <ArrowRight data-icon="inline-end" />
                </Button>
                <Button size="sm">Continue</Button>
                <Button size="icon" aria-label="Send">
                  <ArrowUpRight />
                </Button>
                <Button disabled>Disabled</Button>
                <Button aria-busy>
                  <Spinner /> Thinking
                </Button>
              </Row>
              <Row label="secondary">
                <Button variant="secondary">View details</Button>
                <Button variant="secondary" size="sm">
                  <Sparkles /> Suggest a goal
                </Button>
                <Button variant="secondary" size="icon-sm" aria-label="Close">
                  <X />
                </Button>
              </Row>
              <Row label="ghost / outline">
                <Button variant="ghost">Skip for now</Button>
                <Button variant="outline">Regenerate path</Button>
                <Button variant="destructive" size="sm">
                  Not for me
                </Button>
              </Row>
              <Row label="link">
                <Button variant="link" size="sm">
                  Why this? <ArrowUpRight data-icon="inline-end" />
                </Button>
                <Button variant="link" size="sm" className="text-ink-2">
                  Open the app
                </Button>
              </Row>
              <Row label="chips">
                <Button variant="chip" size="chip" aria-pressed>
                  <Check /> Done
                </Button>
                <Button variant="chip" size="chip">
                  Too hard
                </Button>
                <Button variant="chip" size="chip">
                  Too easy
                </Button>
                <Button variant="chip" size="chip" data-tone="gap" aria-pressed>
                  <X /> Not for me
                </Button>
                <Button variant="chip" size="chip">
                  Relaxed
                </Button>
                <Button variant="chip" size="chip" aria-pressed>
                  Standard
                </Button>
                <Button variant="chip" size="chip">
                  Intense
                </Button>
              </Row>
            </div>
          </Section>

          <Section title="Badges">
            <div className="space-y-5">
              <Row label="kind">
                <Badge>course</Badge>
                <Badge>project</Badge>
                <Badge>assessment</Badge>
                <Badge variant="mono">22h</Badge>
                <Badge variant="mono">score 0.82</Badge>
                <Badge variant="mono">sql → 3</Badge>
              </Row>
              <Row label="status">
                <Badge variant="acquired" dot>
                  acquired
                </Badge>
                <Badge variant="progress" dot>
                  in progress
                </Badge>
                <Badge variant="gap" dot>
                  gap
                </Badge>
                <Badge variant="unrelated" dot>
                  unrelated
                </Badge>
                <Badge variant="violet" dot>
                  milestone
                </Badge>
              </Row>
              <Row label="eyebrow">
                <Badge variant="eyebrow" dot>
                  Nova · your learning mentor
                </Badge>
                <Badge variant="eyebrow" dot>
                  Live environment
                </Badge>
              </Row>
            </div>
          </Section>

          <Section title="Tabs">
            <div className="space-y-8">
              <Tabs defaultValue="path">
                <TabsList>
                  <TabsTrigger value="path">Path</TabsTrigger>
                  <TabsTrigger value="graph">Skill graph</TabsTrigger>
                  <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                </TabsList>
                <TabsContent value="path" className="text-[13px] text-ink-3">
                  line variant · underline draws in from the right on hover, stays under the active tab
                </TabsContent>
              </Tabs>
              <Tabs defaultValue="lr">
                <TabsList variant="pill">
                  <TabsTrigger value="tb">Top-down</TabsTrigger>
                  <TabsTrigger value="lr">Left-right</TabsTrigger>
                  <TabsTrigger value="focus">Focus</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </Section>

          <Section title="Inputs">
            <div className="grid max-w-3xl grid-cols-2 gap-4">
              <Input placeholder="What do you want to become?" />
              <Input placeholder="Hours per week" defaultValue="6" aria-invalid />
              <div className="col-span-2 relative">
                <Textarea placeholder="Describe your goal — e.g. “I want to move from data analyst to ML engineer in a year, 6 hours a week”" />
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  <span className="font-mono text-[11px] text-ink-4">⌘↵</span>
                  <Button size="icon-sm" aria-label="Send">
                    <ArrowUpRight />
                  </Button>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Cards">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Designing Data-Intensive Applications</CardTitle>
                  <CardDescription>Book · 22h · covers data-modeling → 3, distributed-systems → 2</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge>course</Badge>
                  <Badge variant="mono">score 0.82</Badge>
                  <Badge variant="progress" dot>
                    in progress
                  </Badge>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button variant="chip" size="chip">
                    <Check /> Done
                  </Button>
                  <Button variant="chip" size="chip">
                    Too hard
                  </Button>
                  <Button variant="link" size="sm" className="ml-auto text-[13px]">
                    Why this?
                  </Button>
                </CardFooter>
              </Card>
              <Card variant="glass" size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[15px]">
                    <i className="size-[7px] rounded-full bg-violet shadow-glow-dot" aria-hidden />
                    Nova is thinking
                  </CardTitle>
                  <CardDescription>Reading your profile · comparing 246 resources</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
              <Card variant="quiet" size="sm">
                <CardHeader>
                  <CardTitle className="text-[15px]">Weekly capacity</CardTitle>
                  <CardDescription>quiet card · no fill</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-[40px] font-[540] leading-none tracking-[-0.04em]">6h</div>
                  <Separator className="my-4" />
                  <div className="text-[13px] text-ink-3">3 of 4 weeks on streak</div>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section title="Tooltip">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="sm">
                  Hover me
                </Button>
              </TooltipTrigger>
              <TooltipContent>Explains the pick — evidence, not vibes.</TooltipContent>
            </Tooltip>
          </Section>

          {/* ---------------------------------------------------------------- step 0 */}
          <Section title="Palette">
            <div className="grid grid-cols-5 gap-3">
              {SWATCHES.map(([name, cls]) => (
                <div key={name}>
                  <div className={`h-16 rounded-card border border-line ${cls}`} />
                  <div className="mt-2 font-mono text-[11px] text-ink-3">{name}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Type">
            <div className="space-y-6">
              <div className="font-display text-display-sm max-w-3xl">
                Ready to learn what matters, <span className="text-ink-2">skip what you already know?</span>
              </div>
              <p className="text-body max-w-2xl text-ink-1">
                Body 15px / 1.6 — Nova maps your gap across 159 skills, then picks the fewest courses
                that close it. Feedback reshapes the path; you see exactly what changed and why.
              </p>
              <p className="text-body max-w-2xl text-ink-2">Secondary text (ink-2, 60%) for descriptions and metadata.</p>
              <p className="font-mono text-[12px] text-ink-2">mono · used: get_dashboard_summary · score 0.82 · sql→3</p>
              <p className="label-caps text-ink-2">Label caps · 10px · 650 · 0.17em</p>
            </div>
          </Section>

          <Section title="Diff banner">
            <div className="flex items-center gap-4 rounded-card border border-diff-line bg-diff-soft px-4 py-3 shadow-[0_0_0_4px_var(--color-diff-halo)]">
              <span className="label-caps font-mono text-diff">Path updated</span>
              <span className="text-body">
                Swapped <u>Kafka: The Definitive Guide</u> for <u>Streaming Systems</u> because you marked
                the last one too hard.
              </span>
            </div>
          </Section>

          <Section title="Motion">
            <div className="flex items-center gap-8 text-[12px] text-ink-3">
              <span className="flex items-center gap-3">
                <i className="size-[7px] rounded-full bg-violet animate-glow-dot" aria-hidden />
                glow-dot 2.4s
              </span>
              <span className="flex items-center gap-3">
                <span className="text-aurora-sky animate-spark inline-block" aria-hidden>
                  ✦
                </span>
                spark 2.6s
              </span>
              <span className="flex items-center gap-3">
                <Spinner className="text-ink-1" /> loader 0.8s
              </span>
              <span className="font-mono">ease-enter .22,1,.36,1 · 220 / 450 / 800 / 1000ms</span>
            </div>
          </Section>

          <Section title="Footer · aurora">
            <div className="grid grid-cols-6 gap-3">
              {AURORA.map(([name, cls]) => (
                <div key={name}>
                  <div className={`h-12 rounded-card border border-line ${cls}`} />
                  <div className="mt-2 font-mono text-[11px] text-ink-3">{name}</div>
                </div>
              ))}
            </div>
            <div className="relative mt-5 h-64 overflow-hidden rounded-card border border-line bg-aurora-ink isolate">
              <div className="absolute inset-0 -z-20 bg-aurora" />
              <div className="absolute inset-0 -z-10 bg-aurora-2 opacity-70" />
              <div className="absolute inset-0 -z-10 bg-vignette" />
              <div className="absolute inset-0 z-10 bg-noise opacity-[0.035]" />
              <div className="absolute left-8 top-8 flex items-center gap-2 text-[12px] font-medium text-aurora-sky-2">
                <span className="text-aurora-sky animate-spark">✦</span> Start with a goal
              </div>
              <div className="absolute bottom-6 left-8 font-display text-[112px] leading-[0.72] tracking-[-0.087em] font-[540] text-aurora-text">
                pathwise
              </div>
            </div>
          </Section>
        </div>
      </main>
    </TooltipProvider>
  );
}
