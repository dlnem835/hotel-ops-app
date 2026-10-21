"use client";

import OneEyrieSegmentedToggle from "@/app/components/OneEyrieSegmentedToggle";
import { useOneEyrieTheme } from "@/app/components/ThemeProvider";
import { useAppShellPreference } from "@/app/lib/use-app-shell-preference";
import type { OneEyrieTheme } from "@/app/lib/one-eyrie-theme";
import type { AppShell } from "@/app/lib/viewport-interface";

const THEME_OPTIONS: { value: OneEyrieTheme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const SHELL_OPTIONS: { value: AppShell; label: string }[] = [
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
];

export default function PreferredInterfaceSection() {
  const { theme, setTheme } = useOneEyrieTheme();
  const { shell, setPreferredShell } = useAppShellPreference();

  return (
    <section className="one-eyrie-settings-appearance" aria-label="Appearance and interface">
      <div className="one-eyrie-settings-appearance__group">
        <div className="one-eyrie-settings-appearance__title">Theme</div>
        <p className="one-eyrie-settings-appearance__lead">
          Dark is the default. Light applies the approved Light Mode theme.
        </p>
        <OneEyrieSegmentedToggle
          value={theme}
          options={THEME_OPTIONS}
          onChange={setTheme}
          ariaLabel="Theme"
        />
      </div>

      <div className="one-eyrie-settings-appearance__group">
        <div className="one-eyrie-settings-appearance__title">Interface</div>
        <p className="one-eyrie-settings-appearance__lead">
          Desktop and Mobile stay the same shells. This only chooses which one opens.
        </p>
        <OneEyrieSegmentedToggle
          value={shell}
          options={SHELL_OPTIONS}
          onChange={setPreferredShell}
          ariaLabel="Interface"
        />
      </div>
    </section>
  );
}
