import type { Metadata } from "next";
import {
  Cinzel,
  Inter,
  JetBrains_Mono,
  Newsreader,
} from "next/font/google";
import "./globals.css";
import { TelemetryProvider } from "@/components/TelemetryContext";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PersistentAudioPlayer } from "@/components/PersistentAudioPlayer";
import { RubricInspectorDrawer } from "@/components/RubricInspectorDrawer";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cinzel",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Change Advisory Board (The CAB Call) — SRE & Masonic News Telemetry",
    template: "%s | Change Advisory Board (thecabcall.com)",
  },
  description:
    "Automated Post-Incident Reviews for current events. System 1 zero-shot classification (Jev) and System 2 Socratic synthesis applying Site Reliability Engineering and the Working Tools of Freemasonry.",
  metadataBase: new URL("https://thecabcall.com"),
  alternates: {
    types: {
      "application/rss+xml": "https://thecabcall.com/feed.xml",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${newsreader.variable} ${inter.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="min-h-screen flex flex-col bg-[#0B0E14] text-[#F3EFE6] antialiased selection:bg-[#C5A059] selection:text-[#0B0E14]">
        <TelemetryProvider>
          <SiteHeader />
          <main className="flex-grow">{children}</main>
          <SiteFooter />
          <RubricInspectorDrawer />
          <PersistentAudioPlayer />
        </TelemetryProvider>
      </body>
    </html>
  );
}
