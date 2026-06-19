// Shared Resend email helper for order confirmations and internal notifications.

const FROM_EMAIL = 'One Earth Gifting <orders@oneearthgifting.com>';
const NOTIFY_EMAIL = import.meta.env.ORDER_NOTIFICATION_EMAIL || 'anjali.garad@oneearthbeyond.com';

async function sendEmail({ to, subject, html, text }) {
  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set — skipping email send:', subject);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, text }),
  });
  if (!res.ok) {
    console.error('Resend error:', res.status, await res.text());
  }
}

function fmtGBP(pence) {
  return `£${(pence / 100).toFixed(2)}`;
}

function lineItemsRows(lineItems) {
  return lineItems
    .map(
      (li) =>
        `<tr><td style="padding:4px 8px;">${li.description}</td><td style="padding:4px 8px;">x${li.quantity}</td><td style="padding:4px 8px;">${fmtGBP(li.amount_total)}</td></tr>`
    )
    .join('');
}

export async function sendOrderEmails({ session, lineItems, customer }) {
  const orderRef = session.id;
  const total = fmtGBP(session.amount_total);
  const email = customer.email || session.customer_details?.email;

  const detailsHTML = `
    <p><strong>Name:</strong> ${customer.name}</p>
    <p><strong>Email:</strong> ${customer.email}</p>
    <p><strong>Phone:</strong> ${customer.phone}</p>
    <p><strong>Delivery address:</strong><br>${customer.address.replace(/\n/g, '<br>')}</p>
    ${customer.note ? `<p><strong>Gift note:</strong> ${customer.note}</p>` : ''}
  `;

  const itemsTable = `
    <table style="border-collapse:collapse;width:100%;margin:1rem 0;">
      <thead><tr><th style="text-align:left;padding:4px 8px;">Item</th><th style="text-align:left;padding:4px 8px;">Qty</th><th style="text-align:left;padding:4px 8px;">Price</th></tr></thead>
      <tbody>${lineItemsRows(lineItems)}</tbody>
    </table>
  `;

  // Confirmation email to the customer
  if (email) {
    await sendEmail({
      to: email,
      subject: `Order confirmed — One Earth Gifting (${orderRef})`,
      html: `
        <h2>Thank you for your order, ${customer.name}!</h2>
        <p>We've received your payment and your order is being prepared.</p>
        ${itemsTable}
        <p><strong>Total paid:</strong> ${total}</p>
        <p><strong>Delivery address:</strong><br>${customer.address.replace(/\n/g, '<br>')}</p>
        <p>We'll let you know once it's on its way. Thank you for choosing sustainable gifting!</p>
      `,
    });
  }

  // Notification email to One Earth Gifting with full customer + payment details
  await sendEmail({
    to: NOTIFY_EMAIL,
    subject: `New order received — ${orderRef} (${total})`,
    html: `
      <h2>New order received</h2>
      ${detailsHTML}
      ${itemsTable}
      <p><strong>Total paid:</strong> ${total}</p>
      <p><strong>Stripe session ID:</strong> ${orderRef}</p>
      <p><strong>Payment status:</strong> ${session.payment_status}</p>
    `,
  });
}
