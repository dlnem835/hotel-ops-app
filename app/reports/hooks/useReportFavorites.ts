"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getClientSession } from "@/app/lib/auth";
import {
  listFavoriteReportIds,
  REPORT_FAVORITES_UPDATED_EVENT,
  setFavoriteReport,
  toggleFavoriteReport,
} from "@/app/reports/lib/report-favorites-storage";

type ReportFavoritesContextValue = {
  ready: boolean;
  favoriteIds: string[];
  favoriteIdSet: ReadonlySet<string>;
  isFavorite: (reportId: string) => boolean;
  toggleFavorite: (reportId: string) => void;
  setFavorite: (reportId: string, favorited: boolean) => void;
};

const ReportFavoritesContext = createContext<ReportFavoritesContextValue | null>(null);

export function ReportFavoritesProvider({ children }: { children: ReactNode }) {
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback((userId: string | null) => {
    setFavoriteIds(listFavoriteReportIds(userId));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const session = await getClientSession();
      if (cancelled) return;
      const userId = session?.user?.id ?? null;
      setAuthUserId(userId);
      refresh(userId);
      setReady(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    function handleUpdate() {
      refresh(authUserId);
    }

    window.addEventListener(REPORT_FAVORITES_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(REPORT_FAVORITES_UPDATED_EVENT, handleUpdate);
  }, [authUserId, refresh]);

  const value = useMemo<ReportFavoritesContextValue>(() => {
    const favoriteIdSet = new Set(favoriteIds);
    return {
      ready,
      favoriteIds,
      favoriteIdSet,
      isFavorite: (reportId: string) => favoriteIdSet.has(reportId),
      toggleFavorite: (reportId: string) => {
        setFavoriteIds(toggleFavoriteReport(reportId, authUserId));
      },
      setFavorite: (reportId: string, favorited: boolean) => {
        setFavoriteIds(setFavoriteReport(reportId, favorited, authUserId));
      },
    };
  }, [authUserId, favoriteIds, ready]);

  return createElement(ReportFavoritesContext.Provider, { value }, children);
}

export function useReportFavorites() {
  const context = useContext(ReportFavoritesContext);
  if (!context) {
    throw new Error("useReportFavorites must be used within ReportFavoritesProvider");
  }
  return context;
}
