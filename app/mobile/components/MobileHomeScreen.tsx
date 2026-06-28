"use client";

import Link from "next/link";
import { signOutAndRedirect } from "@/app/lib/auth";
import {
  ClipboardCheck,
  ClipboardList,
  HardHat,
  LogOut,
  MessageSquare,
  Wrench,
} from "lucide-react";

const MODULES = [
  {
    title: "Pass-On Log",
    href: "/mobile/pass-on-log",
    icon: MessageSquare,
    color: "#C8A96A",
    lightTile: true,
  },
  {
    title: "Work Orders",
    href: "/mobile/work-orders",
    icon: HardHat,
    color: "#C9A8A8",
    lightTile: true,
  },
  {
    title: "PMs",
    href: "/mobile/pms",
    icon: Wrench,
    color: "#B8D4C4",
    lightTile: true,
  },
  {
    title: "Room Inspections",
    href: "/mobile/inspections",
    icon: ClipboardCheck,
    color: "#8EC5D6",
    lightTile: true,
  },
  {
    title: "RPMs",
    href: "/mobile/rpms",
    icon: ClipboardList,
    color: "#D4C4A8",
    lightTile: true,
  },
] as const;

export default function MobileHomeScreen() {
  function handleLogout() {
    void signOutAndRedirect();
  }

  return (
    <div className="one-eyrie-mobile__inner">
      <header>
        <div className="one-eyrie-mobile-brand__title">ONE</div>
        <div className="one-eyrie-mobile-brand__subtitle">— EYRIE —</div>
        <h1 className="one-eyrie-mobile-heading">Field Operations</h1>
        <p className="one-eyrie-mobile-subheading">Choose a module to get started.</p>
      </header>

      <nav className="one-eyrie-mobile-menu" aria-label="Field operations modules">
        {MODULES.map((module) => {
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
        })}

        <button
          type="button"
          className="one-eyrie-mobile-menu__btn one-eyrie-mobile-menu__btn--logout"
          onClick={handleLogout}
        >
          <span className="one-eyrie-mobile-menu__icon">
            <LogOut size={24} strokeWidth={2} />
          </span>
          Logout
        </button>
      </nav>
    </div>
  );
}
