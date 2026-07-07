import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sinapse XD — Trade Intelligence",
  description:
    "Trade intelligence platform for African ports and AfCFTA institutions, by AirPay Global.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
