"use client";

import { useState } from "react";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import {
  LOST_ITEM_STATUS,
  LOST_ITEM_STATUS_OPTIONS,
  normalizeLostItemStatus,
} from "@/app/lib/lost-found-shipping/status";

export default function StatusSelect({ id, currentStatus }: any) {
  const [status, setStatus] = useState(
    normalizeLostItemStatus(currentStatus) || LOST_ITEM_STATUS.stored
  );

  async function updateStatus(e: any) {
    const newStatus = e.target.value;
    setStatus(newStatus);

    await tenantFetch("/api/update-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, status: newStatus }),
    });
  }

  return (
    <select value={status} onChange={updateStatus}>
      {LOST_ITEM_STATUS_OPTIONS.map((statusOption) => (
        <option key={statusOption} value={statusOption}>
          {statusOption}
        </option>
      ))}
    </select>
  );
}
