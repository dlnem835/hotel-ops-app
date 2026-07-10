"use client";

import ReportsCategoryCard from "@/app/reports/components/ReportsCategoryCard";
import ReportsEmptyTabState from "@/app/reports/components/ReportsEmptyTabState";
import { useReportFavorites } from "@/app/reports/hooks/useReportFavorites";
import {
  getFavoriteReportSections,
  type ReportRowDefinition,
} from "@/app/reports/lib/report-definitions";
import { filterReportsForSearch } from "@/app/reports/lib/reports-search";

type ReportsFavoritesTabProps = {
  searchQuery: string;
  onReportSelect: (report: ReportRowDefinition) => void;
};

export default function ReportsFavoritesTab({
  searchQuery,
  onReportSelect,
}: ReportsFavoritesTabProps) {
  const { favoriteIdSet, ready } = useReportFavorites();
  const favoriteSections = getFavoriteReportSections(favoriteIdSet);

  if (!ready) {
    return <p className="reports-pm-results__lead">Loading favorites…</p>;
  }

  if (favoriteSections.length === 0) {
    return (
      <ReportsEmptyTabState
        title="Favorites"
        description="Star any report from All Reports to pin it here for quick access."
      />
    );
  }

  const visibleSections = favoriteSections.filter(
    (section) => filterReportsForSearch(section, searchQuery).length > 0
  );

  if (visibleSections.length === 0) {
    return (
      <ReportsEmptyTabState
        title="No matching favorites"
        description={`No favorited reports match "${searchQuery.trim()}". Try a different search term.`}
      />
    );
  }

  return (
    <div className="reports-category-grid">
      {visibleSections.map((section) => (
        <ReportsCategoryCard
          key={section.id}
          section={section}
          searchQuery={searchQuery}
          onReportSelect={onReportSelect}
        />
      ))}
    </div>
  );
}
