import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardCheck,
  FileText,
  Home,
  Package,
  Settings,
  Wrench,
} from "lucide-react";
import type { OneEyrieNavLabel } from "@/app/lib/role-permissions";

export const DESKTOP_NAV_ICONS: Record<OneEyrieNavLabel, LucideIcon> = {
  Dashboard: Home,
  "Pass-On": FileText,
  Maintenance: Wrench,
  Inspections: ClipboardCheck,
  "Lost & Found": Package,
  Reports: BarChart3,
  Settings: Settings,
};
