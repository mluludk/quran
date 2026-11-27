import type { Metadata } from "next";
import { Scheherazade_New } from "next/font/google";
import "./globals.css";

const arabicUi = Scheherazade_New({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-arabic-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Digital Mushaf & Quran Word Explorer",
  description: "Mushaf Madinah (Hafs, 604 pages) with word-level Indonesian translation and morphology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={arabicUi.variable}>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", backgroundColor: "#faf8f5", color: "#1c1917" }}>
        {children}
      </body>
    </html>
  );
}
