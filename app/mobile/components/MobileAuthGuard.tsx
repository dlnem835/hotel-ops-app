"use client";

import { useEffect, useRef, useState } from "react";
import {
  subscribeAuthSession,
  waitForInitialAuthSession,
} from "@/app/lib/auth-session";
import { loginUrlWithNext } from "@/app/lib/login-return";

type MobileAuthGuardProps = {
  children: React.ReactNode;
};

function loginUrlWithReturn(): string {
  const path = `${window.location.pathname}${window.location.search}`;
  return loginUrlWithNext(path);
}

export default function MobileAuthGuard({ children }: MobileAuthGuardProps) {
  const [ready, setReady] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    function finish(hasSession: boolean) {
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;

      if (hasSession) {
        setReady(true);
      } else {
        window.location.replace(loginUrlWithReturn());
      }
    }

    const unsubscribe = subscribeAuthSession((session) => {
      if (cancelled) return;

      if (session && !finishedRef.current) {
        finish(true);
        return;
      }

      if (!session && finishedRef.current) {
        window.location.replace(loginUrlWithReturn());
      }
    });

    void waitForInitialAuthSession().then((session) => {
      finish(Boolean(session));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <div className="one-eyrie-mobile__inner">
        <div className="one-eyrie-mobile-status">Checking session…</div>
      </div>
    );
  }

  return <>{children}</>;
}
