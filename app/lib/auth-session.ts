"use client";

import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/app/supabaseClient";

const INITIAL_TIMEOUT_MS = 5000;

let initialResolved = false;
let initialSession: Session | null = null;
let initialPromise: Promise<Session | null> | null = null;
const subscribers = new Set<(session: Session | null) => void>();

function notifySubscribers(session: Session | null) {
  subscribers.forEach((listener) => {
    try {
      listener(session);
    } catch (error) {
      console.error("Auth subscriber failed:", error);
    }
  });
}

function resolveInitial(session: Session | null) {
  initialSession = session;

  if (initialResolved) {
    notifySubscribers(session);
    return;
  }

  initialResolved = true;
  notifySubscribers(session);
}

function bootstrapAuthListener() {
  if (initialPromise) return;

  initialPromise = new Promise<Session | null>((resolve) => {
    let settled = false;

    const settle = (session: Session | null) => {
      if (settled) return;
      settled = true;
      resolveInitial(session);
      resolve(session);
    };

    const timeoutId = window.setTimeout(() => {
      settle(initialSession);
    }, INITIAL_TIMEOUT_MS);

    try {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "INITIAL_SESSION") {
          window.clearTimeout(timeoutId);
          settle(session);
          return;
        }

        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          window.clearTimeout(timeoutId);
          initialSession = session;

          if (!settled) {
            settle(session);
          } else {
            notifySubscribers(session);
          }
          return;
        }

        if (event === "SIGNED_OUT") {
          initialSession = null;
          notifySubscribers(null);
        }
      });

      void subscription;
    } catch (error) {
      window.clearTimeout(timeoutId);
      console.error("Auth listener registration failed:", error);
      settle(null);
    }
  });
}

/** Call with the session returned from signInWithPassword before navigating away. */
export function applySignedInSession(session: Session | null): void {
  if (!session) return;

  bootstrapAuthListener();
  initialSession = session;

  if (!initialResolved) {
    resolveInitial(session);
    return;
  }

  notifySubscribers(session);
}

export function waitForInitialAuthSession(): Promise<Session | null> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  bootstrapAuthListener();

  if (initialResolved) {
    return Promise.resolve(initialSession);
  }

  return initialPromise!;
}

export function subscribeAuthSession(
  listener: (session: Session | null) => void
): () => void {
  bootstrapAuthListener();
  subscribers.add(listener);

  if (initialResolved) {
    listener(initialSession);
  }

  return () => {
    subscribers.delete(listener);
  };
}

/** Apply the session from signInWithPassword before navigating away. */
export function confirmPersistedSession(session: Session | null): Session | null {
  if (!session) return null;
  applySignedInSession(session);
  return session;
}
