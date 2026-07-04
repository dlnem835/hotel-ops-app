import React from "react";
import { FLAT_RED, FOREST, ONE_EYRIE } from "./oneEyrieColors";

/**
 * One Eyrie button language (desktop action buttons):
 * - START_WORK (green filled): Add Item, New Work Order, Start Inspection
 * - GOLD_OUTLINE: New Draft, Save Draft, Duplicate Template
 * - GOLD_FILLED (commit): Post, Complete PM, Save Changes, Send Label
 * - NEUTRAL (gray): Discard, Cancel, Close, Back
 * Filter/toggle controls (VR/SO, Today, All, etc.) stay segmented — not action buttons.
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "warning"
  | "danger"
  | "icon"
  | "commit"
  | "neutral";

/** @deprecated Use ButtonVariant — kept for existing imports */
export type GoldButtonVariant = "primary" | "secondary" | "icon";

/** Shared dimensions for standard action buttons */
export const ONE_EYRIE_BTN_METRICS = {
  radius: "12px",
  heightLg: "46px",
  heightMd: "42px",
  paddingXLg: "0 18px",
  paddingXMd: "0 18px",
  fontSizeLg: "14px",
  fontSizeMd: "13px",
  fontWeightLg: 800,
  fontWeightMd: 700,
  gapLg: "8px",
  gapMd: "6px",
  transition: "opacity 0.18s ease, border-color 0.18s ease, background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
} as const;

export const BUTTON_BASE: React.CSSProperties = {
  transition: ONE_EYRIE_BTN_METRICS.transition,
  cursor: "pointer",
  boxSizing: "border-box",
};

/** @deprecated Alias for BUTTON_BASE */
export const SETTINGS_BUTTON_BASE = BUTTON_BASE;

export const SETTINGS_CARD_TRANSITION =
  "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease";

const actionButtonLayoutLg: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: ONE_EYRIE_BTN_METRICS.gapLg,
  minHeight: ONE_EYRIE_BTN_METRICS.heightLg,
  height: ONE_EYRIE_BTN_METRICS.heightLg,
  padding: ONE_EYRIE_BTN_METRICS.paddingXLg,
  borderRadius: ONE_EYRIE_BTN_METRICS.radius,
  fontWeight: ONE_EYRIE_BTN_METRICS.fontWeightLg,
  fontSize: ONE_EYRIE_BTN_METRICS.fontSizeLg,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

const actionButtonLayoutMd: React.CSSProperties = {
  ...actionButtonLayoutLg,
  gap: ONE_EYRIE_BTN_METRICS.gapMd,
  minHeight: ONE_EYRIE_BTN_METRICS.heightMd,
  height: ONE_EYRIE_BTN_METRICS.heightMd,
  padding: ONE_EYRIE_BTN_METRICS.paddingXMd,
  fontWeight: ONE_EYRIE_BTN_METRICS.fontWeightMd,
  fontSize: ONE_EYRIE_BTN_METRICS.fontSizeMd,
};

/** Green filled — start/create work (Add Item, New Work Order, Start Inspection) */
export const START_WORK_BUTTON: React.CSSProperties = {
  ...BUTTON_BASE,
  ...actionButtonLayoutLg,
  background: FOREST.bg,
  border: `1px solid ${FOREST.border}`,
  color: FOREST.text,
};

/** @deprecated Prefer START_WORK_BUTTON */
export const PRIMARY_BUTTON = START_WORK_BUTTON;

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

/** Gold outline — draft/secondary (New Draft, Save Draft, Duplicate Template) */
export const GOLD_OUTLINE_BUTTON: React.CSSProperties = {
  ...BUTTON_BASE,
  ...actionButtonLayoutLg,
  background: "transparent",
  border: `1px solid ${ONE_EYRIE.gold}`,
  color: ONE_EYRIE.gold,
};

/** @deprecated Prefer GOLD_OUTLINE_BUTTON */
export const WARNING_BUTTON = GOLD_OUTLINE_BUTTON;

/** Compact gold outline for inline composer toolbars */
export const GOLD_OUTLINE_ACTION_BUTTON: React.CSSProperties = {
  ...BUTTON_BASE,
  ...actionButtonLayoutMd,
  background: "transparent",
  border: `1px solid ${ONE_EYRIE.gold}`,
  color: ONE_EYRIE.gold,
};

/** Gold filled — commit/finish (Post, Complete PM, Save Changes, Send Label) */
export const GOLD_FILLED_BUTTON: React.CSSProperties = {
  ...BUTTON_BASE,
  ...actionButtonLayoutMd,
  background: ONE_EYRIE.gold,
  border: `1px solid ${ONE_EYRIE.gold}`,
  color: "#111111",
};

/** @deprecated Prefer GOLD_FILLED_BUTTON */
export const COMMIT_BUTTON = GOLD_FILLED_BUTTON;

/** Header-sized gold commit button */
export const GOLD_FILLED_HEADER_BUTTON: React.CSSProperties = {
  ...BUTTON_BASE,
  ...actionButtonLayoutLg,
  background: ONE_EYRIE.gold,
  border: `1px solid ${ONE_EYRIE.gold}`,
  color: "#111111",
};

/** Gray — cancel/discard/neutral (Discard, Cancel, Close, Back) */
export const NEUTRAL_BUTTON: React.CSSProperties = {
  ...BUTTON_BASE,
  ...actionButtonLayoutMd,
  background: "#35322E",
  border: "1px solid #5A534C",
  color: "#C4BEB4",
};

export const SECONDARY_BUTTON: React.CSSProperties = {
  ...BUTTON_BASE,
  ...actionButtonLayoutLg,
  background: ONE_EYRIE.surfaceInset,
  border: `1px solid ${ONE_EYRIE.border}`,
  color: ONE_EYRIE.text,
};

export const DANGER_BUTTON: React.CSSProperties = {
  ...BUTTON_BASE,
  ...actionButtonLayoutLg,
  background: FLAT_RED.bg,
  border: `1px solid ${FLAT_RED.border}`,
  color: FLAT_RED.text,
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

export function goldFilledHoverHandlers(
  disabled = false
): Pick<React.HTMLAttributes<HTMLElement>, "onMouseEnter" | "onMouseLeave"> {
  if (disabled) return {};

  return {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = ONE_EYRIE.goldLight;
      e.currentTarget.style.borderColor = ONE_EYRIE.goldLight;
      e.currentTarget.style.boxShadow = "0 6px 18px rgba(200, 169, 106, 0.38)";
      e.currentTarget.style.transform = "translateY(-1px)";
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = ONE_EYRIE.gold;
      e.currentTarget.style.borderColor = ONE_EYRIE.gold;
      e.currentTarget.style.boxShadow = "none";
      e.currentTarget.style.transform = "translateY(0)";
    },
  };
}

export function neutralHoverHandlers(
  disabled = false
): Pick<React.HTMLAttributes<HTMLElement>, "onMouseEnter" | "onMouseLeave"> {
  if (disabled) return {};

  return {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = "#3D3934";
      e.currentTarget.style.borderColor = "#6A635C";
      e.currentTarget.style.transform = "translateY(-1px)";
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = "#35322E";
      e.currentTarget.style.borderColor = "#5A534C";
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
    case "commit":
      return goldFilledHoverHandlers(disabled);
    case "neutral":
      return neutralHoverHandlers(disabled);
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
