"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { OperationalPhotoParent } from "@/app/lib/storage/operational-photo-types";

const OperationalPhotoParentContext =
  createContext<OperationalPhotoParent | null>(null);

export function OperationalPhotoParentProvider({
  value,
  children,
}: {
  value: OperationalPhotoParent | null;
  children: ReactNode;
}) {
  return (
    <OperationalPhotoParentContext.Provider value={value}>
      {children}
    </OperationalPhotoParentContext.Provider>
  );
}

export function useOperationalPhotoParent(): OperationalPhotoParent | null {
  return useContext(OperationalPhotoParentContext);
}
