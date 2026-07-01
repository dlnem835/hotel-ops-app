import React from "react";
import { ONE_EYRIE } from "./oneEyrieColors";

/** Shared app shell typography — matches Inspections / Settings */
export const ONE_EYRIE_FONT =
  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";

export const APP_SHELL_CLASS = "one-eyrie-app-shell";
export const MAIN_CONTENT_CLASS = "one-eyrie-main-content";

export const APP_SHELL: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  background: ONE_EYRIE.black,
  color: ONE_EYRIE.text,
  fontFamily: ONE_EYRIE_FONT,
};

export const MAIN_CONTENT: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "34px 40px",
  overflowX: "hidden",
  overflowY: "auto",
};

export const PAGE_HEADER_ROW: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "24px",
  gap: "12px 16px",
};

export const PAGE_TITLE: React.CSSProperties = {
  margin: 0,
  fontSize: "30px",
  fontWeight: 800,
  lineHeight: 1.2,
};

export const PAGE_SUBTITLE: React.CSSProperties = {
  margin: "6px 0 0",
  color: ONE_EYRIE.textSubtle,
  fontSize: "16px",
  lineHeight: 1.45,
  fontWeight: 400,
};

export const SECTION_TITLE: React.CSSProperties = {
  ...PAGE_TITLE,
};

export const SECTION_SUBTITLE: React.CSSProperties = {
  ...PAGE_SUBTITLE,
  color: ONE_EYRIE.textMuted,
};
