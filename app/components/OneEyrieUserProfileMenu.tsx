"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { signOutAndRedirect } from "@/app/lib/auth";
import { useOneEyrieTheme } from "@/app/components/ThemeProvider";
import { useRoleAccess } from "@/app/components/RoleAccessProvider";
import { useCurrentUserProfile } from "@/app/lib/use-current-user-profile";
import type { OneEyrieTheme } from "@/app/lib/one-eyrie-theme";
import { resolveHomeForPermissions } from "@/app/lib/resolve-app-home";
import {
  persistInterfacePreference,
  resolvePreferredShell,
  type AppShell,
} from "@/app/lib/viewport-interface";

type OneEyrieUserProfileMenuProps = {
  variant?: "sidebar" | "mobile" | "header";
};

export default function OneEyrieUserProfileMenu({
  variant = "sidebar",
}: OneEyrieUserProfileMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { theme, setTheme } = useOneEyrieTheme();
  const { permissions } = useRoleAccess();
  const { profile, loading } = useCurrentUserProfile();
  const [open, setOpen] = useState(false);
  const [shell, setShell] = useState<AppShell>("desktop");

  const displayName = profile?.displayName ?? "User";
  const jobTitle = profile?.jobTitle ?? "Team Member";
  const initials = profile?.initials ?? "U";

  useEffect(() => {
    setShell(resolvePreferredShell());
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function handleThemeSelect(next: OneEyrieTheme) {
    setTheme(next);
  }

  function handleInterfaceSelect(next: AppShell) {
    persistInterfacePreference(next);
    setShell(next);

    const onMobile =
      pathname === "/mobile" || (pathname?.startsWith("/mobile/") ?? false);
    const alreadyOnShell =
      (next === "mobile" && onMobile) || (next === "desktop" && !onMobile);
    if (alreadyOnShell) return;

    const target = permissions
      ? resolveHomeForPermissions(permissions, next)
      : next === "mobile"
        ? "/mobile"
        : "/";

    window.location.replace(target);
  }

  return (
    <div
      ref={rootRef}
      className={`one-eyrie-user-profile-menu one-eyrie-user-profile-menu--${variant}`}
    >
      <button
        type="button"
        className="one-eyrie-user-profile-menu__trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        disabled={loading}
      >
        <span className="one-eyrie-user-profile-menu__avatar" aria-hidden>
          {initials}
        </span>

        <span className="one-eyrie-user-profile-menu__identity">
          <span className="one-eyrie-user-profile-menu__name">{displayName}</span>
          <span className="one-eyrie-user-profile-menu__title">{jobTitle}</span>
        </span>

        <ChevronDown
          size={16}
          className={`one-eyrie-user-profile-menu__chevron${open ? " one-eyrie-user-profile-menu__chevron--open" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="one-eyrie-user-profile-menu__dropdown"
          aria-label="User menu"
        >
          <div className="one-eyrie-user-profile-menu__appearance-label">
            Appearance
          </div>
          <div
            className="one-eyrie-user-profile-menu__theme-toggle"
            role="group"
            aria-label="Appearance"
          >
            <button
              type="button"
              role="menuitemradio"
              aria-checked={theme === "light"}
              className={`one-eyrie-user-profile-menu__theme-btn${
                theme === "light"
                  ? " one-eyrie-user-profile-menu__theme-btn--selected"
                  : ""
              }`}
              onClick={() => handleThemeSelect("light")}
            >
              Light
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={theme === "dark"}
              className={`one-eyrie-user-profile-menu__theme-btn${
                theme === "dark"
                  ? " one-eyrie-user-profile-menu__theme-btn--selected"
                  : ""
              }`}
              onClick={() => handleThemeSelect("dark")}
            >
              Dark
            </button>
          </div>
          <div className="one-eyrie-user-profile-menu__appearance-label">
            Interface
          </div>
          <div
            className="one-eyrie-user-profile-menu__theme-toggle"
            role="group"
            aria-label="Interface"
          >
            <button
              type="button"
              role="menuitemradio"
              aria-checked={shell === "desktop"}
              className={`one-eyrie-user-profile-menu__theme-btn${
                shell === "desktop"
                  ? " one-eyrie-user-profile-menu__theme-btn--selected"
                  : ""
              }`}
              onClick={() => handleInterfaceSelect("desktop")}
            >
              Desktop
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={shell === "mobile"}
              className={`one-eyrie-user-profile-menu__theme-btn${
                shell === "mobile"
                  ? " one-eyrie-user-profile-menu__theme-btn--selected"
                  : ""
              }`}
              onClick={() => handleInterfaceSelect("mobile")}
            >
              Mobile
            </button>
          </div>
          <div className="one-eyrie-user-profile-menu__divider" role="separator" />

          <button
            type="button"
            role="menuitem"
            className="one-eyrie-user-profile-menu__item"
            onClick={() => {
              setOpen(false);
              void signOutAndRedirect();
            }}
          >
            <span>Logout</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
