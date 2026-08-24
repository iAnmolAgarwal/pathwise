# Demo video — production script

Target runtime **3:30** (hard range 3:00–5:00). Recorded against production,
<https://trypathwise.vercel.app>, at 1440 × 900.

Audience: a mixed panel — some judges write code, some do not. The learner story runs first
and unbroken; the machinery comes after it, once the panel already cares about the learner.

**Rules this script holds itself to**

- Every number in the voiceover and in an on-screen caption is quoted from a file committed to
  this repository, and carries a `source:` note on the shot so it can be re-checked at record
  time. Nothing is rounded past what the source says.
- Every click path below was walked against the code. If a screen does not do something, the
  script does not claim it.
- Anything that could not be settled from the code is marked **[VERIFY AT RECORDING]**.

Word counts are given per shot. Voiceover is written to be read aloud (or fed to TTS) at about
140 words per minute; the whole script is 449 words over 210 seconds, ≈ 128 wpm, which leaves
room to breathe and to let two or three shots play silent.

---

## 1. Shot-by-shot

### Act 1 — the learner story (0:00 – 2:07)

| Time | Screen + click path | On-screen action | Voiceover |
|---|---|---|---|
| **0:00–0:16** (16 s) | `https://trypathwise.vercel.app/` — landing hero, no clicks | Page loads. Nova's 3D scene settles in the right half. Hold on the eyebrow **"Nova · your AI learning mentor"**, the headline **"A learning path you can verify."** and the lead line ("… frontend, data, cloud, ML, security, **15 roles** in all …"). Slow cursor drift so the cursor light follows. | "This is Pathwise. It answers one question: what should I learn next, in what order, and why. A path you can check, step by step, instead of a pile of courses." *(31 w)* |
| **0:16–0:28** (12 s) | Scroll down past the course stream and the six-step deck to the proof strip (anchor `#proof`) | The four cells count up as they enter view. Hover **Confirmed** so its colour field rises. Hold on the row: **Skills 159** · **Checkable 188 of 193** · **Confirmed 74 of 188** · **Disputed 6 of 188**, under the heading "Why trust the order we give you?" | "We tested every 'learn this before that' link in the map against real learners: 188 of 193 were checkable, 74 held, and six disagreed." *(25 w)* |
| **0:28–0:41** (13 s) | Scroll to `#try` → click **Open Nova** → `/learn` redirects to `/sign-in?callbackUrl=/learn` → click **Continue with Google** → learner picker → click **Sam** | Sign-in screen ("Sign in to meet Nova.") holds for ~1 s. **Cut the Google consent screen in the edit** — it is a third-party page. Land on "Pick a learner." with Alex / Priya / Sam, click **Sam**. Sam opens on the **Nova** tab with the empty-chat greeting. Type into the composer: `I want to become a data analyst.` and press Enter. | "You sign in with Google, name a learner, and just talk. Sam wants to become a data analyst and says so in his own words." *(26 w)* |
| **0:41–0:53** (12 s) | Sam's workspace, chat column | The tool checklist ticks through **"Updating your profile"** then **"Preparing your check-in"**, and the intake card renders inside Nova's message: heading "What do you already know for **Data Analyst**?", skill chips grouped by domain with a three-bar level meter, an **Hours a week** stepper, **Pace** and **Budget** segmented pills. Tap two or three chips up to *Comfortable*, set hours to **6**, then click **Build my path**. | "Nova doesn't guess. It shows a check-in card: the skills the role needs, one tap to set your level, your hours a week. Then: build my path." *(27 w)* |
| **0:53–1:06** (13 s) | Pane switches itself to the **Path** tab | The checklist ticks **"Generating your path"**; the pane flips to Path and the items stagger in. Hold on the summary row (phases · items · hours · done), then scroll one phase: the numbered phase header, its **Milestone** line, and two item cards with provider, hours, difficulty pips and skill chips. **Trim the model's thinking time in the edit and caption the cut.** | "Out comes a path, not a list: phases, each with a milestone, real courses with real links, and the hours they take. The model wrote none of it." *(27 w)* |
| **1:06–1:19** (13 s) | On any open item card, click **Why this?** | The explain panel opens under the card. Left: **"Nova says"** — the orb spins on "Reading the evidence…", then the narration streams in. Right: **"The evidence"** — *Closes gap in*, *Comes after*, and the score bars **Coverage · Level fit · Preference fit · Quality · Similarity · Learners' next step · Total**. Hold with both halves in frame. | "Ask why this. Nova's explanation sits beside the evidence it was given: the gap it closes, what it comes after, and the six scores that ranked it." *(27 w)* |
| **1:19–1:30** (11 s) | On the same card, click **Show in graph** | Pane switches to **Skill Graph**. The **Tracing** strip appears with the item title and the skill chain (`A → B → C`). The graph refits onto the traced skills; the highlighted nodes brighten, the rest dim, and the arrows on the traced path animate. | "Show in graph, and the same reasoning lights up on the map: you know this, so this unlocks that, which the role needs." *(23 w)* |
| **1:30–1:44** (14 s) | Rail avatar (bottom of the icon rail) → **Learner** → **Priya** | Priya's workspace opens on the **Path** tab and the **path diff banner** animates in and scrolls itself into view: kicker **"Path updated · v‹n› · ‹n› changes"**, then one sentence, then the **Added** / **Removed** columns with a reason per row. Hold on the sentence and the two columns. | "Push back and the plan changes. Priya said one JavaScript course was too hard. The path rebuilt itself, and the banner says what came in, what went out, and why, in one sentence." *(33 w)* |
| **1:44–1:56** (12 s) | Rail avatar → **Alex** → Path tab → click **Done** on the first open item → **immediately** click the **Nova** tab | The Done chip shows its working orb, the path updates, then the Nova tab shows Nova in her celebrating pose with the bubble: *"That's a milestone, Alex. Nicely done — the path just moved to make room for what's next."* The celebration lasts **2.2 s** — see the note under the table. | "Alex is six weeks in. Mark an item done and Nova notices. Small thing, but it's the difference between a document and a mentor." *(24 w)* |
| **1:56–2:07** (11 s) | Click the **Dashboard** tab | Full-width dashboard. Pan slowly across: **Next best action** (kind, hours, phase, title, why), **Progress toward your goal** with its big percent, the **Streak** tile with the flame and the 14-day spark, the **Activity** year heatmap, and **Skills by domain** — the radar with the dashed *Goal* ring and the filled *You* shape. | "The long view: progress toward the goal, a radar of the role against you, a streak, and the next best thing to do." *(23 w)* |

**Note on the celebration shot (1:44).** Nova's celebrating state lives only on the **Nova**
tab, and completing an item forces the pane to the **Path** tab, so the 2.2-second celebration
plays off-screen unless the Nova tab is clicked immediately. Rehearse it; expect two or three
takes. Fallback if it will not land: stay on the Nova tab and let Nova's greeting bubble carry
the beat instead, and drop the voiceover's second sentence. **[VERIFY AT RECORDING]**

---

### Act 2 — under the hood (2:07 – 2:52, 45 s)

| Time | Screen + click path | On-screen action | Voiceover |
|---|---|---|---|
| **2:07–2:19** (12 s) | New tab: `https://trypathwise.vercel.app/#engine` | The "Under the hood" section: **"The engine decides. Nova only explains."** The beams animate from *Profile*, *Skill graph* and *Catalog* into the central *Engine* node, out to *Path*, *Feedback*, *Dashboard*, and down from the engine to *Nova*. Hold until the status line reads **"Same inputs, same path, every time."** | "Under the hood there's no magic: a hand-built map of 159 skills and 193 prerequisite links. Arithmetic picks the courses; the assistant only narrates what the arithmetic decided." *(28 w)* |
| **2:19–2:27** (8 s) | Scroll to `#evidence` | Heading: **"We checked the map against two million real learners."** The wide plate shows one real arrow — **"Python before Python for Data Analysis"**, verdict **"Verified by 2 of 2 sources"**, count line **"54,067 learners, 95 % in this order · Stack Overflow"**, and the paper block listing *support / reverse / confidence / n* for both sources. The two source plates read **2,137,848 users** (Stack Overflow) and **72,774 learners** (Coursera reviews), each with its caveat. | "We checked that map against two million real learners: Stack Overflow and Coursera. Here's one link." *(16 w)* |
| **2:27–2:42** (15 s) | Click **Open this link in the graph** → learner picker → **Alex** | The deep link (`/learn?tab=graph&edge=python>python-data-analysis`) survives the picker; Alex's workspace opens on the **Skill Graph** tab, zoomed onto the two skills, with the arrow card **already pinned and its details expanded**. Hover the arrow first so the summary card previews, then let the pinned card hold: the tier swatch and status line, then **Stack Overflow** (*took Python first* **51,421**, *took Python for Data Analysis first* **2,646**, *in this order* **95 %**, *n* **54,067**) and its tags row, then **Coursera reviews** (**491 / 77 / 86 % / n 568**) with its five course pairs — each block closing on its caveat. | "Open it in the graph and every number is there. Python before Python for Data Analysis: 54,067 Stack Overflow users, 95 percent in that order. Coursera agrees. The limit is right there: asking isn't finishing." *(35 w)* |
| **2:42–2:52** (10 s) | Click the **Python** node on the canvas | The arrow card closes; the skill detail card opens: **Acquired** badge, domain *Foundations*, "Your level 3 of 3", then **"What learners did next"** — Stack Overflow, *422,784 Stack Overflow users learned Python*, and the top three steps: **Python for Data Analysis 7 % · n 27,497**, **JavaScript 6 % · n 27,108**, **HTML 4 % · n 18,192**. Hover one step so its tooltip spells out the population. | "Select a skill and you get what learners did next: the count, the share, the source. Never a rating, never a feeling." *(22 w)* |

---

### Act 3 — what we got wrong, and keeping it honest (2:52 – 3:30)

| Time | Screen + click path | On-screen action | Voiceover |
|---|---|---|---|
| **2:52–3:03** (11 s) | New tab: the repository → `pipeline/evidence/agreement_report.md` → scroll to **## Contradictions** | The rendered table: six authored edges, the contradicting source, and the resolution text for each — *CSS → Web Accessibility*, *Programming Basics → JavaScript*, *Security Fundamentals → Identity & Access Management*, *Security Fundamentals → Network Security*, *SQL → Advanced SQL*, *Statistics Fundamentals → R Programming*. Let one full resolution sentence be readable. | "We also published where the learners disagree with us. Six links contradicted by the data. A person read each one and wrote the decision down." *(25 w)* |
| **3:03–3:21** (18 s) | Same repo → **Actions** → **link-check** → **Run workflow** → **Run workflow** → the run appears and goes yellow | The run starts live on camera. Cut to the README's **Keeping it fresh** section and hold on the opening line: *"Kept fresh by machines, kept true by people…"* and the two bullets (**link-check**, weekly; **drift-check**, nightly). | "Catalogs rot. Two scheduled jobs watch this one: one checks every course link is still alive, one watches for paths drifting. Here's one running now, on demand. Kept fresh by machines, kept true by people." *(35 w)* |
| **3:21–3:30** (9 s) | Back to the landing hero | Hold on the headline, then fade. | "A path you can verify. Pathwise. Try it at trypathwise dot vercel dot app. Everything you saw is in the repo." *(21 w)* |

**Runtime math.** Act 1 = 16+12+13+12+13+13+11+14+12+11 = **127 s**. Act 2 = 12+8+15+10 =
**45 s**. Act 3 = 11+18+9 = **38 s**. Total **210 s = 3:30**.
Voiceover = 449 words / 210 s = **128 wpm**, under the 140 wpm ceiling on every shot.

Alternative for the `gh` CLI instead of the Actions tab (same shot, 5 s shorter):

```
gh workflow run link-check.yml --repo iAnmolAgarwal/pathwise
gh run list --workflow link-check.yml --limit 1
```

---

## 2. Where every number comes from

Check each one on the day of recording; if a source file has changed, change the script, not
the file.

| Number in the script | Value | Source |
|---|---|---|
| Roles a learner can pick ("15 roles in all", hero lead) | 15 | `src/data/goals.json` (15 entries) → `src/lib/trust.ts` `goalTemplates` |
| Skills ("159 skills", proof strip cell, Act 2 voiceover) | 159 | `src/data/skills.json` (159 entries) → `src/lib/trust.ts` `skills` |
| Prerequisite links ("193", proof strip, Act 2 voiceover) | 193 | `pipeline/evidence/agreement_report.json` → `authoredEdges: 193` |
| Checkable ("188 of 193") | 188 | `pipeline/evidence/agreement_report.json` → `observable.anySource: 188` |
| Confirmed ("74 of 188") | 74 | `pipeline/evidence/agreement_report.json` → `confirmed.anySource: 74` |
| Disputed / contradicted ("six disagreed", "six links contradicted") | 6 raised, 6 resolved | `pipeline/evidence/agreement_report.json` → `contradicted.count: 6`, `contradicted.resolved: 6` |
| "two million real learners" (landing heading and voiceover) | 2,137,848 + 72,774 = 2,210,622, floored to whole millions in words by `millionsInWords` | `pipeline/evidence/so_stats.md` → `usersEligible: 2137848`; `pipeline/evidence/coursera_stats.md` → `namesWithPairs: 72774`; formatting in `src/lib/trustFormat.ts` |
| Stack Overflow source plate ("2,137,848 users") | 2,137,848 | `pipeline/evidence/so_stats.md` → `usersEligible` |
| Coursera source plate ("72,774 learners") | 72,774 | `pipeline/evidence/coursera_stats.md` → `namesWithPairs` |
| Anchor edge, Stack Overflow ("54,067 … 95 percent in that order") | support 51,421 · reverse 2,646 · confidence 0.951061 → **95 %** · n 54,067 | `src/data/skill_edges.json`, edge `python → python-data-analysis`, `sources.stackoverflow` (cross-checks against `pipeline/evidence/so_stats.md`, "Top 20 edges by support") |
| Anchor edge, Coursera ("Coursera agrees", card shows 86 % / n 568) | support 491 · reverse 77 · confidence 0.864437 → **86 %** · n 568 · 5 course pairs | `src/data/skill_edges.json`, same edge, `sources.coursera` |
| Verdict "Verified by 2 of 2 sources" | derived: both sources clear confidence ≥ 0.70 and n ≥ 20 | `src/lib/edgeCard.ts` `edgeCardLines`; floors in `src/data/skill_edges.json` → `thresholds` |
| "What learners did next" after Python | population 422,784 · Python for Data Analysis 7 % / n 27,497 · JavaScript 6 % / n 27,108 · HTML 4 % / n 18,192 | `src/data/branches.json`, `from: python`, `source: stackoverflow` (`nTotal`, `next[].shareShrunk`, `next[].n`); percentages are `shareShrunk` rounded by `formatShare` in `src/lib/learnerEvidence.ts` |
| Caveats read on camera ("asking isn't finishing") | "Stack Overflow question order (first question per tag), users who started after both technologies existed; asking ≠ completing" | `src/data/skill_edges.json` → `caveats.stackoverflow` |
| Six contradictions and their resolutions | table of 6, all `keep-authored`, dated 2026-08-19 | `pipeline/evidence/agreement_report.md` → "## Contradictions" |
| Freshness line and the two jobs | "Kept fresh by machines, kept true by people…" | `README.md` → "## Keeping it fresh"; workflows `.github/workflows/link-check.yml` (weekly), `.github/workflows/drift-check.yml` (nightly) |

Numbers deliberately **not** spoken, but visible on screen and therefore worth knowing: the
catalog is 370 items — 307 courses, 36 projects, 27 assessments across 251 providers
(`src/data/catalog.json`, quoted in `README.md`), and the engine's weights are coverage 0.40,
level fit 0.15, preference fit 0.13, quality 0.10, similarity 0.20, transition prior 0.02
(`src/engine/score.ts` → `ENGINE_WEIGHTS`).

---

## 3. Captions and text overlays

Lower-third captions, sentence case, no terminal punctuation, one line each. Hold ~3 s. Set in
the product's own type (Inter) at the same size throughout; the only exception is the two cut
notices, which are smaller and top-right so they read as a note rather than a claim.

| In | Caption |
|---|---|
| 0:02 | Pathwise · a learning path you can verify |
| 0:18 | Every prerequisite, checked against real learners |
| 0:30 | Sign in with Google · three seeded demo learners |
| 0:43 | The profile is typed operations, not free text |
| 0:55 | Phases, milestones, real courses, real links |
| 0:56 *(top-right, small)* | Model thinking time trimmed |
| 1:08 | The narration sits beside the evidence it was given |
| 1:21 | The same reasoning, on the map |
| 1:32 | Feedback in, a rebuilt path out, with the reason |
| 1:46 | Mark it done, and Nova reacts |
| 1:58 | Progress · radar · streak · next action |
| 2:08 | Under the hood |
| 2:20 | Checked against two million learners |
| 2:29 | support · reverse · confidence · n · source · caveat |
| 2:44 | What learners did next: shares, never ratings |
| 2:54 | Where the data disagrees with us |
| 3:05 | Kept fresh by machines, kept true by people |
| 3:22 | trypathwise.vercel.app |

Nothing else is burned in — no arrows, no zoom boxes, no highlight rings. The product's own
hover and focus states do that work, and they are what the panel will see if they open it.

---

## 4. Dry-run checklist

Work through this in order on the morning of the recording. The whole list is about 20 minutes.

**Data**

- [ ] Reseed **on the day you record**. The personas are back-dated relative to the moment the
      script runs, and Alex's last seven days are what make the streak live; seed on Monday and
      record on Wednesday and the current streak reads 0.
      ```
      npm run seed <team-google-account-email> all
      ```
      (`package.json` → `"seed": "tsx --env-file-if-exists=.env.local scripts/seed-demo.ts"`.)
- [ ] The account must have signed in through Google at least once, or the script exits with
      *"No user with email … — sign in once first"*.
- [ ] To seed the deployed app, `.env.local`'s `DATABASE_URL` must point at the **production**
      Neon database, not a local one.
- [ ] Copy the three `open /learn/<id>` lines the seed prints — they are the tab pre-loads below.
- [ ] Re-run the seed between takes if a take clicked **Done**, **Too hard**, **Too easy** or
      **Not for me**: those writes are real. `npm run seed <email> alex` reseeds one persona.
- [ ] Re-check the four proof-strip numbers against `pipeline/evidence/agreement_report.json`
      and the anchor-edge numbers against `src/data/skill_edges.json` (table in §2).

**Browser**

- [ ] Fresh Chrome profile, signed into **only** the team Google account — a second account turns
      the sign-in shot into an account chooser.
- [ ] Window **1440 × 900**. The app shell puts chat and pane side by side above 1024 CSS px and
      stacks them below it (`src/components/shell/AppShell.tsx`), so never record narrower. The
      committed dashboard screenshot (`docs/img/dashboard.png`, 1846 × 1150) is the same 16:10
      framing, so 1440 × 900 matches what is already published.
- [ ] Reduced motion **OFF**, and **Data Saver off**. Either one makes the hero skip the Spline
      scene entirely and fall back to the orb (`src/components/landing/Hero.tsx`), and it also
      disables the proof-strip count-up, the path stagger and the diff banner's entrance.
- [ ] Bookmarks bar hidden, devtools closed, zoom at 100 %, extensions disabled.
- [ ] macOS Do Not Disturb on; Slack, mail and calendar quit.

**Warm-up (no cold-start pauses on camera)**

- [ ] Open `https://trypathwise.vercel.app/api/health` first and wait for `{ok: true}`. Neon's
      free-tier compute suspends after five idle minutes; `.github/workflows/keep-warm.yml` pings
      this every ten, but a manual hit guarantees a warm database for the take.
- [ ] Pre-load, in this tab order, and let each finish painting:
      1. `https://trypathwise.vercel.app/` (landing — the Spline scene and the fonts)
      2. `https://trypathwise.vercel.app/learn/<sam-id>`
      3. `https://trypathwise.vercel.app/learn/<priya-id>`
      4. `https://trypathwise.vercel.app/learn/<alex-id>` — then open its **Skill Graph** and
         **Dashboard** tabs once, so React Flow, dagre and Recharts are already downloaded (both
         are lazy-loaded in `src/components/LearnWorkspace.tsx`)
      5. the repository's Actions tab
- [ ] Close the pre-load tabs and start the take from a single fresh tab, so the recording shows
      real navigation over a warm cache.

**Rehearsals**

- [ ] Rehearse **1:44** (Done → Nova tab) at least three times. The window is 2.2 s.
- [ ] Rehearse **0:28** (typing the goal) so the sentence lands in one go without a backspace.
- [ ] Confirm Priya's diff banner is on screen the instant her workspace opens.
- [ ] Confirm the landing's **Open this link in the graph** button lands on Alex's graph with
      the arrow card pinned and its details already expanded.

**Fallback — the model**

The script **avoids** judge-mode degradation rather than featuring it. Three of the eleven
learner-story shots need a live model turn (0:28 the goal, 0:41 the intake card, 1:06 the
narration); the other eight are pure engine and record fine with the model unreachable. If the
daily budget goes during a take, chat closes with *"Nova is resting — today's conversation
budget is spent. Your path, feedback, graph and dashboard still work; chat opens again
tomorrow."*, and:

- the path, the diff banner, the graph, the provenance card, the branch overlay and the
  dashboard all still record exactly as scripted;
- a learner with no path can still get one — on the Path tab, Nova resting turns the empty
  state into a goal picker with a **Build my path** button, so 0:53 can be shot without a
  model at all;
- what cannot be shot is Nova's narration in the explain panel. That panel then shows the
  degraded note plus *"The evidence beside this is unaffected — it comes from the path, not
  the model."* — honest, but it is not the shot.

So: do the three model shots first, in one sitting, and shoot the rest afterwards. Resilience
already has its own place in the film — panel six of the landing's benefits wall reads *"If the
model is down / still answers"* — and that is where it belongs, rather than as an accident in
the middle of the learner story.

---

## 5. Open items to confirm on the day — **[VERIFY AT RECORDING]**

1. **Priya's diff banner wording.** The banner is generated by the engine from her seeded
   `too_hard` on *The Complete JavaScript Course: From Zero to Expert*, so the exact sentence
   and the version number depend on the seed run. The shape is fixed: either *"Swapped X for Y
   because you found The Complete JavaScript Course: From Zero to Expert too hard."* or *"Added
   … and removed … because you found … too hard."*, with added rows reading *"Rebuilds what The
   Complete JavaScript Course: From Zero to Expert assumed you knew — closes …"* and removed
   rows *"Made room for remediation first"*. Read the real sentence off the screen before
   recording the voiceover; the voiceover as written does not quote it.
2. **Alex may also open with a diff banner.** His last seeded event is a completion, which
   replans only if it opens a shortcut. If a banner is on his path when it opens, dismiss it
   before the 1:44 shot so the celebration beat is not competing with it.
3. **The 2.2-second celebration window** at 1:44 (see the note under Act 1).
4. **Sam's live turn must produce the intake card.** It does so only when no skill has been
   stated, which is why the scripted sentence is bare. If a take says anything like "I know
   some Excel", Nova will build the path straight away and skip the card.
5. **Repository visibility.** Act 3 shows two GitHub pages. Confirm the repo is reachable from
   the recording browser session before the take; if it is not, shoot the agreement report from
   a local checkout instead and keep the Actions run in the browser.
6. **The exact tier line on the anchor arrow's details** ("Confirmed by both sources") — read it
   off the pinned card rather than trusting this script, since it follows the edge status the
   pipeline wrote.
7. **Contradicted arrows are not reachable from Alex's graph.** His subgraph does not contain
   any of the six. If a live in-app "under review" card is wanted instead of the report, it has
   to be shot from Priya's graph, on the *CSS → Web Accessibility* arrow.
