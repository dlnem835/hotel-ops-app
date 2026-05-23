"use client";

export default function SendLabelRequestForm({ itemId }: { itemId: number }) {
  async function sendEmail(e: any) {
    e.preventDefault();

    const email = e.currentTarget.email.value;
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

    const data = await res.json();

    if (data.success) {
      alert("✅ Email sent successfully!");
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
          width: "220px",
          padding: "8px",
          borderRadius: "6px",
          border: "1px solid #ccc",
        }}
      />

      <button
        type="submit"
        style={{
          backgroundColor: "brown",
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
