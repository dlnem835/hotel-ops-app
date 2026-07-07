"use client";

import { Search } from "lucide-react";

type ReportsSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function ReportsSearchBar({ value, onChange }: ReportsSearchBarProps) {
  return (
    <div className="reports-search-wrap">
      <Search size={18} className="reports-search-wrap__icon" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search reports..."
        className="one-eyrie-field reports-search-wrap__input"
        aria-label="Search reports"
      />
    </div>
  );
}
