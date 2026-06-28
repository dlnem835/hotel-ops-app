import MobileWorkOrderDetail from "../MobileWorkOrderDetail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MobileWorkOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const workOrderId = Number(id);

  if (!workOrderId) {
    return (
      <div className="one-eyrie-mobile__inner one-eyrie-mobile-work-orders">
        <div className="one-eyrie-mobile-error">Invalid work order.</div>
      </div>
    );
  }

  return <MobileWorkOrderDetail workOrderId={workOrderId} />;
}
