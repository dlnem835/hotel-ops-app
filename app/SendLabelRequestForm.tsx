"use client";

import { supabase } from "./supabaseClient";

export default function SendLabelRequestForm({
  itemId,
  id,
}: {
  itemId: number;
  id?: string;
}) {
  async function sendEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;

    const link = `${window.location.origin}/label?id=${itemId}`;

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

    if (res.ok) {
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
    <form onSubmit={sendEmail} className="one-eyrie-send-label-form">
      <input
        name="email"
        type="email"
        placeholder="Guest email"
        required
        className="one-eyrie-field one-eyrie-field--compact"
      />

      <button type="submit" className="one-eyrie-send-label-form__btn">
        Send
      </button>
    </form>
  );
}
