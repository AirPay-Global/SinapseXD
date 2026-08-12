import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

// Font FILES are checked into ./fonts and loaded via next/font/local — not
// next/font/google. next/font/google still needs to fetch from
// fonts.googleapis.com/fonts.gstatic.com AT BUILD TIME to self-host them;
// on a network-restricted build host (no DNS to Google) that fetch fails
// and the whole build fails. Local files make the build fully offline.
const inter = localFont({
  src: [
    { path: "./fonts/inter-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/inter-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/inter-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/inter-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
});
const sora = localFont({
  src: [
    { path: "./fonts/sora-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/sora-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "Sinapse — Decision OS",
  description:
    "Decision Intelligence Platform for African trade, infrastructure and governance, by AirPay Global.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
