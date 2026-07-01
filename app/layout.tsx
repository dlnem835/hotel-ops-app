import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ONE_EYRIE_BRAND } from "./lib/one-eyrie-brand";
import InactivityGuard from "./components/InactivityGuard";
import OneEyrieThemeBootstrap from "./components/OneEyrieThemeBootstrap";
import RoleAccessProvider from "./components/RoleAccessProvider";
import RoleRouteGuard from "./components/RoleRouteGuard";
import ThemeProvider from "./components/ThemeProvider";
import "./globals.css";
import "./one-eyrie-shell.css";
import "./one-eyrie-themes.css";
import "./components/one-eyrie-modal.css";
import "./one-eyrie-desktop-responsive.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "One Eyrie",
  description: "Hotel operations platform",
  icons: {
    icon: [
      { url: ONE_EYRIE_BRAND.icons.favicon, sizes: "48x48", type: "image/x-icon" },
      { url: ONE_EYRIE_BRAND.icons.icon192, sizes: "192x192", type: "image/png" },
      { url: ONE_EYRIE_BRAND.icons.icon512, sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: ONE_EYRIE_BRAND.icons.appleTouch,
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: ONE_EYRIE_BRAND.icons.favicon,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5F1" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <OneEyrieThemeBootstrap />
        <ThemeProvider>
          <RoleAccessProvider>
            {children}
            <RoleRouteGuard />
          </RoleAccessProvider>
        </ThemeProvider>
        <InactivityGuard />
      </body>
    </html>
  );
}
