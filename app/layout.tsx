import type { Metadata } from "next";
import { Syne, DM_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Allo — Inventory",
  description: "Multi-warehouse inventory & reservation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${dmMono.variable}`}>
      <body className="bg-[#0a0a0f] text-white antialiased font-sans min-h-screen">
        <header className="border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 group">
              <div className="w-7 h-7 bg-amber-400 rounded-sm flex items-center justify-center">
                <span className="text-black font-black text-xs">A</span>
              </div>
              <span className="font-bold text-lg tracking-tight">allo</span>
              <span className="text-white/20 text-sm font-mono ml-1">inventory</span>
            </a>
            <div className="flex items-center gap-3 text-xs text-white/30 font-mono">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse inline-block" />
              live
            </div>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
