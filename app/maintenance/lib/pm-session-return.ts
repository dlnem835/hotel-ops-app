export const PM_SESSION_MOBILE_FROM = "mobile";
export const PM_SESSION_MOBILE_RETURN_PATH = "/mobile/pms";

const PM_OCCURRENCE_PATH = /^\/maintenance\/pm\/\d+\/?$/;
const PM_PROGRAM_PATH = /^\/maintenance\/pm-program\/\d+\/?$/;

export function isMobilePmSession(searchParams: URLSearchParams): boolean {
  return searchParams.get("from") === PM_SESSION_MOBILE_FROM;
}

/** Single PM occurrence and grouped PM program completion routes. */
export function isPmSessionPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return PM_OCCURRENCE_PATH.test(path) || PM_PROGRAM_PATH.test(path);
}

/**
 * PM completion screens render in either shell from the same route, so the
 * mobile shell must keep the occurrence/template id rather than treating these
 * as desktop-only paths.
 */
export function isMobilePmSessionRoute(
  pathname: string,
  searchParams: URLSearchParams
): boolean {
  if (!isPmSessionPath(pathname)) return false;
  if (isMobilePmSession(searchParams)) return true;

  const returnTo = searchParams.get("returnTo");
  return Boolean(
    returnTo && returnTo.includes(`from=${PM_SESSION_MOBILE_FROM}`)
  );
}

export function pmSessionReturnPath(searchParams: URLSearchParams): string {
  const returnTo = searchParams.get("returnTo");
  if (
    returnTo &&
    /^\/maintenance\/pm-program\/\d+(?:\?from=mobile)?$/.test(returnTo)
  ) {
    return returnTo;
  }
  return isMobilePmSession(searchParams)
    ? PM_SESSION_MOBILE_RETURN_PATH
    : "/maintenance";
}

export function pmSessionBackLabel(searchParams: URLSearchParams): string {
  if (searchParams.get("returnTo")) return "Back to PM Program";
  return isMobilePmSession(searchParams) ? "Back to PMs" : "Back to Maintenance";
}

export function pmSessionUrl(
  occurrenceId: number,
  fromMobile = false,
  returnTo?: string
): string {
  const base = `/maintenance/pm/${occurrenceId}`;
  const params = new URLSearchParams();
  if (fromMobile) params.set("from", PM_SESSION_MOBILE_FROM);
  if (returnTo) params.set("returnTo", returnTo);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
