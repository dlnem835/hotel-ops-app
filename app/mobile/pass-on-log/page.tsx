import Link from "next/link";
import MobilePassOnLogList from "./MobilePassOnLogList";
import MobilePassOnLogListActions from "./MobilePassOnLogListActions";

export const dynamic = "force-dynamic";

export default function MobilePassOnLogPage() {
  return (
    <div className="one-eyrie-mobile__inner one-eyrie-mobile-pass-on">
      <Link href="/mobile" className="one-eyrie-mobile-back">
        ← Home
      </Link>
      <div className="one-eyrie-mobile-pass-on__header">
        <h1 className="one-eyrie-mobile-page-title">Pass-On Log</h1>
        <MobilePassOnLogListActions />
      </div>
      <p className="one-eyrie-mobile-subheading one-eyrie-mobile-pass-on__subtitle">
        Today and recent shift notes
      </p>

      <MobilePassOnLogList />
    </div>
  );
}
