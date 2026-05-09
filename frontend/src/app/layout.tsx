import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  style: ["italic", "normal"],
});

export const metadata: Metadata = {
  title: "Pluck — Paste a link. Get the file. Done.",
  description:
    "A clean, fast, ad-free downloader for TikTok, YouTube, Instagram, Facebook, and X. No sign-up. No watermarks. Just the download.",
  keywords: [
    "tiktok video downloader",
    "youtube downloader",
    "instagram video downloader",
    "facebook video downloader",
    "twitter video downloader",
    "no ads",
    "free downloader",
  ],
  authors: [{ name: "Pluck" }],
  openGraph: {
    title: "Pluck — Paste a link. Get the file. Done.",
    description:
      "Clean, ad-free downloader for short-form video. No sign-up, no watermarks.",
    type: "website",
    url: "/",
    siteName: "Pluck",
  },
  twitter: {
    card: "summary",
    title: "Pluck — Paste a link. Get the file. Done.",
    description: "Clean, ad-free downloader for short-form video.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#EEF2F6",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
