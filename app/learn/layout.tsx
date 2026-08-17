import type { Metadata } from "next";

export const metadata: Metadata = { title: "Start" };

export default function LearnLayout({ children }: LayoutProps<"/learn">) {
  return children;
}
