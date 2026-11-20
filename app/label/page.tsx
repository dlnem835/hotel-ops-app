import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";

/**
 * Retired guest prepaid-label upload page.
 * Old email links still resolve here so guests see a clear replacement message.
 */
export default function LabelUploadRetiredPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: ONE_EYRIE.black,
        fontFamily: "Arial, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: ONE_EYRIE.surface,
          border: `1px solid ${ONE_EYRIE.gold}`,
          borderRadius: "18px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
          textAlign: "center",
          color: ONE_EYRIE.text,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: ONE_EYRIE.surfacePanel,
            padding: "28px 22px 24px",
            borderBottom: `3px solid ${ONE_EYRIE.gold}`,
          }}
        >
          <OneEyrieWordmark className="one-eyrie-wordmark--login" />
          <p
            style={{
              margin: "14px 0 0",
              color: ONE_EYRIE.textSubtle,
              fontSize: "12px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Lost &amp; Found Shipping
          </p>
        </div>

        <div style={{ padding: "32px 28px" }}>
          <h1
            style={{
              margin: "0 0 12px",
              fontSize: "24px",
              color: ONE_EYRIE.text,
              fontWeight: 800,
            }}
          >
            This upload link is no longer available
          </h1>
          <p
            style={{
              margin: 0,
              color: ONE_EYRIE.textMuted,
              lineHeight: 1.6,
              fontSize: "15px",
            }}
          >
            Please use the shipping request link from your email to pay for
            shipping and track your item. Contact the hotel front desk if you
            need a new link.
          </p>
        </div>
      </div>
    </main>
  );
}
