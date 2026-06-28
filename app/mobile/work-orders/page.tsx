import Link from "next/link";
import MobileWorkOrdersList from "./MobileWorkOrdersList";

export default function MobileWorkOrdersPage() {
  return (
    <div className="one-eyrie-mobile__inner one-eyrie-mobile-work-orders">
      <Link href="/mobile" className="one-eyrie-mobile-back">
        ← Home
      </Link>
      <h1 className="one-eyrie-mobile-page-title">Work Orders</h1>
      <p className="one-eyrie-mobile-subheading one-eyrie-mobile-work-orders__subtitle">
        Guest-impacting · Urgent → Important → Normal · oldest first
      </p>
      <MobileWorkOrdersList />
    </div>
  );
}
