import type { OneEyrieTheme } from "@/app/lib/one-eyrie-theme";

export type UserMenuAppearanceOption = {
  value: OneEyrieTheme;
  label: string;
  description?: string;
};

export type UserMenuActionItem = {
  type: "action";
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
};

export type UserMenuAppearanceItem = {
  type: "appearance";
  id: "appearance";
  label: string;
  options: UserMenuAppearanceOption[];
  value: OneEyrieTheme;
  onChange: (value: OneEyrieTheme) => void;
};

export type UserMenuDivider = {
  type: "divider";
  id: string;
};

export type UserMenuItem =
  | UserMenuActionItem
  | UserMenuAppearanceItem
  | UserMenuDivider;

/** Reserved IDs for future menu entries (notifications, password, about, version, language). */
export const USER_MENU_FUTURE_ITEM_IDS = [
  "notifications",
  "change-password",
  "about",
  "version",
  "language",
] as const;
