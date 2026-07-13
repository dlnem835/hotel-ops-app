type AdminStatusBadgeProps = {
  status: string;
};

const POSITIVE = new Set(["active", "true", "accepted"]);
const WARNING = new Set(["pending"]);
const NEGATIVE = new Set(["expired", "cancelled", "revoked", "disabled", "inactive", "false"]);

export default function AdminStatusBadge({ status }: AdminStatusBadgeProps) {
  const normalized = status.toLowerCase();

  let modifier = "inactive";
  if (POSITIVE.has(normalized)) {
    modifier = "active";
  } else if (WARNING.has(normalized)) {
    modifier = "pending";
  } else if (NEGATIVE.has(normalized)) {
    modifier = "inactive";
  }

  return (
    <span className={`admin-portal__badge admin-portal__badge--${modifier}`}>
      {status}
    </span>
  );
}
