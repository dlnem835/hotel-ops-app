"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Suspense } from "react";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";

export function LabelUploadPageContent() {
  const searchParams = useSearchParams();
  const itemId = searchParams.get("id");

  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  async function uploadLabel() {
    if (!file) {
      setMessage("Please select a file first.");
      return;
    }

    if (!itemId) {
      setMessage("Missing item ID. Please use the link from the email.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("itemId", itemId);

    const response = await fetch("/api/upload-label", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
  setMessage("✅ Label uploaded successfully. The hotel can now ship your item.");
} else {
  setMessage(`❌ Upload failed: ${data.error}`);
}
  }

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
          <Image
            src="/one-eyrie-logo-stacked.png"
            alt="One Eyrie"
            width={168}
            height={120}
            priority
            style={{
              display: "block",
              margin: "0 auto",
              height: "auto",
              width: "168px",
            }}
          />
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
          <h2
            style={{
              margin: "0 0 12px",
              fontSize: "24px",
              color: ONE_EYRIE.text,
              fontWeight: 800,
            }}
          >
            Upload Shipping Label
          </h2>

          <p
            style={{
              margin: "0 0 22px",
              color: ONE_EYRIE.textMuted,
              lineHeight: 1.6,
              fontSize: "15px",
            }}
          >
            Please upload your prepaid UPS, FedEx, or USPS shipping label so the
            hotel team can prepare your item for shipment.
          </p>

          <label
            style={{
              display: "block",
              padding: "15px 20px",
              background: ONE_EYRIE.gold,
              color: ONE_EYRIE.black,
              borderRadius: "12px",
              cursor: "pointer",
              marginBottom: "16px",
              fontWeight: 800,
              boxShadow: `0 10px 24px ${ONE_EYRIE.goldGlow}`,
            }}
          >
            Upload Shipping Label
            <input
              type="file"
              accept="application/pdf,image/*"
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>

          <div
            style={{
              minHeight: "24px",
              marginBottom: "18px",
              color: file ? ONE_EYRIE.gold : ONE_EYRIE.textSubtle,
              fontSize: "14px",
              wordBreak: "break-word",
            }}
          >
            {file ? `Selected file: ${file.name}` : "No file selected yet"}
          </div>

          <button
            onClick={uploadLabel}
            style={{
              width: "100%",
              padding: "15px 20px",
              background: ONE_EYRIE.row,
              color: ONE_EYRIE.text,
              borderRadius: "12px",
              cursor: "pointer",
              border: `1px solid ${ONE_EYRIE.border}`,
              fontWeight: 800,
              fontSize: "15px",
            }}
          >
            Submit Label
          </button>

          {message && (
            <div
              style={{
                marginTop: "22px",
                padding: "14px",
                borderRadius: "12px",
                background: message.includes("✅") ? "#102216" : "#2A1111",
                color: message.includes("✅") ? "#A7F3B5" : "#FFB4B4",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              {message}
            </div>
          )}

          <p
            style={{
              marginTop: "22px",
              marginBottom: 0,
              color: ONE_EYRIE.textSubtle,
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            Accepted file types: PDF or image file.
          </p>
        </div>
      </div>
    </main>
  );
}
export default function LabelUploadPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <LabelUploadPageContent />
    </Suspense>
  );
}
