"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WorkOrderModal from "@/app/maintenance/components/WorkOrderModal";
import {
  forestHoverHandlers,
} from "@/app/settings/lib/settings-ui-interactions";
import MobileWorkOrdersList from "./MobileWorkOrdersList";
import { resolveWorkOrderCreatedBy } from "./lib/work-order-shared";

export default function MobileWorkOrdersSection() {
  const router = useRouter();
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  useEffect(() => {
    void resolveWorkOrderCreatedBy().then(setCreatedByName);
  }, []);

  return (
    <div className="one-eyrie-mobile__inner one-eyrie-mobile-work-orders">
      <Link href="/mobile" className="one-eyrie-mobile-back">
        ← Home
      </Link>
      <div className="one-eyrie-mobile-work-orders__header">
        <h1 className="one-eyrie-mobile-page-title">Work Orders</h1>
        <button
          type="button"
          className="one-eyrie-mobile-work-orders__create-btn"
          onClick={() => setWorkOrderModalOpen(true)}
          {...forestHoverHandlers(false)}
        >
          + New Work Order
        </button>
      </div>
      <p className="one-eyrie-mobile-subheading one-eyrie-mobile-work-orders__subtitle">
        Guest-impacting · Urgent → Important → Normal · oldest first
      </p>

      <MobileWorkOrdersList refreshKey={listRefreshKey} />

      <WorkOrderModal
        open={workOrderModalOpen}
        createdBy={createdByName}
        onClose={() => setWorkOrderModalOpen(false)}
        onCreated={() => {
          setListRefreshKey((current) => current + 1);
          setWorkOrderModalOpen(false);
        }}
        onViewExistingWorkOrder={(id) => {
          setWorkOrderModalOpen(false);
          router.push(`/mobile/work-orders/${id}`);
        }}
      />
    </div>
  );
}
