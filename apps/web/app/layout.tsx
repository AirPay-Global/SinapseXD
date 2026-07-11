import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

// Self-hosted at build time via next/font — no runtime request to Google
// Fonts, so the UI renders identically on restricted networks.
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter" });
const sora = Sora({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-sora" });

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
