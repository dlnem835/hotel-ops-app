import Link from "next/link";
import { loadPassOnEntryForMobile } from "../lib/pass-on-server";
import MobilePassOnLogDetail from "../MobilePassOnLogDetail";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MobilePassOnLogDetailPage({ params }: PageProps) {
  const { id } = await params;
  const entryId = Number(id);

  if (!entryId) {
    return (
      <div className="one-eyrie-mobile__inner">
        <div className="one-eyrie-mobile-error">Invalid entry.</div>
        <Link href="/mobile/pass-on-log" className="one-eyrie-mobile-back">
          ← Pass-On Log
        </Link>
      </div>
    );
  }

  try {
    const entry = await loadPassOnEntryForMobile(entryId);

    if (!entry) {
      return (
        <div className="one-eyrie-mobile__inner">
          <div className="one-eyrie-mobile-error">Pass-on entry not found.</div>
          <Link href="/mobile/pass-on-log" className="one-eyrie-mobile-back">
            ← Pass-On Log
          </Link>
        </div>
      );
    }

    return <MobilePassOnLogDetail entry={entry} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load entry";
    return (
      <div className="one-eyrie-mobile__inner">
        <div className="one-eyrie-mobile-error">{message}</div>
        <Link href="/mobile/pass-on-log" className="one-eyrie-mobile-back">
          ← Pass-On Log
        </Link>
      </div>
    );
  }
}
