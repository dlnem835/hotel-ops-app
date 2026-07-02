import {
  getHotelBusinessDateString,
  isStoredOnHotelBusinessDate,
  shiftHotelBusinessDateString,
} from "@/app/lib/hotel-business-date";

/** @deprecated Use getHotelBusinessDateString — kept for dashboard imports. */
export function getLocalDateString(date = new Date()): string {
  return getHotelBusinessDateString(date);
}

export function shiftLocalDateString(base: Date, dayOffset: number): string {
  const anchor = getHotelBusinessDateString(base);
  return shiftHotelBusinessDateString(anchor, dayOffset);
}

export function isStoredToday(createdAt: string | null, today: string): boolean {
  return isStoredOnHotelBusinessDate(createdAt, today);
}
