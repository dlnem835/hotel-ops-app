"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import MobilePassOnLogDetail from "../MobilePassOnLogDetail";
import { fetchPassOnEntry, PassOnEntry } from "../lib/pass-on-shared";

export default function MobilePassOnLogDetailPage() {
  const params = useParams<{ id: string }>();
  const entryId = Number(params?.id);
  const [entry, setEntry] = useState<PassOnEntry | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entryId) {
      setStatus("error");
      setError("Invalid entry.");
      return;
    }

    let cancelled = false;
    void fetchPassOnEntry(entryId)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setStatus("not-found");
          return;
        }
        setEntry(data);
        setStatus("ready");
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load entry");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [entryId]);

  if (status === "loading") {
    return (
      <div className="one-eyrie-mobile__inner">
        <div className="one-eyrie-mobile-status">Loading entry…</div>
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div className="one-eyrie-mobile__inner">
        <div className="one-eyrie-mobile-error">Pass-on entry not found.</div>
        <Link href="/mobile/pass-on-log" className="one-eyrie-mobile-back">
          ← Pass-On Log
        </Link>
      </div>
    );
  }

  if (status === "error" || !entry) {
    return (
      <div className="one-eyrie-mobile__inner">
        <div className="one-eyrie-mobile-error">{error || "Unable to load entry"}</div>
        <Link href="/mobile/pass-on-log" className="one-eyrie-mobile-back">
          ← Pass-On Log
        </Link>
      </div>
    );
  }

  return <MobilePassOnLogDetail entry={entry} />;
}
