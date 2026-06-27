import type { Metadata, Viewport } from "next";
import "./mobile.css";

export const metadata: Metadata = {
  title: "One Eyrie · Field Operations",
  description: "Mobile field operations for One Eyrie",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111111",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <div className="one-eyrie-mobile">{children}</div>;
}
