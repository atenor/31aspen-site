import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BodyShop Quote & Lien",
  description: "Shop-first estimating, claim tracking, receivables, and lien readiness."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
