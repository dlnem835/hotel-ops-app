"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LabelUploadPage() {
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
        backgroundColor: "#f5f7fa",
        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "40px",
          borderRadius: "10px",
          boxShadow: "0 5px 20px rgba(0,0,0,0.1)",
          textAlign: "center",
          width: "380px",
          color:  "#222" //
        }}
      >
        <h2>Upload Your Shipping Label</h2>

        <p style={{ color: "black" }}> Selected file:  {file?.name}
          Please upload your prepaid UPS or FedEx shipping label below.
        </p>

        <label
          style={{
            display: "inline-block",
            padding: "14px 20px",
            backgroundColor: "#0070f3",
            color: "white",
            borderRadius: "6px",
            cursor: "pointer",
            marginBottom: "15px",
            fontWeight: "bold",
          }}
        >
          Upload your shipping label here
          <input
            type="file"
            accept="application/pdf,image/*"
            style={{ display: "none" }}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        {file && (
          <p style={{ fontSize: "13px", color: "#555" }}>
            Selected file: {file.name}
          </p>
        )}

        <button
          onClick={uploadLabel}
          style={{
            marginTop: "15px",
            padding: "10px 20px",
            backgroundColor: "#111",
            color: "white",
            borderRadius: "6px",
            cursor: "pointer",
            border: "none",
          }}
        >
          Upload Label
        </button>

        {message && (
          <p style={{ marginTop: "20px", fontSize: "14px" }}>
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
