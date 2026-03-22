import type { Metadata, Viewport } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/ThemeProvider";
import { themeBootScript } from "@/lib/theme";
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
  themeColor: "#ff4500",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${newsreader.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-[var(--background)] font-sans antialiased">
        <Script id="pantry-theme-boot" strategy="beforeInteractive">
          {themeBootScript()}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
