"use client";

import type { CSSProperties } from "react";
import type { OperationalPhotoParent } from "@/app/lib/storage/operational-photo-types";
import { useOperationalPhotoParent } from "@/app/lib/storage/operational-photo-parent";
import {
  refreshOperationalPhotoSrc,
  useRefreshedPhotoUrl,
} from "@/app/lib/storage/use-refreshed-photo-url";
import { useState } from "react";

type OperationalPhotoProps = {
  src: string;
  alt: string;
  parent?: OperationalPhotoParent | null;
  className?: string;
  imgStyle?: CSSProperties;
  linkStyle?: CSSProperties;
};

export default function OperationalPhoto({
  src,
  alt,
  parent,
  className,
  imgStyle,
  linkStyle,
}: OperationalPhotoProps) {
  const contextParent = useOperationalPhotoParent();
  const resolvedParent = parent ?? contextParent;
  const refreshed = useRefreshedPhotoUrl(src, resolvedParent);
  const [overrideSrc, setOverrideSrc] = useState<string | null>(null);
  const displaySrc = overrideSrc || refreshed || src;

  async function handleError() {
    const next = await refreshOperationalPhotoSrc(displaySrc, resolvedParent);
    if (next && next !== displaySrc) setOverrideSrc(next);
  }

  return (
    <a
      href={displaySrc}
      target="_blank"
      rel="noopener noreferrer"
      style={linkStyle}
    >
      <img
        src={displaySrc}
        alt={alt}
        className={className}
        style={imgStyle}
        onError={() => {
          void handleError();
        }}
      />
    </a>
  );
}
