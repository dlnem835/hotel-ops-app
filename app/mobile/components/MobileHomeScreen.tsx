"use client";

import Link from "next/link";
import OneEyriePlaceholderIcon from "@/app/components/OneEyriePlaceholderIcon";
import OneEyriePropertySelector from "@/app/components/OneEyriePropertySelector";
import OneEyrieUserProfileMenu from "@/app/components/OneEyrieUserProfileMenu";
import { useRoleAccess } from "@/app/components/RoleAccessProvider";
import type { MobileModuleKey } from "@/app/lib/role-permissions";
import {
  ClipboardCheck,
  ClipboardList,
  HardHat,
  MessageSquare,
  Wrench,
} from "lucide-react";

const MODULES: Array<{
  key: MobileModuleKey;
  title: string;
  href: string;
  icon: typeof MessageSquare;
  color: string;
  lightTile: boolean;
}> = [
  {
    key: "pass_on",
    title: "Pass-On Log",
    href: "/mobile/pass-on-log",
    icon: MessageSquare,
    color: "#C8A96A",
    lightTile: true,
  },
  {
    key: "work_orders",
    title: "Work Orders",
    href: "/mobile/work-orders",
    icon: HardHat,
    color: "#C9A8A8",
    lightTile: true,
  },
  {
    key: "pms",
    title: "Preventative Maintenance",
    href: "/mobile/pms",
    icon: Wrench,
    color: "#B8D4C4",
    lightTile: true,
  },
  {
    key: "inspections",
    title: "Room Inspections",
    href: "/mobile/inspections",
    icon: ClipboardCheck,
    color: "#8EC5D6",
    lightTile: true,
  },
  {
    key: "rpms",
    title: "Rooms Preventative Maintenance",
    href: "/mobile/rpms",
    icon: ClipboardList,
    color: "#D4C4A8",
    lightTile: true,
  },
];

export default function MobileHomeScreen() {
  const { mobileModules, loading } = useRoleAccess();

  const visibleModules = MODULES.filter((module) => mobileModules.includes(module.key));

  return (
    <div className="one-eyrie-mobile__inner">
      <header>
        <OneEyriePlaceholderIcon className="one-eyrie-placeholder-icon--mobile" />
        <h1 className="one-eyrie-mobile-heading">Field Operations</h1>
        <p className="one-eyrie-mobile-subheading">Choose a module to get started.</p>
        <OneEyriePropertySelector variant="mobile" />
      </header>

      <nav className="one-eyrie-mobile-menu" aria-label="Field operations modules">
        {loading ? (
          <div className="one-eyrie-mobile-status">Loading modules…</div>
        ) : visibleModules.length === 0 ? (
          <div className="one-eyrie-mobile-status">No mobile modules available.</div>
        ) : (
          visibleModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.href}
                href={module.href}
                className={`one-eyrie-mobile-menu__btn${module.lightTile ? " one-eyrie-mobile-menu__btn--row" : ""}`}
              >
                <span className="one-eyrie-mobile-menu__icon" style={{ color: module.color }}>
                  <Icon size={24} strokeWidth={2} />
                </span>
                {module.title}
              </Link>
            );
          })
        )}

        <OneEyrieUserProfileMenu variant="mobile" />
      </nav>
    </div>
  );
}
