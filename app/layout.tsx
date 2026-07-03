import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Ankhasův zápisník",
    template: "%s · Ankhasův zápisník",
  },
  description:
    "Osobní knihovna prožitých příběhů — hry, filmy, seriály, knihy, komiksy i podcasty na jednom místě.",
};

export const viewport: Viewport = {
  themeColor: "#0B0B0D",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs" className={inter.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
