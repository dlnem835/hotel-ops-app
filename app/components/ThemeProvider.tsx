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
import {
  applyThemeToDocument,
  ONE_EYRIE_DEFAULT_THEME,
  persistTheme,
  readStoredTheme,
  type OneEyrieTheme,
} from "@/app/lib/one-eyrie-theme";

type ThemeContextValue = {
  theme: OneEyrieTheme;
  setTheme: (theme: OneEyrieTheme) => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: ONE_EYRIE_DEFAULT_THEME,
  setTheme: () => {},
  ready: false,
});

export function useOneEyrieTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<OneEyrieTheme>(ONE_EYRIE_DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyThemeToDocument(stored);
    setReady(true);
  }, []);

  const setTheme = useCallback((next: OneEyrieTheme) => {
    setThemeState(next);
    persistTheme(next);
    applyThemeToDocument(next);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      ready,
    }),
    [theme, setTheme, ready]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
