"use client";

import { useEffect, useState } from "react";
import { OPERATIONAL_PHOTO_REFRESH_AFTER_MS } from "@/app/lib/storage/operational-photo-types";
import type { OperationalPhotoParent } from "@/app/lib/storage/operational-photo-types";
import { useOperationalPhotoParent } from "@/app/lib/storage/operational-photo-parent";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";

function isRefreshablePhotoUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  return (
    !value.startsWith("blob:") &&
    !value.startsWith("data:") &&
    (value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("org-") ||
      !value.includes("://"))
  );
}

export function useRefreshedPhotoUrl(
  src: string | null | undefined,
  parent?: OperationalPhotoParent | null
): string | null {
  const contextParent = useOperationalPhotoParent();
  const resolvedParent = parent ?? contextParent;
  const parentKey = resolvedParent
    ? `${resolvedParent.type}:${resolvedParent.id}`
    : "";
  const srcKey = src ?? null;
  const [override, setOverride] = useState<{
    from: string | null;
    to: string;
  } | null>(null);
  const displaySrc =
    override && override.from === srcKey ? override.to : srcKey;

  useEffect(() => {
    if (!isRefreshablePhotoUrl(srcKey)) return undefined;

    let cancelled = false;

    async function refresh() {
      if (!isRefreshablePhotoUrl(srcKey)) return;
      try {
        const response = await tenantFetch(
          "/api/storage/operational-photo/refresh",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              photoUrl: srcKey,
              parent: resolvedParent,
            }),
          }
        );
        const payload = (await response.json().catch(() => null)) as {
          photoUrl?: string;
        } | null;
        if (!cancelled && response.ok && payload?.photoUrl) {
          setOverride({ from: srcKey, to: payload.photoUrl });
        }
      } catch {
        // Keep the current display URL. Form progress is stored separately.
      }
    }

    const timer = window.setTimeout(() => {
      void refresh();
    }, OPERATIONAL_PHOTO_REFRESH_AFTER_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [srcKey, parentKey, resolvedParent]);

  return displaySrc;
}

export async function refreshOperationalPhotoSrc(
  src: string,
  parent?: OperationalPhotoParent | null
): Promise<string | null> {
  if (!isRefreshablePhotoUrl(src)) return src;
  try {
    const response = await tenantFetch("/api/storage/operational-photo/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoUrl: src, parent }),
    });
    const payload = (await response.json().catch(() => null)) as {
      photoUrl?: string;
    } | null;
    if (response.ok && payload?.photoUrl) return payload.photoUrl;
  } catch {
    // Fall through to the original src.
  }
  return src;
}
