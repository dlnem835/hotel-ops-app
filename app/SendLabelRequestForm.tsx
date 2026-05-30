"use client";

import { supabase } from "./supabaseClient";

export default function SendLabelRequestForm({ 
  itemId, 
  id, 
}: { 
  itemId: number;
id?: string; }) {
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
  .update({
    status: "Label sent",
    label_sent_at: new Date().toISOString(),
  })
  .eq("id", itemId);

  alert("✅ Email sent successfully!");
  window.location.reload();
} else {
  alert("❌ Error sending email");
}
  }

  return (
   <form
  onSubmit={sendEmail}
  style={{
    display: "flex",
    alignItems: "center",
    gap: "6px", // tighter spacing
  }}
>
  <input
    name="email"
    type="email"
    placeholder="Guest email"
    required
    style={{
      background: "#0B0B0B",
      color: "#fff",
      border: "1px solid #2A2A2A",
      borderRadius: "8px",
      padding: "6px 8px", // smaller
      fontSize: "12px",
      width: "180px", // tighter width
      outline: "none",
    }}
  />

  <button
    type="submit"
    style={{
      background: "#C8A96A", // clean blue
      color: "#111",
      border: "none",
      borderRadius: "8px",
      padding: "6px 10px",
      fontSize: "12px",
      fontWeight: "bold",
      cursor: "pointer",
    }}
  >
    Send
  </button>
</form>
 
  );
}
