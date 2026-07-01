import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ONE_EYRIE_BRAND } from "./lib/one-eyrie-brand";
import InactivityGuard from "./components/InactivityGuard";
import RoleAccessProvider from "./components/RoleAccessProvider";
import RoleRouteGuard from "./components/RoleRouteGuard";
import "./globals.css";
import "./one-eyrie-shell.css";

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
        <RoleAccessProvider>
          {children}
          <RoleRouteGuard />
        </RoleAccessProvider>
        <InactivityGuard />
      </body>
    </html>
  );
}
