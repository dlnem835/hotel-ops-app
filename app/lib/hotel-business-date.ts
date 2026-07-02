export const HOTEL_TIMEZONE = "America/New_York";

export type PassOnDateFilter =
  | "All"
  | "Today"
  | "Yesterday"
  | "Tomorrow"
  | "Scheduled"
  | "Custom";

export type PassOnDashboardDay = "today" | "yesterday" | "tomorrow";

export type HotelBusinessDateWindow = {
  today: string;
  yesterday: string;
  tomorrow: string;
};

/** YYYY-MM-DD for the hotel's business calendar (America/New_York). */
export function getHotelBusinessDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HOTEL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Shift a stored business date by whole days (YYYY-MM-DD). */
export function shiftHotelBusinessDateString(
  baseDateString: string,
  dayOffset: number
): string {
  const [year, month, day] = baseDateString.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + dayOffset));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getHotelBusinessDateWindow(
  reference = new Date()
): HotelBusinessDateWindow {
  const today = getHotelBusinessDateString(reference);
  return {
    today,
    yesterday: shiftHotelBusinessDateString(today, -1),
    tomorrow: shiftHotelBusinessDateString(today, 1),
  };
}

export function isStoredOnHotelBusinessDate(
  createdAt: string | null,
  businessDate: string
): boolean {
  if (!createdAt) return false;
  return getHotelBusinessDateString(new Date(createdAt)) === businessDate;
}

export function matchesPassOnDateFilter(
  entryDate: string,
  filter: PassOnDateFilter,
  options?: { customDate?: string; reference?: Date }
): boolean {
  if (!entryDate) return filter === "All";

  const { today, yesterday, tomorrow } = getHotelBusinessDateWindow(
    options?.reference
  );

  switch (filter) {
    case "Today":
      return entryDate === today;
    case "Yesterday":
      return entryDate === yesterday;
    case "Tomorrow":
      return entryDate === tomorrow;
    case "Scheduled":
      return entryDate > tomorrow;
    case "Custom":
      return entryDate === (options?.customDate ?? "");
    case "All":
    default:
      return true;
  }
}

export function formatPassOnBusinessDateHeader(
  dateString: string,
  reference = new Date()
): string {
  const { today, yesterday, tomorrow } = getHotelBusinessDateWindow(reference);

  if (dateString === today) return "Today";
  if (dateString === tomorrow) return "Tomorrow";
  if (dateString === yesterday) return "Yesterday";

  if (dateString > tomorrow) {
    return `Scheduled · ${formatBusinessDateLong(dateString)}`;
  }

  return formatBusinessDateLong(dateString);
}

function formatBusinessDateLong(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

export function groupPassOnEntriesForDashboard<
  T extends { entryDate: string },
>(entries: T[], reference = new Date()): Record<PassOnDashboardDay, T[]> {
  const { today, yesterday, tomorrow } = getHotelBusinessDateWindow(reference);

  return {
    today: entries.filter((entry) => entry.entryDate === today),
    yesterday: entries.filter((entry) => entry.entryDate === yesterday),
    tomorrow: entries.filter((entry) => entry.entryDate === tomorrow),
  };
}

export function passOnDashboardDateKeys(
  reference = new Date()
): [string, string, string] {
  const { today, yesterday, tomorrow } = getHotelBusinessDateWindow(reference);
  return [today, yesterday, tomorrow];
}
