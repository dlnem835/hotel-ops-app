"use client";

import { useState } from "react";

const statuses = [
  "Found",
  "Label request sent",
  "Ready to be shipped",
  "Shipped",
  "Discarded",
];

export default function StatusSelect({ id, currentStatus }: any) {
  const [status, setStatus] = useState(currentStatus || "Found");

  async function updateStatus(e: any) {
    const newStatus = e.target.value;
    setStatus(newStatus);

    await fetch("/api/update-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, status: newStatus }),
    });
  }

  return (
    <select value={status} onChange={updateStatus}>
      {statuses.map((statusOption) => (
        <option key={statusOption} value={statusOption}>
          {statusOption}
        </option>
      ))}
    </select>
  );
}