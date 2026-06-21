import React from "react";
import { FLAT_RED, FOREST, ONE_EYRIE } from "./oneEyrieColors";

export type ButtonVariant = "primary" | "secondary" | "warning" | "danger" | "icon";

/** @deprecated Use ButtonVariant — kept for existing imports */
export type GoldButtonVariant = "primary" | "secondary" | "icon";

export const BUTTON_BASE: React.CSSProperties = {
  transition: "all 0.18s ease",
  cursor: "pointer",
};

/** @deprecated Alias for BUTTON_BASE */
export const SETTINGS_BUTTON_BASE = BUTTON_BASE;

export const SETTINGS_CARD_TRANSITION =
  "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease";

export const PRIMARY_BUTTON: React.CSSProperties = {
  ...BUTTON_BASE,
  background: FOREST.bg,
  border: `1px solid ${FOREST.border}`,
  color: FOREST.text,
  borderRadius: "12px",
  padding: "0 18px",
  height: "46px",
  fontWeight: 800,
  fontSize: "14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
};

/** Forest green outline — matches Priority Queue “Inspect” actions */
export const FOREST_OUTLINE_BUTTON: React.CSSProperties = {
  ...BUTTON_BASE,
  background: "transparent",
  border: `1px solid ${FOREST.border}`,
  color: FOREST.text,
  borderRadius: "8px",
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  whiteSpace: "nowrap",
};

export const SECONDARY_BUTTON: React.CSSProperties = {
  ...BUTTON_BASE,
  background: ONE_EYRIE.surfaceInset,
  border: `1px solid ${ONE_EYRIE.border}`,
  color: ONE_EYRIE.text,
  borderRadius: "12px",
  padding: "0 18px",
  height: "46px",
  fontWeight: 800,
  fontSize: "14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
};

export const WARNING_BUTTON: React.CSSProperties = {
  ...BUTTON_BASE,
  background: "transparent",
  border: `1px solid ${ONE_EYRIE.gold}`,
  color: ONE_EYRIE.gold,
  borderRadius: "12px",
  padding: "0 18px",
  height: "46px",
  fontWeight: 800,
  fontSize: "14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
};

export const DANGER_BUTTON: React.CSSProperties = {
  ...BUTTON_BASE,
  background: FLAT_RED.bg,
  border: `1px solid ${FLAT_RED.border}`,
  color: FLAT_RED.text,
  borderRadius: "12px",
  padding: "0 18px",
  height: "46px",
  fontWeight: 800,
  fontSize: "14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
};

export function forestHoverHandlers(
  disabled = false
): Pick<React.HTMLAttributes<HTMLElement>, "onMouseEnter" | "onMouseLeave"> {
  if (disabled) return {};

  return {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = "#234A38";
      e.currentTarget.style.boxShadow = "0 0 16px rgba(61, 107, 79, 0.45)";
      e.currentTarget.style.borderColor = "#4D8B66";
      e.currentTarget.style.transform = "translateY(-1px)";
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = FOREST.bg;
      e.currentTarget.style.boxShadow = "none";
      e.currentTarget.style.borderColor = FOREST.border;
      e.currentTarget.style.transform = "translateY(0)";
    },
  };
}

export function forestOutlineHoverHandlers(
  disabled = false
): Pick<React.HTMLAttributes<HTMLElement>, "onMouseEnter" | "onMouseLeave"> {
  if (disabled) return {};

  return {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = FOREST.bgSoft;
      e.currentTarget.style.boxShadow = "0 0 14px rgba(61, 107, 79, 0.35)";
      e.currentTarget.style.borderColor = "#4D8B66";
      e.currentTarget.style.transform = "translateY(-1px)";
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = "transparent";
      e.currentTarget.style.boxShadow = "none";
      e.currentTarget.style.borderColor = FOREST.border;
      e.currentTarget.style.transform = "translateY(0)";
    },
  };
}

export function secondaryHoverHandlers(
  disabled = false
): Pick<React.HTMLAttributes<HTMLElement>, "onMouseEnter" | "onMouseLeave"> {
  if (disabled) return {};

  return {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = ONE_EYRIE.row;
      e.currentTarget.style.boxShadow = "0 0 14px rgba(58, 53, 46, 0.35)";
      e.currentTarget.style.borderColor = ONE_EYRIE.goldLight;
      e.currentTarget.style.transform = "translateY(-1px)";
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = ONE_EYRIE.surfaceInset;
      e.currentTarget.style.boxShadow = "none";
      e.currentTarget.style.borderColor = ONE_EYRIE.border;
      e.currentTarget.style.transform = "translateY(0)";
    },
  };
}

export function dangerHoverHandlers(
  disabled = false
): Pick<React.HTMLAttributes<HTMLElement>, "onMouseEnter" | "onMouseLeave"> {
  if (disabled) return {};

  return {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = "#2A1818";
      e.currentTarget.style.boxShadow = "0 0 14px rgba(139, 82, 82, 0.35)";
      e.currentTarget.style.borderColor = "#A86868";
      e.currentTarget.style.transform = "translateY(-1px)";
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = FLAT_RED.bg;
      e.currentTarget.style.boxShadow = "none";
      e.currentTarget.style.borderColor = FLAT_RED.border;
      e.currentTarget.style.transform = "translateY(0)";
    },
  };
}

export function applyGoldHover(
  e: React.MouseEvent<HTMLElement>,
  variant: GoldButtonVariant
) {
  if (variant === "primary") {
    e.currentTarget.style.boxShadow = "0 0 16px rgba(200,169,106,0.4)";
    e.currentTarget.style.borderColor = ONE_EYRIE.goldLight;
    e.currentTarget.style.transform = "translateY(-1px)";
    return;
  }

  if (variant === "secondary") {
    e.currentTarget.style.boxShadow = "0 0 14px rgba(200,169,106,0.3)";
    e.currentTarget.style.borderColor = ONE_EYRIE.goldLight;
    e.currentTarget.style.transform = "translateY(-1px)";
    return;
  }

  e.currentTarget.style.color = ONE_EYRIE.gold;
  e.currentTarget.style.boxShadow = "0 0 10px rgba(200,169,106,0.25)";
}

export function resetButtonHover(
  e: React.MouseEvent<HTMLElement>,
  variant: GoldButtonVariant
) {
  e.currentTarget.style.boxShadow = "none";
  e.currentTarget.style.transform = "translateY(0)";

  if (variant === "primary") {
    e.currentTarget.style.borderColor = ONE_EYRIE.goldLight;
    return;
  }

  if (variant === "secondary") {
    e.currentTarget.style.borderColor = ONE_EYRIE.gold;
    return;
  }

  e.currentTarget.style.color = ONE_EYRIE.text;
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

export function buttonHoverHandlers(
  variant: ButtonVariant,
  disabled = false
): Pick<React.HTMLAttributes<HTMLElement>, "onMouseEnter" | "onMouseLeave"> {
  switch (variant) {
    case "primary":
      return forestHoverHandlers(disabled);
    case "secondary":
      return secondaryHoverHandlers(disabled);
    case "warning":
      return goldHoverHandlers("secondary", disabled);
    case "danger":
      return dangerHoverHandlers(disabled);
    case "icon":
      return goldHoverHandlers("icon", disabled);
    default:
      return {};
  }
}

export function applySettingsCardHover(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "translateY(-2px)";
  e.currentTarget.style.boxShadow = "0 0 12px rgba(200,169,106,0.22)";
  e.currentTarget.style.borderColor = ONE_EYRIE.gold;
}

export function resetSettingsCardHover(
  e: React.MouseEvent<HTMLElement>,
  defaultBorder = ONE_EYRIE.border
) {
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "none";
  e.currentTarget.style.borderColor = defaultBorder;
}

export function settingsCardHoverHandlers(
  defaultBorder = ONE_EYRIE.border
): Pick<React.HTMLAttributes<HTMLElement>, "onMouseEnter" | "onMouseLeave"> {
  return {
    onMouseEnter: applySettingsCardHover,
    onMouseLeave: (e) => resetSettingsCardHover(e, defaultBorder),
  };
}
