import Link from "next/link";
import MobileInspectionSection from "../inspections/MobileInspectionSection";

export default function MobileRpmsPage() {
  return (
    <div className="one-eyrie-mobile__inner one-eyrie-mobile-inspections">
      <Link href="/mobile" className="one-eyrie-mobile-back">
        ← Home
      </Link>
      <h1 className="one-eyrie-mobile-page-title">RPMs</h1>
      <p className="one-eyrie-mobile-subheading one-eyrie-mobile-inspections__subtitle">
        RPM guest room inspections
      </p>
      <MobileInspectionSection program="RPM" programLabel="RPM" />
    </div>
  );
}
