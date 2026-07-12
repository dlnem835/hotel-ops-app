"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { signOutAndRedirect } from "@/app/lib/auth";
import { useOneEyrieTheme } from "@/app/components/ThemeProvider";
import { useCurrentUserProfile } from "@/app/lib/use-current-user-profile";
import type { OneEyrieTheme } from "@/app/lib/one-eyrie-theme";
import type { UserMenuItem } from "@/app/components/user-menu/types";

type OneEyrieUserProfileMenuProps = {
  variant?: "sidebar" | "mobile";
};

function buildMenuItems(
  theme: OneEyrieTheme,
  setTheme: (theme: OneEyrieTheme) => void
): UserMenuItem[] {
  return [
    {
      type: "appearance",
      id: "appearance",
      label: "Appearance",
      value: theme,
      onChange: setTheme,
      options: [
        { value: "dark", label: "Dark", description: "Production" },
        { value: "light", label: "Light", description: "Admin preview" },
      ],
    },
    {
      type: "action",
      id: "my-account",
      label: "My Account",
      hint: "Coming soon",
      disabled: true,
      onClick: () => {},
    },
    { type: "divider", id: "before-logout" },
    {
      type: "action",
      id: "logout",
      label: "Logout",
      onClick: () => void signOutAndRedirect(),
    },
  ];
}

export default function OneEyrieUserProfileMenu({
  variant = "sidebar",
}: OneEyrieUserProfileMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme, canUseLightMode } = useOneEyrieTheme();
  const { profile, loading } = useCurrentUserProfile();
  const [open, setOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  const displayName = profile?.displayName ?? "User";
  const jobTitle = profile?.jobTitle ?? "Team Member";
  const initials = profile?.initials ?? "U";
  const menuItems = buildMenuItems(theme, setTheme).filter(
    (item) => item.type !== "appearance" || canUseLightMode
  );

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setAppearanceOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setAppearanceOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function toggleOpen() {
    setOpen((current) => {
      if (current) setAppearanceOpen(false);
      return !current;
    });
  }

  function handleThemeSelect(next: OneEyrieTheme) {
    setTheme(next);
    setAppearanceOpen(false);
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={`one-eyrie-user-profile-menu one-eyrie-user-profile-menu--${variant}`}
    >
      <button
        type="button"
        className="one-eyrie-user-profile-menu__trigger"
        onClick={toggleOpen}
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
          {menuItems.map((item) => {
            if (item.type === "divider") {
              return <div key={item.id} className="one-eyrie-user-profile-menu__divider" role="separator" />;
            }

            if (item.type === "appearance") {
              return (
                <div key={item.id} className="one-eyrie-user-profile-menu__section">
                  <button
                    type="button"
                    role="menuitem"
                    className="one-eyrie-user-profile-menu__item one-eyrie-user-profile-menu__item--submenu"
                    onClick={() => setAppearanceOpen((current) => !current)}
                    aria-expanded={appearanceOpen}
                  >
                    <span>{item.label}</span>
                    <ChevronRight
                      size={15}
                      className={`one-eyrie-user-profile-menu__submenu-chevron${appearanceOpen ? " one-eyrie-user-profile-menu__submenu-chevron--open" : ""}`}
                      aria-hidden
                    />
                  </button>

                  {appearanceOpen ? (
                    <div className="one-eyrie-user-profile-menu__submenu" role="group" aria-label="Appearance">
                      {item.options.map((option) => {
                        const selected = item.value === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={selected}
                            className={`one-eyrie-user-profile-menu__item one-eyrie-user-profile-menu__item--option${selected ? " one-eyrie-user-profile-menu__item--selected" : ""}`}
                            onClick={() => handleThemeSelect(option.value)}
                          >
                            <span className="one-eyrie-user-profile-menu__option-label">
                              {option.label}
                              {option.description ? (
                                <span className="one-eyrie-user-profile-menu__option-hint">
                                  {" "}
                                  ({option.description})
                                </span>
                              ) : null}
                            </span>
                            {selected ? (
                              <span className="one-eyrie-user-profile-menu__check" aria-hidden>
                                ●
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className="one-eyrie-user-profile-menu__item"
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick();
                  setOpen(false);
                  setAppearanceOpen(false);
                }}
                disabled={item.disabled}
              >
                <span>{item.label}</span>
                {item.hint ? (
                  <span className="one-eyrie-user-profile-menu__hint">{item.hint}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
