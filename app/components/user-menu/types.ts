import type { OneEyrieTheme } from "@/app/lib/one-eyrie-theme";
import type { InterfacePreference } from "@/app/lib/viewport-interface";

export type UserMenuAppearanceOption = {
  value: OneEyrieTheme;
  label: string;
  description?: string;
};

export type UserMenuInterfaceOption = {
  value: InterfacePreference;
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

export type UserMenuInterfaceItem = {
  type: "interface";
  id: "interface";
  label: string;
  options: UserMenuInterfaceOption[];
  value: InterfacePreference;
  onChange: (value: InterfacePreference) => void;
};

export type UserMenuDivider = {
  type: "divider";
  id: string;
};

export type UserMenuItem =
  | UserMenuActionItem
  | UserMenuAppearanceItem
  | UserMenuInterfaceItem
  | UserMenuDivider;

/** Reserved IDs for future menu entries (notifications, password, about, version, language). */
export const USER_MENU_FUTURE_ITEM_IDS = [
  "notifications",
  "change-password",
  "about",
  "version",
  "language",
] as const;
