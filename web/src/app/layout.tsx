import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reconstruction Records Explorer",
  description: "Search and analyze digitized Reconstruction-era federal records",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header
          className="border-b sticky top-0 z-10"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
            <Link href="/" className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
              Reconstruction Records Explorer
            </Link>
            <nav className="flex gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              <Link href="/">Search</Link>
              <Link href="/analysis">Analysis</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
        <footer
          className="text-xs px-4 py-4 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          Transcriptions and image analysis are machine-generated and may be inaccurate.
          Always verify against the linked source image.
        </footer>
      </body>
    </html>
  );
}
