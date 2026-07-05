export function formatPmSessionTimestamp(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart} • ${timePart}`;
}
