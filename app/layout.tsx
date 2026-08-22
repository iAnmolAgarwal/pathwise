import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://pathwise-psi-blond.vercel.app"),
  title: { default: "Pathwise — a learning path you can check", template: "%s · Pathwise" },
  description: "Nova asks what you want to become; math picks the courses from a hand-built skill map checked against millions of real learners. Every arrow shows its count. The AI explains, it never decides.",
  applicationName: "Pathwise",
  openGraph: {
    title: "Pathwise — a learning path you can check",
    description: "A hand-built skill map checked against real learners on Stack Overflow and Coursera, courses picked by arithmetic, an AI that explains but never decides.",
    siteName: "Pathwise",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Pathwise — a learning path you can check" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
