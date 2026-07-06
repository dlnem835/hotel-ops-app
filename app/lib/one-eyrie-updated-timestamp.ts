export function formatOneEyrieUpdatedTimestamp(
  updatedAt: string,
  now = new Date()
): string {
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return "";

  const timePart = updated.toLocaleString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const isToday =
    updated.getFullYear() === now.getFullYear() &&
    updated.getMonth() === now.getMonth() &&
    updated.getDate() === now.getDate();

  if (isToday) {
    return `Updated Today • ${timePart}`;
  }

  const datePart = updated.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `Updated ${datePart} • ${timePart}`;
}
