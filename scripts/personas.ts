import type { DemoStep } from "../src/lib/demoStory";
import { DEMO_CARD_ANSWER, DEMO_HOURS_OPS, DEMO_OPENING_OPS, DEMO_STORY } from "../src/lib/demoStory";
import type { ProfileOp } from "../src/schemas";

/**
 * The seeded demo learners. Each is a real engine history — every path version is generated,
 * every replan comes from a feedback event run through the same rules the product uses.
 * Alex's story also lives in src/lib/demoStory.ts because the landing page replays it.
 */
export type Persona = {
  key: string;
  displayName: string;
  avatarSeed: string;
  /** Days ago the learner was created. */
  createdDaysAgo: number;
  /** Goal + levels Nova inferred from the first message; empty for a learner who has not spoken yet. */
  openingOps: ProfileOp[];
  /** Levels the learner corrected on the intake card. */
  cardAnswer: ProfileOp[];
  /** Profile ops applied where a chat step carries `apply_profile_ops` on the given day. */
  opsOnDay?: Record<number, ProfileOp[]>;
  story: DemoStep[];
  /** What the persona is for — printed by the seed script. */
  shows: string;
};

const alex: Persona = {
  key: "alex",
  displayName: "Alex",
  avatarSeed: "demo-alex",
  createdDaysAgo: 41,
  openingOps: DEMO_OPENING_OPS,
  cardAnswer: DEMO_CARD_ANSWER,
  opsOnDay: { 5: DEMO_HOURS_OPS },
  story: DEMO_STORY,
  shows: "mid-path ML engineer, six weeks in: a completed milestone, a live streak, several replans",
};

/** Twelve days in: two items done, then a course that assumed too much — the replan banner is the latest thing on her path. */
const priya: Persona = {
  key: "priya",
  displayName: "Priya",
  avatarSeed: "demo-priya",
  createdDaysAgo: 12,
  openingOps: [
    { op: "add_goal", goal: { type: "role", templateId: "frontend-developer" } },
    { op: "set_skill", skillId: "html", level: 2, source: "inferred" },
    { op: "set_skill", skillId: "css", level: 2, source: "inferred" },
  ],
  cardAnswer: [
    { op: "set_skill", skillId: "programming-basics", level: 1, source: "stated" },
    { op: "set_preference", key: "hoursPerWeek", value: 7 },
  ],
  story: [
    { kind: "chat", day: 12, role: "user", text: "I want to become a frontend developer. I've built a few static sites with HTML and CSS for friends but I've never written real JavaScript." },
    { kind: "chat", day: 12, role: "assistant", text: "Frontend Developer — good. I've marked HTML and CSS as things you hold. Let me check a couple of levels before I build the path, so it starts where you are.", toolCalls: ["apply_profile_ops"], minute: 1 },
    { kind: "chat", day: 12, role: "assistant", text: "Tap anything I got wrong, and tell me how your week looks.", card: true, minute: 2 },
    { kind: "chat", day: 12, role: "user", text: "I know the basics of programming from a school course. About 7 hours a week.", minute: 5 },
    { kind: "chat", day: 12, role: "assistant", text: "Your path is ready: four phases from the command line and how the web works, through JavaScript, to React. Start with Linux Journey — short, and the next phase assumes you are at home in a terminal.", toolCalls: ["apply_profile_ops", "generate_path"], minute: 6 },
    { kind: "feedback", day: 10, event: { type: "completed", catalogId: "linux-journey" } },
    { kind: "chat", day: 10, role: "user", text: "Done with Linux Journey. The permissions chapter finally made sense.", minute: 2 },
    { kind: "chat", day: 10, role: "assistant", text: "Marked done — that puts Command Line & Linux Basics at level 1 on your profile. Networking is next: three hours, and it explains what actually happens when a page loads.", toolCalls: ["get_profile"], minute: 3 },
    { kind: "feedback", day: 7, event: { type: "completed", catalogId: "practical-networking" } },
    { kind: "chat", day: 4, role: "user", text: "Started the big JavaScript course. It's moving fast." },
    { kind: "chat", day: 4, role: "assistant", text: "It is a long one — 69 hours. If it assumes things you don't have yet, say so and I'll rework the path rather than have you push through.", minute: 1 },
    { kind: "feedback", day: 1, event: { type: "too_hard", catalogId: "udemy-jonas-js" } },
    { kind: "chat", day: 1, role: "user", text: "The JavaScript course is too hard — it assumes I already know things about CSS layout and the DOM that I don't.", minute: 2 },
    { kind: "chat", day: 1, role: "assistant", text: "Understood. I've lowered what I assumed you hold in CSS and JavaScript and redone the path: the freeCodeCamp Responsive Web Design certification and a small GitHub Pages site come in before any JavaScript course, and the two items that leaned on those skills are out for now. The diff on your path shows exactly what moved and why.", toolCalls: ["replan_path"], minute: 3 },
  ],
  shows: "frontend learner whose latest path version is a too_hard replan — the diff banner is what you see first",
};

/** Created today, has not said a word: the empty workspace and the intake conversation from the top. */
const sam: Persona = {
  key: "sam",
  displayName: "Sam",
  avatarSeed: "demo-sam",
  createdDaysAgo: 0,
  openingOps: [],
  cardAnswer: [],
  story: [],
  shows: "a fresh learner with no goal, no path and no messages — the first-run screens",
};

export const PERSONAS: Record<string, Persona> = { alex, priya, sam };
