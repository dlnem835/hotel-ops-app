import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const body = await req.json();

  const { email, item } = body;

  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "Your Lost Item",
      html: `<p>Your item (${item}) is ready to be shipped.</p>`,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error });
  }
}
