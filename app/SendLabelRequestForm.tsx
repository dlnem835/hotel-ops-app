"use client";

import { supabase } from "./supabaseClient";

export default function SendLabelRequestForm({ itemId }: { itemId: number }) {
  async function sendEmail(e: any) {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;

    const link = `${window.location.origin}/label?id=${itemId}`;

    console.log("ITEM ID BEING SENT:", itemId); // 👈 DEBUG

    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        link,
        itemId,
      }),
    });

    const data = await res.json();

    if (data.success) {
  await supabase
    .from("lost_items")
    .update({ status: "Label sent" })
    .eq("id", itemId);

  alert("✅ Email sent successfully!");
  window.location.reload();
} else {
  alert("❌ Error sending email");
}
  }

  return (
    <form onSubmit={sendEmail} style={{ display: "flex", gap: "10px" }}>
      <input
        name="email"
        placeholder="Enter guest email"
        required
        style={{
          padding: "8px",
          borderRadius: "6px",
          border: "1px solid #ccc",
        }}
      />

      <button
        type="submit"
        style={{
          backgroundColor: "#0070f3",
          color: "white",
          padding: "8px 14px",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Send Label Link
      </button>
    </form>
  );
}
