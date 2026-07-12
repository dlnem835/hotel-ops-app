"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRoleAccess } from "@/app/components/RoleAccessProvider";
import {
  applyThemeToDocument,
  canUseLightMode,
  ONE_EYRIE_DEFAULT_THEME,
  persistTheme,
  readStoredTheme,
  resolveEffectiveTheme,
  type OneEyrieTheme,
} from "@/app/lib/one-eyrie-theme";

type ThemeContextValue = {
  theme: OneEyrieTheme;
  setTheme: (theme: OneEyrieTheme) => void;
  ready: boolean;
  /** True when the signed-in user may enable Light Mode (administrators during development). */
  canUseLightMode: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: ONE_EYRIE_DEFAULT_THEME,
  setTheme: () => {},
  ready: false,
  canUseLightMode: false,
});

export function useOneEyrieTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const { access, loading: accessLoading } = useRoleAccess();
  const [theme, setThemeState] = useState<OneEyrieTheme>(ONE_EYRIE_DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  const isAdministrator = Boolean(access?.isAdministrator);
  const lightModeAllowed = canUseLightMode(isAdministrator);

  useEffect(() => {
    if (accessLoading) {
      applyThemeToDocument(ONE_EYRIE_DEFAULT_THEME);
      setThemeState(ONE_EYRIE_DEFAULT_THEME);
      return;
    }

    const stored = readStoredTheme();
    const effective = resolveEffectiveTheme(stored, isAdministrator);
    setThemeState(effective);
    applyThemeToDocument(effective);
    setReady(true);
  }, [accessLoading, isAdministrator]);

  const setTheme = useCallback(
    (next: OneEyrieTheme) => {
      const effective = resolveEffectiveTheme(next, isAdministrator);
      setThemeState(effective);
      persistTheme(effective);
      applyThemeToDocument(effective);
    },
    [isAdministrator]
  );

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      ready,
      canUseLightMode: lightModeAllowed,
    }),
    [theme, setTheme, ready, lightModeAllowed]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
