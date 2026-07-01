import type { CSSProperties } from "react";

/** Desktop text field class — visual styles live in one-eyrie-shell.css (@media min-width 769px). */
export const ONE_EYRIE_FIELD_CLASS = "one-eyrie-field";

export const ONE_EYRIE_FIELD_COMPACT_CLASS = "one-eyrie-field one-eyrie-field--compact";

/** Layout-only props; do not set background/border here (CSS owns appearance). */
export const ONE_EYRIE_FIELD_LAYOUT: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};
