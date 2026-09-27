import type { Metadata } from "next";
import AdminAccessGate from "./components/AdminAccessGate";
import "./admin.css";
import "./admin-light-theme.css";

export const metadata: Metadata = {
  title: "One Eyrie Admin",
  description: "One Eyrie internal platform administration",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminAccessGate>{children}</AdminAccessGate>;
}
