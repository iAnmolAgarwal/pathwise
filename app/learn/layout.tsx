import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your learners", description: "Sign in with Google, pick a learner, and continue where you left off." };

export default function LearnLayout({ children }: LayoutProps<"/learn">) {
  return children;
}
