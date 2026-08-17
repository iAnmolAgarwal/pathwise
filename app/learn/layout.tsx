import type { Metadata } from "next";

export const metadata: Metadata = { title: "Start", description: "Give Nova a name to keep your goal, skills and path under — no account needed." };

export default function LearnLayout({ children }: LayoutProps<"/learn">) {
  return children;
}
