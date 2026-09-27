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

type PreferenceOptionProps = {
  label: string;
  selected: boolean;
  onSelect: () => void;
};

function PreferenceOption({ label, selected, onSelect }: PreferenceOptionProps) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      className={`one-eyrie-user-profile-menu__theme-btn${
        selected ? " one-eyrie-user-profile-menu__theme-btn--selected" : ""
      }`}
      onClick={onSelect}
    >
      {label}
    </button>
  );
}

type ProfilePreferencePanelProps = {
  theme: OneEyrieTheme;
  shell: AppShell;
  onThemeSelect: (theme: OneEyrieTheme) => void;
  onInterfaceSelect: (shell: AppShell) => void;
  onLogout: () => void;
};

function ProfilePreferencePanel({
  theme,
  shell,
  onThemeSelect,
  onInterfaceSelect,
  onLogout,
}: ProfilePreferencePanelProps) {
  return (
    <div className="one-eyrie-profile-prefs">
      <div className="one-eyrie-user-profile-menu__appearance-label">Appearance</div>
      <div
        className="one-eyrie-user-profile-menu__theme-toggle"
        role="group"
        aria-label="Appearance"
      >
        <PreferenceOption
          label="Light"
          selected={theme === "light"}
          onSelect={() => onThemeSelect("light")}
        />
        <PreferenceOption
          label="Dark"
          selected={theme === "dark"}
          onSelect={() => onThemeSelect("dark")}
        />
      </div>

      <div className="one-eyrie-user-profile-menu__appearance-label">Interface</div>
      <div
        className="one-eyrie-user-profile-menu__theme-toggle"
        role="group"
        aria-label="Interface"
      >
        <PreferenceOption
          label="Desktop"
          selected={shell === "desktop"}
          onSelect={() => onInterfaceSelect("desktop")}
        />
        <PreferenceOption
          label="Mobile"
          selected={shell === "mobile"}
          onSelect={() => onInterfaceSelect("mobile")}
        />
      </div>

      <div className="one-eyrie-user-profile-menu__divider" role="separator" />

      <button
        type="button"
        role="menuitem"
        className="one-eyrie-user-profile-menu__item"
        onClick={onLogout}
      >
        <span>Logout</span>
      </button>
    </div>
  );
}

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
          <ProfilePreferencePanel
            theme={theme}
            shell={shell}
            onThemeSelect={handleThemeSelect}
            onInterfaceSelect={handleInterfaceSelect}
            onLogout={() => {
              setOpen(false);
              void signOutAndRedirect();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
