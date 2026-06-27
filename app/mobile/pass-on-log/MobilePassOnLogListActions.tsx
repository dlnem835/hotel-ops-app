"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

export default function MobilePassOnLogListActions() {
  return (
    <Link href="/mobile/pass-on-log/new" className="one-eyrie-mobile-pass-on-new">
      <Plus size={20} strokeWidth={2.5} />
      New Pass-On
    </Link>
  );
}
