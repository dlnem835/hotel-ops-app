export const PM_SESSION_MOBILE_FROM = "mobile";
export const PM_SESSION_MOBILE_RETURN_PATH = "/mobile/pms";

export function isMobilePmSession(searchParams: URLSearchParams): boolean {
  return searchParams.get("from") === PM_SESSION_MOBILE_FROM;
}

export function pmSessionReturnPath(searchParams: URLSearchParams): string {
  return isMobilePmSession(searchParams)
    ? PM_SESSION_MOBILE_RETURN_PATH
    : "/maintenance";
}

export function pmSessionBackLabel(searchParams: URLSearchParams): string {
  return isMobilePmSession(searchParams) ? "Back to PMs" : "Back to Maintenance";
}

export function pmSessionUrl(occurrenceId: number, fromMobile = false): string {
  const base = `/maintenance/pm/${occurrenceId}`;
  return fromMobile ? `${base}?from=${PM_SESSION_MOBILE_FROM}` : base;
}
