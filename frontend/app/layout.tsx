import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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
  title: { template: "%s · Dhaka Tesla Pool", default: "Dhaka Tesla Pool" },
  description: "Ride-pooling for Jashim's 3-seat Tesla, Bullet.",
};

// Runs before first paint, so the page never flashes the wrong theme: the saved choice
// (components/theme-toggle.tsx), else the OS setting. Storage can throw (private mode, blocked
// site data), which falls back to light.
const THEME_SCRIPT = `try {
  var t = localStorage.getItem("tesla-pool-theme");
  if (t !== "light" && t !== "dark") t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
} catch (e) { document.documentElement.dataset.theme = "light"; }`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The script sets data-theme before React hydrates, so the attribute legitimately differs
    // from the server HTML.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans text-sm">
        {children}
        <Script id="theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
      </body>
    </html>
  );
}
