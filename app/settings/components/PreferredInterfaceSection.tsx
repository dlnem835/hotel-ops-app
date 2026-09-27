"use client";

import { useOneEyrieTheme } from "@/app/components/ThemeProvider";
import type { OneEyrieTheme } from "@/app/lib/one-eyrie-theme";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";

const OPTIONS: { value: OneEyrieTheme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

export default function PreferredInterfaceSection({
  panelStyle,
}: {
  panelStyle: React.CSSProperties;
}) {
  const { theme, setTheme } = useOneEyrieTheme();

  return (
    <div style={panelStyle}>
      <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
        Theme
      </div>
      <div
        style={{
          color: ONE_EYRIE.textMuted,
          fontSize: "13px",
          marginTop: "6px",
          marginBottom: "16px",
        }}
      >
        Dark is the default. Light applies the approved Light Mode theme.
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}
        role="group"
        aria-label="Theme"
      >
        {OPTIONS.map((option) => {
          const selected = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setTheme(option.value)}
              style={{
                minHeight: "46px",
                borderRadius: "12px",
                border: `1px solid ${selected ? ONE_EYRIE.gold : ONE_EYRIE.border}`,
                background: selected ? "rgba(200, 169, 106, 0.14)" : "#1A1815",
                color: selected ? ONE_EYRIE.gold : ONE_EYRIE.text,
                fontWeight: 800,
                fontSize: "15px",
                cursor: "pointer",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
