import Link from "next/link";
import { loadPassOnListForMobile } from "./lib/pass-on-server";
import MobilePassOnLogList from "./MobilePassOnLogList";
import MobilePassOnLogListActions from "./MobilePassOnLogListActions";

export const dynamic = "force-dynamic";

export default async function MobilePassOnLogPage() {
  let error: string | null = null;
  let entries: Awaited<ReturnType<typeof loadPassOnListForMobile>> = [];

  try {
    entries = await loadPassOnListForMobile();
  } catch (loadError) {
    error = loadError instanceof Error ? loadError.message : "Unable to load pass-on log";
  }

  return (
    <div className="one-eyrie-mobile__inner one-eyrie-mobile-pass-on">
      <Link href="/mobile" className="one-eyrie-mobile-back">
        ← Home
      </Link>
      <h1 className="one-eyrie-mobile-page-title">Pass-On Log</h1>
      <p className="one-eyrie-mobile-subheading" style={{ marginTop: 8 }}>
        Today and recent shift notes
      </p>

      {error ? <div className="one-eyrie-mobile-error">{error}</div> : null}

      {!error ? <MobilePassOnLogList entries={entries} /> : null}

      <MobilePassOnLogListActions />
    </div>
  );
}
