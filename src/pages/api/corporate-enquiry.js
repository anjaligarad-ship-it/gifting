// POST /api/corporate-enquiry
// Receives corporate enquiry form and emails it (via a simple email service).
// For now returns 200 so the form shows success; wire up Resend/SendGrid in production.

export const prerender = false;

export async function POST({ request }) {
  try {
    const data = await request.json();

    // TODO: send email using Resend (resend.com — free tier: 100 emails/day)
    // import { Resend } from 'resend';
    // const resend = new Resend(import.meta.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'noreply@oneearthgifting.com',
    //   to: 'hello@oneearthgifting.com',
    //   subject: `Corporate Enquiry — ${data.company}`,
    //   text: Object.entries(data).map(([k,v]) => `${k}: ${v}`).join('\n'),
    // });

    console.log('Corporate enquiry received:', data);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to submit' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
