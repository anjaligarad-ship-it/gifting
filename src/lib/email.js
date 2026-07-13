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

function lineItemsText(lineItems) {
  return lineItems.map((li) => `- ${li.description} x${li.quantity} — ${fmtGBP(li.amount_total)}`).join('\n');
}

export async function sendOrderEmails({ session, lineItems, customer }) {
  const orderRef = session.id;
  const total    = fmtGBP(session.amount_total);
  const email    = customer.email || session.customer_details?.email;

  const deliveryAddrHTML = customer.isGift && customer.recipientAddress
    ? formatRecipientAddr(customer.recipientAddress)
    : customer.address.replace(/\n/g, '<br>');

  const deliveryAddrText = customer.isGift && customer.recipientAddress
    ? formatRecipientAddrText(customer.recipientAddress)
    : customer.address;

  const giftBlockHTML = customer.isGift ? `
    <div style="background:#f9f9f9;border-left:3px solid #4caf50;padding:0.75rem 1rem;margin:1rem 0;">
      <p style="margin:0 0 0.4rem;font-weight:bold;">🎁 Gift order</p>
      ${customer.giftMessage ? `<p style="margin:0 0 0.4rem;font-style:italic;">"${escHtml(customer.giftMessage)}"</p>` : ''}
      ${customer.hidePrice ? '<p style="margin:0;font-size:0.85em;color:#555;">Prices hidden on packing slip</p>' : ''}
    </div>` : '';

  const deliveryEstimateHTML = customer.deliveryEstimate
    ? `<p>🚚 <strong>Estimated delivery:</strong> ${escHtml(customer.deliveryEstimate)}</p>` : '';

  const itemsTable = `
    <table style="border-collapse:collapse;width:100%;margin:1rem 0;">
      <thead><tr><th style="text-align:left;padding:4px 8px;">Item</th><th style="text-align:left;padding:4px 8px;">Qty</th><th style="text-align:left;padding:4px 8px;">Price</th></tr></thead>
      <tbody>${lineItemsRows(lineItems)}</tbody>
    </table>
  `;

  const detailsHTML = `
    <p><strong>Name:</strong> ${escHtml(customer.name)}</p>
    <p><strong>Email:</strong> ${escHtml(customer.email)}</p>
    <p><strong>Phone:</strong> ${escHtml(customer.phone)}</p>
    <p><strong>Billing address:</strong><br>${customer.address.replace(/\n/g, '<br>')}</p>
    ${customer.isGift && customer.recipientAddress ? `<p><strong>Recipient address:</strong><br>${deliveryAddrHTML}</p>` : ''}
    ${customer.giftMessage ? `<p><strong>Gift message:</strong> ${escHtml(customer.giftMessage)}</p>` : ''}
    ${customer.hidePrice ? '<p><strong>Hide prices:</strong> Yes</p>' : ''}
    ${customer.note ? `<p><strong>Gift note:</strong> ${escHtml(customer.note)}</p>` : ''}
    ${customer.deliveryEstimate ? `<p><strong>Delivery estimate:</strong> ${escHtml(customer.deliveryEstimate)}</p>` : ''}
  `;

  // Confirmation email to the customer
  if (email) {
    await sendEmail({
      to: email,
      subject: `Order confirmed — One Earth Gifting (${orderRef})`,
      html: `
        <h2>Thank you for your order, ${escHtml(customer.name)}!</h2>
        <p>We've received your payment and your order is being prepared.</p>
        ${giftBlockHTML}
        ${itemsTable}
        <p><strong>Total paid:</strong> ${total}</p>
        <p><strong>Delivering to:</strong><br>${deliveryAddrHTML}</p>
        ${deliveryEstimateHTML}
        <p>We'll let you know once it's on its way. Thank you for choosing sustainable gifting! 🌿</p>
      `,
      text: `Thank you for your order, ${customer.name}!\n\nWe've received your payment and your order is being prepared.\n\n${lineItemsText(lineItems)}\n\nTotal paid: ${total}\nDelivering to: ${deliveryAddrText}\n${customer.deliveryEstimate ? `Estimated delivery: ${customer.deliveryEstimate}\n` : ''}${customer.isGift && customer.giftMessage ? `\nGift message: "${customer.giftMessage}"\n` : ''}\nThank you for choosing sustainable gifting!`,
    });
  }

  // Notification email to the team
  await sendEmail({
    to: NOTIFY_EMAIL,
    subject: `New order received — ${orderRef} (${total})${customer.isGift ? ' 🎁' : ''}`,
    html: `
      <h2>New order received</h2>
      ${detailsHTML}
      ${itemsTable}
      <p><strong>Total paid:</strong> ${total}</p>
      <p><strong>Stripe session ID:</strong> ${orderRef}</p>
      <p><strong>Payment status:</strong> ${session.payment_status}</p>
    `,
    text: `New order received\n\nName: ${customer.name}\nEmail: ${customer.email}\nPhone: ${customer.phone}\nBilling: ${customer.address}\n${customer.isGift && customer.recipientAddress ? `Recipient: ${deliveryAddrText}\n` : ''}${customer.giftMessage ? `Gift message: "${customer.giftMessage}"\n` : ''}${customer.note ? `Note: ${customer.note}\n` : ''}${customer.deliveryEstimate ? `Delivery estimate: ${customer.deliveryEstimate}\n` : ''}\n${lineItemsText(lineItems)}\n\nTotal paid: ${total}\nStripe session ID: ${orderRef}\nPayment status: ${session.payment_status}`,
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatRecipientAddr(addr) {
  return [addr.name, addr.line1, addr.line2, addr.town, addr.postcode].filter(Boolean).join('<br>');
}

function formatRecipientAddrText(addr) {
  return [addr.name, addr.line1, addr.line2, addr.town, addr.postcode].filter(Boolean).join(', ');
}
