"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  subscribeAuthSession,
  waitForInitialAuthSession,
} from "@/app/lib/auth-session";
import { isMobilePath } from "@/app/lib/auth";
import { supabase } from "@/app/supabaseClient";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  ONE_EYRIE_MODAL_BOX,
  ONE_EYRIE_MODAL_OVERLAY,
} from "@/app/lib/one-eyrie-modal-styles";
import {
  forestHoverHandlers,
  PRIMARY_BUTTON,
  secondaryHoverHandlers,
  SECONDARY_BUTTON,
} from "@/app/lib/oneEyrieButtons";
import {
  INACTIVITY_ACTIVITY_EVENTS,
  INACTIVITY_ACTIVITY_THROTTLE_MS,
  INACTIVITY_LOGOUT_MS,
  INACTIVITY_WARNING_MS,
  storeInactivityLogoutMessage,
} from "@/app/lib/inactivity-logout";

const PUBLIC_PATHS = new Set(["/login"]);

export default function InactivityGuard() {
  const pathname = usePathname();
  const isMobileRoute = isMobilePath(pathname);
  const [active, setActive] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);

  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);
  const lastResetRef = useRef(0);
  const loggingOutRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current !== null) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current !== null) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const performLogout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    clearTimers();
    setWarningOpen(false);

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Inactivity logout failed:", error);
    }

    storeInactivityLogoutMessage();
    window.location.href = "/login";
  }, [clearTimers]);

  const resetTimers = useCallback(() => {
    clearTimers();
    setWarningOpen(false);

    if (!active || PUBLIC_PATHS.has(pathname)) {
      return;
    }

    warningTimerRef.current = window.setTimeout(() => {
      setWarningOpen(true);
    }, INACTIVITY_WARNING_MS);

    logoutTimerRef.current = window.setTimeout(() => {
      void performLogout();
    }, INACTIVITY_LOGOUT_MS);
  }, [active, clearTimers, pathname, performLogout]);

  const handleActivity = useCallback(() => {
    if (!active || PUBLIC_PATHS.has(pathname) || loggingOutRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastResetRef.current < INACTIVITY_ACTIVITY_THROTTLE_MS) {
      return;
    }

    lastResetRef.current = now;
    resetTimers();
  }, [active, pathname, resetTimers]);

  useEffect(() => {
    if (isMobileRoute) {
      setActive(false);
      clearTimers();
      setWarningOpen(false);
      return;
    }

    let mounted = true;

    void waitForInitialAuthSession().then((session) => {
      if (!mounted) return;

      const shouldTrack = Boolean(session) && !PUBLIC_PATHS.has(pathname);
      setActive(shouldTrack);

      if (!shouldTrack) {
        clearTimers();
        setWarningOpen(false);
      }
    });

    const unsubscribe = subscribeAuthSession((session) => {
      if (!mounted) return;

      const shouldTrack = Boolean(session) && !PUBLIC_PATHS.has(pathname);
      setActive(shouldTrack);

      if (!shouldTrack) {
        clearTimers();
        setWarningOpen(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      clearTimers();
    };
  }, [pathname, clearTimers, isMobileRoute]);

  useEffect(() => {
    if (!active || PUBLIC_PATHS.has(pathname)) {
      return;
    }

    resetTimers();

    for (const eventName of INACTIVITY_ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }

    return () => {
      clearTimers();
      for (const eventName of INACTIVITY_ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
    };
  }, [active, pathname, handleActivity, resetTimers, clearTimers]);

  if (!warningOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-warning-title"
      style={{
        ...ONE_EYRIE_MODAL_OVERLAY,
        zIndex: 10000,
        padding: "20px",
      }}
    >
      <div
        style={{
          ...ONE_EYRIE_MODAL_BOX,
          width: "min(420px, 100%)",
        }}
      >
        <h2
          id="inactivity-warning-title"
          style={{
            margin: "0 0 10px",
            color: ONE_EYRIE.text,
            fontSize: "20px",
            fontWeight: 800,
          }}
        >
          Session expiring
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            color: ONE_EYRIE.textMuted,
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          You will be logged out in 2 minutes due to inactivity.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            style={SECONDARY_BUTTON}
            onClick={() => void performLogout()}
            {...secondaryHoverHandlers()}
          >
            Log out now
          </button>
          <button
            type="button"
            style={PRIMARY_BUTTON}
            onClick={resetTimers}
            {...forestHoverHandlers()}
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
