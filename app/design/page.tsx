// Dev-only design reference. Remove before the M6 feature freeze.

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

const STATUSES = [
  ["acquired", "text-status-acquired border-status-acquired-line bg-status-acquired-soft"],
  ["in progress", "text-status-progress border-status-progress-line bg-status-progress-soft"],
  ["gap", "text-status-gap border-status-gap-line bg-status-gap-soft"],
  ["unrelated", "text-status-unrelated border-status-unrelated-line bg-status-unrelated-soft"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[180px_1fr] gap-10 border-t border-line py-10">
      <h2 className="label-caps font-sans text-ink-3 pt-1">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function DesignPage() {
  return (
    <main className="relative min-h-screen bg-ink px-16 py-14">
      <div className="pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-cursor-light" />
      <div className="relative mx-auto max-w-6xl">
        <p className="label-caps text-ink-3">Design reference · step 0 tokens</p>
        <h1 className="mt-4 text-display max-w-4xl">
          Learn what <span className="text-gradient-violet">matters</span>, in the right order.
        </h1>
        <p className="mt-6 max-w-xl text-lead text-ink-2">
          Inter throughout — 590 and tight for the hero, 420 for section headings, 15px body — with
          JetBrains Mono for identifiers. Black ink, white text and actions, violet only as light.
        </p>

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
            <div className="font-display text-display-sm max-w-3xl">Ready to learn what matters, <span className="text-ink-2">skip what you already know?</span></div>
            <p className="text-body max-w-2xl text-ink-1">
              Body 15px / 1.6 — Nova maps your gap across 159 skills, then picks the fewest
              courses that close it. Feedback reshapes the path; you see exactly what changed
              and why.
            </p>
            <p className="text-body max-w-2xl text-ink-2">
              Secondary text (ink-2, 60%) for descriptions and metadata.
            </p>
            <p className="font-mono text-[12px] text-ink-2">
              mono · used: get_dashboard_summary · score 0.82 · sql→3
            </p>
            <p className="label-caps text-ink-2">Label caps · 10px · 650 · 0.17em</p>
          </div>
        </Section>

        <Section title="Status">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(([name, cls]) => (
              <span
                key={name}
                className={`label-caps inline-flex items-center gap-2 rounded-pill border px-3 py-2 ${cls}`}
              >
                <i className="size-[7px] rounded-full bg-current" aria-hidden />
                {name}
              </span>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-4 rounded-card border border-diff-line bg-diff-soft px-4 py-3 shadow-[0_0_0_4px_var(--color-diff-halo)]">
            <span className="label-caps font-mono text-diff">Path updated</span>
            <span className="text-body">
              Swapped <u>Kafka: The Definitive Guide</u> for <u>Streaming Systems</u> because
              you marked the last one too hard.
            </span>
          </div>
        </Section>

        <Section title="Shape">
          <div className="flex flex-wrap items-end gap-4">
            <span className="glass inline-flex items-center gap-2 rounded-pill px-3 py-2 label-caps text-ink-2">
              <i className="size-[6px] rounded-full bg-violet animate-glow-dot" aria-hidden />
              eyebrow · glass
            </span>
            <div className="rounded-chip border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-ink-2">
              chip · 6px
            </div>
            <div className="w-56 rounded-card border border-line bg-surface-1 p-4 shadow-float">
              <div className="font-display text-xl font-[540] tracking-[-0.03em]">Card · 12px</div>
              <div className="mt-1 text-[12px] text-ink-3">shadow-float</div>
            </div>
            <div className="glass w-56 rounded-float p-4 shadow-float">
              <div className="label-caps text-ink-1">Floating panel · 16px</div>
              <div className="mt-1 text-[12px] text-ink-3">glass · blur 14</div>
            </div>
            <button className="inline-flex h-12 items-center gap-3 rounded-pill bg-brand px-5 text-[14px] font-[650] text-brand-foreground shadow-brand">
              Describe your goal →
            </button>
            <button className="glass inline-flex h-12 items-center rounded-pill px-5 text-[14px] font-[550] text-ink-2">
              See a sample path
            </button>
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
              <i className="block size-4 rounded-full border-2 border-line border-t-ink-1 animate-spin-loader" aria-hidden />
              loader 0.8s
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
  );
}
