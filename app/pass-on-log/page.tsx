import { Suspense } from "react";
import PassOnLogPageContent from "./PassOnLogPageContent";

export default function PassOnLogPage() {
  return (
    <Suspense fallback={null}>
      <PassOnLogPageContent />
    </Suspense>
  );
}
