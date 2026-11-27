import type { Metadata } from "next";

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
    <html lang="id">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", backgroundColor: "#faf8f5", color: "#1c1917" }}>
        {children}
      </body>
    </html>
  );
}
