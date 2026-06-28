import Link from "next/link";
import MobileInspectionSection from "../inspections/MobileInspectionSection";

export default function MobileInspectionsPage() {
  return (
    <div className="one-eyrie-mobile__inner one-eyrie-mobile-inspections">
      <Link href="/mobile" className="one-eyrie-mobile-back">
        ← Home
      </Link>
      <h1 className="one-eyrie-mobile-page-title">Room Inspections</h1>
      <p className="one-eyrie-mobile-subheading one-eyrie-mobile-inspections__subtitle">
        Vacant Ready / Stayover
      </p>
      <MobileInspectionSection program="VR" programLabel="Vacant Ready / Stayover" />
    </div>
  );
}
