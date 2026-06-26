export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftLocalDateString(base: Date, dayOffset: number): string {
  const next = new Date(base);
  next.setDate(next.getDate() + dayOffset);
  return getLocalDateString(next);
}

export function isStoredToday(createdAt: string | null, today: string): boolean {
  if (!createdAt) return false;
  return getLocalDateString(new Date(createdAt)) === today;
}
