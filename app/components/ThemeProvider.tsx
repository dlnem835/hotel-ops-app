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
import { subscribeAuthSession } from "@/app/lib/auth-session";
import { fetchLightModeAccess } from "@/app/lib/theme/light-mode-client";
import {
  applyThemeToDocument,
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
  const [sessionResolved, setSessionResolved] = useState(false);
  const [lightModeAllowed, setLightModeAllowed] = useState(false);
  const [theme, setThemeState] = useState<OneEyrieTheme>(ONE_EYRIE_DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const unsubscribe = subscribeAuthSession((session) => {
      if (!session) {
        // No session → force Dark and ignore any stored light preference.
        if (active) {
          setLightModeAllowed(false);
          setSessionResolved(true);
        }
        return;
      }

      // Revalidate permission server-side on every session load.
      void fetchLightModeAccess().then((allowed) => {
        if (!active) return;
        setLightModeAllowed(allowed);
        setSessionResolved(true);
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionResolved) {
      applyThemeToDocument(ONE_EYRIE_DEFAULT_THEME);
      setThemeState(ONE_EYRIE_DEFAULT_THEME);
      return;
    }

    const stored = readStoredTheme();
    const effective = resolveEffectiveTheme(stored, lightModeAllowed);
    setThemeState(effective);
    applyThemeToDocument(effective);
    setReady(true);
  }, [sessionResolved, lightModeAllowed]);

  const setTheme = useCallback(
    (next: OneEyrieTheme) => {
      const effective = resolveEffectiveTheme(next, lightModeAllowed);
      setThemeState(effective);
      persistTheme(effective);
      applyThemeToDocument(effective);
    },
    [lightModeAllowed]
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
