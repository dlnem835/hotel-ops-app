"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Suspense } from "react";

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
        background:
          "radial-gradient(circle at top, #1a1a1d 0%, #0b0b0d 45%, #050505 100%)",
        fontFamily: "Arial, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#121214",
          border: "1px solid #2A2A2A",
          borderRadius: "18px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
          textAlign: "center",
          color: "#F5F1E8",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "#080808",
            padding: "26px 22px",
            borderBottom: "3px solid #C8A96A",
          }}
        >
          <div
            style={{
              color: "#ffffff",
              fontSize: "32px",
              fontWeight: 800,
              letterSpacing: "3px",
            }}
          >
            ONE
          </div>
          <div
            style={{
              color: "#C8A96A",
              fontSize: "13px",
              letterSpacing: "7px",
              marginTop: "4px",
            }}
          >
            — EYRIE —
          </div>
        </div>

        <div style={{ padding: "32px 28px" }}>
          <h2
            style={{
              margin: "0 0 12px",
              fontSize: "24px",
              color: "#ffffff",
            }}
          >
            Upload Shipping Label
          </h2>

          <p
            style={{
              margin: "0 0 22px",
              color: "#D8D8D8",
              lineHeight: 1.6,
              fontSize: "15px",
            }}
          >
            Please upload your prepaid UPS or FedEx shipping label so the hotel
            team can prepare your item for shipment.
          </p>

          <label
            style={{
              display: "block",
              padding: "15px 20px",
              background: "#C8A96A",
              color: "#111111",
              borderRadius: "12px",
              cursor: "pointer",
              marginBottom: "16px",
              fontWeight: 800,
              boxShadow: "0 10px 24px rgba(200,169,106,0.22)",
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
              color: file ? "#C8A96A" : "#8F8F8F",
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
              background: "#ffffff",
              color: "#111111",
              borderRadius: "12px",
              cursor: "pointer",
              border: "none",
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
              color: "#8F8F8F",
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