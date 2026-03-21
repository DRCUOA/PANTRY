import type { Metadata, Viewport } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Pantry",
  description: "Quiet kitchen stock, scan, and meal planning",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Pantry" },
};

export const viewport: Viewport = {
  themeColor: "#2d6a4f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${newsreader.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
