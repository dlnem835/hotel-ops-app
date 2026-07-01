import Link from "next/link";
import MobilePmGridSection from "./MobilePmGridSection";

export default function MobilePmsPage() {
  return (
    <div className="one-eyrie-mobile__inner one-eyrie-mobile-pms">
      <Link href="/mobile" className="one-eyrie-mobile-back">
        ← Home
      </Link>
      <h1 className="one-eyrie-mobile-page-title">Preventative Maintenance</h1>
      <p className="one-eyrie-mobile-subheading one-eyrie-mobile-pms__subtitle">
        Preventative maintenance assignments
      </p>
      <MobilePmGridSection />
    </div>
  );
}
