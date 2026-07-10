"use client";

import { Star } from "lucide-react";
import { useReportFavorites } from "@/app/reports/hooks/useReportFavorites";

type ReportFavoriteButtonProps = {
  reportId: string;
  reportTitle: string;
  className?: string;
};

export default function ReportFavoriteButton({
  reportId,
  reportTitle,
  className = "",
}: ReportFavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useReportFavorites();
  const favorited = isFavorite(reportId);

  return (
    <button
      type="button"
      className={`reports-category-card__favorite-btn${favorited ? " reports-category-card__favorite-btn--active" : ""}${className ? ` ${className}` : ""}`}
      aria-pressed={favorited}
      aria-label={
        favorited
          ? `Remove ${reportTitle} from favorites`
          : `Add ${reportTitle} to favorites`
      }
      title={favorited ? "Remove from favorites" : "Add to favorites"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(reportId);
      }}
    >
      <Star
        size={16}
        className="reports-category-card__favorite-icon"
        fill={favorited ? "currentColor" : "none"}
        aria-hidden
      />
    </button>
  );
}
