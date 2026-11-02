import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import NavBar from "./components/NavBar";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-open-sans",
});

export const metadata: Metadata = {
  title: "FirstPage HK — AI & Automation Portfolio",
  description:
    "Hong Kong AI & Automation Team led by Glass Chan. Production-ready systems delivering measurable ROI across SEO, Finance, Sales, and CX.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={openSans.className}>
        <div className="min-h-screen bg-background flex flex-col">
          {/* Topbar — FirstPage regions strip */}
          <div className="bg-navy text-white text-xs tracking-wider hidden sm:block">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between py-1.5">
                <div className="flex gap-4 opacity-75">
                  <span>HONG KONG</span>
                  <a href="https://www.firstpage.com.au" target="_blank" rel="noreferrer">AUSTRALIA</a>
                  <a href="https://www.firstpage.sg" target="_blank" rel="noreferrer">SINGAPORE</a>
                  <a href="https://www.firstpage.com" target="_blank" rel="noreferrer">USA</a>
                </div>
                <div>+852 2356 3200</div>
              </div>
            </div>
          </div>

          {/* Header */}
          <header className="bg-white/94 backdrop-blur border-b border-border sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-8 h-16">
                <Link href="/toolbox" className="flex items-center gap-3 shrink-0">
                  <span className="w-9 h-9 rounded-[10px] bg-grad-banner grid place-items-center text-white font-extrabold text-sm tracking-widest">
                    FP
                  </span>
                  <span>
                    <span className="block text-[15px] font-extrabold tracking-wide text-navy leading-tight">
                      FIRSTPAGE HK
                    </span>
                    <span className="block text-[10.5px] font-semibold tracking-[0.13em] uppercase text-fp-600">
                      AI &amp; Automation Toolbox
                    </span>
                  </span>
                </Link>
                <NavBar />
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1">{children}</main>

          {/* Footer */}
          <footer className="bg-navy text-[oklch(0.85_0.02_250)] text-[13px] mt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
              <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                <p className="text-[oklch(0.85_0.02_250)]">
                  <strong className="text-white font-semibold">FirstPage Hong Kong</strong> — AI &amp; Automation Team · Led by Glass Chan
                </p>
                <p className="text-[oklch(0.75_0.02_250)]">
                  All systems production-ready
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
