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
  title: { default: "Pathwise — learn what matters", template: "%s · Pathwise" },
  description: "Nova, an AI learning mentor, maps your skill gap and builds a personalised path from real courses — then rewrites it when you push back.",
  applicationName: "Pathwise",
  openGraph: {
    title: "Pathwise — learn what matters",
    description: "An AI mentor that maps your skill gap, sequences real courses, and adapts the path to your feedback.",
    siteName: "Pathwise",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Pathwise — learn what matters" },
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
