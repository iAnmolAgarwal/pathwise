// Dev-only design reference. Remove before the M6 feature freeze.

const SWATCHES: Array<[string, string]> = [
  ["ink", "bg-ink"],
  ["surface-1", "bg-surface-1"],
  ["surface-2", "bg-surface-2"],
  ["surface-3", "bg-surface-3"],
  ["brand", "bg-brand"],
  ["violet", "bg-violet"],
  ["coral", "bg-coral"],
  ["ink-1", "bg-ink-1"],
  ["ink-2", "bg-ink-2"],
  ["ink-3", "bg-ink-3"],
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
    <main className="relative min-h-screen bg-atmosphere px-16 py-14">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.12]" />
      <div className="relative mx-auto max-w-6xl">
        <p className="label-caps text-ink-3">Design reference · step 0 tokens</p>
        <h1 className="mt-4 text-display max-w-4xl">
          Learn what <em className="text-brand">matters</em>, in the right order.
        </h1>
        <p className="mt-6 max-w-xl text-lead text-ink-2">
          Newsreader for display, Instrument Sans for body copy at 15px, JetBrains Mono for
          identifiers. Ink base, ivory text, one lime accent, violet as the second voice.
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
            <div className="font-display text-display-sm">Display small — phase &amp; card titles</div>
            <p className="text-body max-w-2xl text-ink-1">
              Body 15px / 1.6 — Nova maps your gap across 159 skills, then picks the fewest
              courses that close it. Feedback reshapes the path; you see exactly what changed
              and why.
            </p>
            <p className="text-body max-w-2xl text-ink-2">
              Secondary text (ink-2, 62%) for descriptions and metadata.
            </p>
            <p className="font-mono text-[12px] text-ink-2">
              mono · used: get_dashboard_summary · score 0.82 · sql→3
            </p>
            <p className="label-caps text-ink-2">Label caps · 10px · 800 · 0.14em</p>
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
            <div className="glass rounded-pill px-4 py-2 label-caps text-ink-1">pill · glass</div>
            <div className="rounded-chip border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-ink-2">
              chip · 4px
            </div>
            <div className="w-56 rounded-card border border-line bg-surface-1 p-4 shadow-float">
              <div className="font-display text-display-sm !text-xl">Card · 6px</div>
              <div className="mt-1 text-[12px] text-ink-3">shadow-float</div>
            </div>
            <div className="glass w-56 rounded-float p-4 shadow-lift">
              <div className="label-caps text-ink-1">Floating panel · 16px</div>
              <div className="mt-1 text-[12px] text-ink-3">glass + shadow-lift</div>
            </div>
            <button className="rounded-pill bg-brand px-5 py-3 label-caps text-brand-foreground shadow-brand">
              Brand CTA →
            </button>
          </div>
        </Section>

        <Section title="Motion">
          <div className="flex items-center gap-8 text-[12px] text-ink-3">
            <span className="flex items-center gap-3">
              <i className="size-[7px] rounded-full bg-brand animate-glow-dot" aria-hidden />
              glow-dot 2.4s
            </span>
            <span className="flex items-center gap-3">
              <i className="block h-px w-14 origin-left bg-ink-1 animate-pulse-line" aria-hidden />
              pulse-line 1.8s
            </span>
            <span className="font-mono">
              ease-settle .2,.84,.25,1 · ease-enter .22,1,.36,1 · 220 / 650 / 780 / 800ms
            </span>
          </div>
        </Section>
      </div>
    </main>
  );
}
