import { MobileInspectionSessionProvider } from "./MobileInspectionSessionProvider";

export default function MobileInspectionSessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MobileInspectionSessionProvider>{children}</MobileInspectionSessionProvider>;
}
