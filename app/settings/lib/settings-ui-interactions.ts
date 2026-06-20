import React from "react";
import { GOLD } from "./buildings-areas";

export type GoldButtonVariant = "primary" | "secondary" | "icon";

export const SETTINGS_BUTTON_BASE: React.CSSProperties = {
  transition: "all 0.18s ease",
  cursor: "pointer",
};

export const SETTINGS_CARD_TRANSITION =
  "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease";

export function applyGoldHover(
  e: React.MouseEvent<HTMLElement>,
  variant: GoldButtonVariant
) {
  if (variant === "primary") {
    e.currentTarget.style.boxShadow = "0 0 16px rgba(200,169,106,0.4)";
    e.currentTarget.style.borderColor = "#E0C47B";
    e.currentTarget.style.transform = "translateY(-1px)";
    return;
  }

  if (variant === "secondary") {
    e.currentTarget.style.boxShadow = "0 0 14px rgba(200,169,106,0.3)";
    e.currentTarget.style.borderColor = "#E0C47B";
    e.currentTarget.style.transform = "translateY(-1px)";
    return;
  }

  e.currentTarget.style.color = GOLD;
  e.currentTarget.style.boxShadow = "0 0 10px rgba(200,169,106,0.25)";
}

export function resetButtonHover(
  e: React.MouseEvent<HTMLElement>,
  variant: GoldButtonVariant
) {
  e.currentTarget.style.boxShadow = "none";
  e.currentTarget.style.transform = "translateY(0)";

  if (variant === "primary") {
    e.currentTarget.style.borderColor = "#E0C47B";
    return;
  }

  if (variant === "secondary") {
    e.currentTarget.style.borderColor = GOLD;
    return;
  }

  e.currentTarget.style.color = "#FFFFFF";
}

export function goldHoverHandlers(
  variant: GoldButtonVariant,
  disabled = false
): Pick<React.HTMLAttributes<HTMLElement>, "onMouseEnter" | "onMouseLeave"> {
  if (disabled) return {};

  return {
    onMouseEnter: (e) => applyGoldHover(e as React.MouseEvent<HTMLElement>, variant),
    onMouseLeave: (e) => resetButtonHover(e as React.MouseEvent<HTMLElement>, variant),
  };
}

export function applySettingsCardHover(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "translateY(-2px)";
  e.currentTarget.style.boxShadow = "0 0 12px rgba(200,169,106,0.22)";
  e.currentTarget.style.borderColor = GOLD;
}

export function resetSettingsCardHover(
  e: React.MouseEvent<HTMLElement>,
  defaultBorder = "#3A352E"
) {
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "none";
  e.currentTarget.style.borderColor = defaultBorder;
}

export function settingsCardHoverHandlers(
  defaultBorder = "#3A352E"
): Pick<React.HTMLAttributes<HTMLElement>, "onMouseEnter" | "onMouseLeave"> {
  return {
    onMouseEnter: applySettingsCardHover,
    onMouseLeave: (e) => resetSettingsCardHover(e, defaultBorder),
  };
}
