"use client";

type AdminLoadingStateProps = {
  label?: string;
};

export default function AdminLoadingState({
  label = "Loading…",
}: AdminLoadingStateProps) {
  return <div className="admin-portal__loading">{label}</div>;
}
