import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import Link from "next/link";
import WaxSeal from "@/components/WaxSeal";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const displaySerif = Playfair_Display({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: ["600", "700"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header
          className="ledger-rule border-b sticky top-0 z-10"
          style={{ background: "var(--surface)", borderBottomColor: "var(--border)" }}
        >
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
            <WaxSeal size={68} />
            <div className="flex flex-col gap-1 min-w-0">
              <Link href="/" className="font-display text-xl leading-none truncate" style={{ color: "var(--foreground)" }}>
                Reconstruction Records Explorer
              </Link>
              <span className="badge-mpact w-fit">An MPact Capital Special Project</span>
            </div>
            <nav className="nav-pills masthead-caps text-xs ml-auto" style={{ color: "var(--text-secondary)" }}>
              <Link href="/">Search</Link>
              <Link href="/analysis">Analysis</Link>
              <Link href="/buckets">Research Buckets</Link>
              <Link href="/further-reading">Further Reading</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">{children}</main>
        <footer
          className="flex flex-col items-center gap-3 text-xs px-4 py-10 text-center border-t"
          style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
        >
          <WaxSeal size={84} />
          <div className="flex flex-col items-center gap-1.5">
            <span className="font-display text-base" style={{ color: "var(--foreground)" }}>
              An MPact Capital Special Project
            </span>
            <a
              href="https://mpactcap.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs"
              style={{ color: "var(--series-1)" }}
            >
              mpactcap.com
            </a>
          </div>
          <span className="max-w-xl">
            Transcriptions and image analysis are machine-generated and may be inaccurate.
            Always verify against the linked source image.
          </span>
        </footer>
      </body>
    </html>
  );
}
