import { buildInvitationEmail } from "@/app/lib/email";

/**
 * Local/dev preview of the branded invitation email.
 * Disabled in production so the template cannot be scraped publicly.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const email = buildInvitationEmail({
    recipient_name: "Alex Rivera",
    inviter_name: "Jordan Blake",
    organization_name: "Summit Hospitality Group",
    accept_invitation_url: "https://app.oneeyrie.com/auth/callback?invite=preview",
    expiration_date: "April 24, 2026",
  });

  return new Response(email.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
