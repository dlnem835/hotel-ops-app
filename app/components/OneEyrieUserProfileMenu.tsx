"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Moon, Smartphone } from "lucide-react";
import { signOutAndRedirect } from "@/app/lib/auth";
import { useOneEyrieTheme } from "@/app/components/ThemeProvider";
import OneEyrieIosSwitch from "@/app/components/OneEyrieIosSwitch";
import { useCurrentUserProfile } from "@/app/lib/use-current-user-profile";
import { useAppShellPreference } from "@/app/lib/use-app-shell-preference";
import type { OneEyrieTheme } from "@/app/lib/one-eyrie-theme";
import type { AppShell } from "@/app/lib/viewport-interface";

type OneEyrieUserProfileMenuProps = {
  variant?: "sidebar" | "mobile" | "header";
};

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
      <div className="one-eyrie-profile-prefs__switches" role="group" aria-label="Display preferences">
        <OneEyrieIosSwitch
          checked={theme === "dark"}
          label="Dark Mode"
          icon={<Moon size={15} strokeWidth={1.8} />}
          onChange={(enabled) => onThemeSelect(enabled ? "dark" : "light")}
        />
        <OneEyrieIosSwitch
          checked={shell === "mobile"}
          label="Mobile Interface"
          icon={<Smartphone size={15} strokeWidth={1.8} />}
          onChange={(enabled) => onInterfaceSelect(enabled ? "mobile" : "desktop")}
        />
      </div>

      <div className="one-eyrie-user-profile-menu__divider" role="separator" />

      <button
        type="button"
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
  const { theme, setTheme } = useOneEyrieTheme();
  const { profile, loading } = useCurrentUserProfile();
  const { shell, setPreferredShell } = useAppShellPreference();
  const [open, setOpen] = useState(false);

  const displayName = profile?.displayName ?? "User";
  const jobTitle = profile?.jobTitle ?? "Team Member";
  const initials = profile?.initials ?? "U";

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
        aria-haspopup="true"
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
          className="one-eyrie-user-profile-menu__dropdown"
          aria-label="User menu"
        >
          <ProfilePreferencePanel
            theme={theme}
            shell={shell}
            onThemeSelect={setTheme}
            onInterfaceSelect={setPreferredShell}
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
