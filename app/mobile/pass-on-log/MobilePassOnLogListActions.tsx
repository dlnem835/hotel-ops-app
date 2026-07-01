"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { forestHoverHandlers } from "@/app/settings/lib/settings-ui-interactions";

export default function MobilePassOnLogListActions() {
  return (
    <Link
      href="/mobile/pass-on-log/new"
      className="one-eyrie-mobile-work-orders__create-btn one-eyrie-mobile-pass-on__create-btn"
      {...forestHoverHandlers()}
    >
      <Plus size={16} strokeWidth={2.5} aria-hidden />
      New
    </Link>
  );
}
