type AdminStatusBadgeProps = {
  status: string;
};

export default function AdminStatusBadge({ status }: AdminStatusBadgeProps) {
  const normalized = status.toLowerCase();
  const className =
    normalized === "active" || normalized === "true"
      ? "admin-portal__badge admin-portal__badge--active"
      : "admin-portal__badge admin-portal__badge--inactive";

  return <span className={className}>{status}</span>;
}
