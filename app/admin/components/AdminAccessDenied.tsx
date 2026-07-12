"use client";

import Link from "next/link";

export default function AdminAccessDenied() {
  return (
    <div className="admin-portal admin-portal__denied">
      <div className="admin-portal__denied-card">
        <h1 className="admin-portal__denied-title">Access denied</h1>
        <p className="admin-portal__denied-text">
          This area is restricted to One Eyrie platform administrators. Your account
          does not have an active platform admin assignment.
        </p>
        <Link href="/" className="admin-portal__link">
          Return to hotel application
        </Link>
      </div>
    </div>
  );
}
