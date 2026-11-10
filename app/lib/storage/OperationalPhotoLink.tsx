"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useState } from "react";
import type { OperationalPhotoParent } from "@/app/lib/storage/operational-photo-types";
import { useOperationalPhotoParent } from "@/app/lib/storage/operational-photo-parent";
import {
  refreshOperationalPhotoSrc,
  useRefreshedPhotoUrl,
} from "@/app/lib/storage/use-refreshed-photo-url";

type OperationalPhotoLinkProps = {
  src: string;
  children: ReactNode;
  parent?: OperationalPhotoParent | null;
  className?: string;
  style?: CSSProperties;
};

export default function OperationalPhotoLink({
  src,
  children,
  parent,
  className,
  style,
}: OperationalPhotoLinkProps) {
  const contextParent = useOperationalPhotoParent();
  const resolvedParent = parent ?? contextParent;
  const refreshed = useRefreshedPhotoUrl(src, resolvedParent);
  const [overrideSrc, setOverrideSrc] = useState<string | null>(null);
  const displaySrc = overrideSrc || refreshed || src;

  async function resolveHref(): Promise<string> {
    const next = await refreshOperationalPhotoSrc(displaySrc, resolvedParent);
    if (next && next !== displaySrc) setOverrideSrc(next);
    return next || displaySrc;
  }

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    const href = await resolveHref();
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <a
      href={displaySrc}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      onClick={(event) => {
        void handleClick(event);
      }}
    >
      {children}
    </a>
  );
}
