"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatWorkOrderAge,
  workOrderListDescription,
  workOrderListSourceNote,
} from "@/app/maintenance/lib/work-order-display";
import { WorkOrder } from "@/app/maintenance/lib/maintenance-types";
import { getWorkOrderPriorityPillStyle } from "@/app/lib/workOrderPriority";
import { fetchOpenWorkOrders } from "./lib/work-order-shared";

export default function MobileWorkOrdersList() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    void fetchOpenWorkOrders()
      .then((orders) => {
        if (!mounted) return;
        setWorkOrders(orders);
        setLoading(false);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load work orders"
        );
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="one-eyrie-mobile-status">Loading work orders…</div>;
  }

  if (error) {
    return <div className="one-eyrie-mobile-error">{error}</div>;
  }

  if (workOrders.length === 0) {
    return (
      <div className="one-eyrie-mobile-status">
        No open work orders. Guest issues and pass-ons will appear here.
      </div>
    );
  }

  return (
    <div className="one-eyrie-mobile-work-orders-list">
      {workOrders.map((order, index) => {
        const description = workOrderListDescription(order);
        const sourceNote = workOrderListSourceNote(order);

        return (
          <Link
            key={order.id}
            href={`/mobile/work-orders/${order.id}`}
            className="one-eyrie-mobile-work-order-card"
          >
            <div className="one-eyrie-mobile-work-order-card__main">
              <div className="one-eyrie-mobile-work-order-card__top">
                <p className="one-eyrie-mobile-work-order-card__title">
                  {index + 1}. {order.subject}
                </p>
                <span style={getWorkOrderPriorityPillStyle(order.priority)}>
                  {order.priority}
                </span>
              </div>
              <div className="one-eyrie-mobile-work-order-card__location">
                {order.areaLabel || "No area specified"}
                {order.sourceModule ? ` · from ${order.sourceModule}` : ""}
              </div>
              {description ? (
                <div className="one-eyrie-mobile-work-order-card__description">
                  {description}
                </div>
              ) : null}
              {sourceNote ? (
                <div className="one-eyrie-mobile-work-order-card__source-note">
                  {sourceNote}
                </div>
              ) : null}
              <div className="one-eyrie-mobile-work-order-card__age">
                {formatWorkOrderAge(order.createdAt)}
                {order.createdBy ? ` · ${order.createdBy}` : ""}
              </div>
            </div>
            <span className="one-eyrie-mobile-work-order-card__open">Open</span>
          </Link>
        );
      })}
    </div>
  );
}
