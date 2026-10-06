import type { OrderSummary } from "../../src/features/checkout/schema.js";
import { escapeHtml, type Email } from "./send.js";

/** Mirrors site.policies.refunds in src/config/site.ts (example wording: replace both). */
const REFUND_POLICY =
  "Refunds go back the way you paid: in cash for cash-on-delivery orders, or by InstaPay transfer, within 5 business days of the return reaching us.";

function money(minor: number, currency: string) {
  return `${currency} ${(minor / 100).toLocaleString("en-US", {
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function totalsRows(order: OrderSummary) {
  const rows: [string, string][] = [["Subtotal", money(order.subtotal, order.currency)]];
  if (order.discountTotal > 0) {
    rows.push([
      `Discount${order.couponCode ? ` (${order.couponCode})` : ""}`,
      `−${money(order.discountTotal, order.currency)}`,
    ]);
  }
  rows.push([
    "Delivery",
    order.shippingTotal === 0 ? "Free" : money(order.shippingTotal, order.currency),
  ]);
  rows.push(["Total", money(order.total, order.currency)]);
  return rows;
}

/** Table-based, inline-styled HTML: the only layout email clients render reliably. */
function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ec;color:#111110;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fbfaf7">
<tr><td style="padding:32px 32px 8px;font-family:Georgia,serif;font-size:24px;letter-spacing:6px">QUATTRO</td></tr>
<tr><td style="padding:8px 32px 0;font-size:18px">${escapeHtml(title)}</td></tr>
<tr><td style="padding:16px 32px 32px;font-size:14px;line-height:1.6">${body}</td></tr>
</table></td></tr></table></body></html>`;
}

export function orderConfirmationEmail(order: OrderSummary, statusUrl: string): Email {
  const address = [
    order.shippingAddress.fullName,
    order.shippingAddress.line1,
    order.shippingAddress.line2,
    `${order.shippingAddress.city}, ${order.shippingAddress.region}`,
  ].filter(Boolean) as string[];

  const itemsHtml = order.items
    .map(
      (item) => `<tr>
<td style="padding:8px 0;border-bottom:1px solid #d9d4cb">${escapeHtml(item.productName)}${
        item.variantLabel
          ? `<br><span style="color:#6b6862">${escapeHtml(item.variantLabel)}</span>`
          : ""
      } × ${item.quantity}</td>
<td align="right" style="padding:8px 0;border-bottom:1px solid #d9d4cb">${money(item.lineTotal, order.currency)}</td></tr>`,
    )
    .join("");
  const totalsHtml = totalsRows(order)
    .map(
      ([label, value], index, all) =>
        `<tr><td style="padding:4px 0${index === all.length - 1 ? ";font-weight:bold" : ""}">${escapeHtml(label)}</td><td align="right" style="padding:4px 0${index === all.length - 1 ? ";font-weight:bold" : ""}">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const due = money(order.total, order.currency);
  // InstaPay orders wait for the transfer; COD orders for the confirmation call.
  const nextSteps = order.instapay
    ? [
        `To complete your order, send ${due} by InstaPay to ${order.instapay.address} (${order.instapay.accountName}).`,
        "Then open your order and enter the transaction reference from your banking app. We confirm the order once the payment is verified.",
        `Please pay within ${order.instapay.holdHours} hours — after that the order is cancelled and the items are released.`,
        ...(order.instapay.note ? [order.instapay.note] : []),
      ]
    : [
        `We’ll call ${order.phone} to confirm your order before it ships. You pay in cash when it arrives.`,
      ];
  const html = layout(
    `Thank you — order ${order.number} is in.`,
    `${nextSteps.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">${itemsHtml}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">${totalsHtml}</table>
<p style="margin-top:24px"><strong>Delivering to</strong><br>${address.map(escapeHtml).join("<br>")}</p>
<p style="margin-top:24px"><a href="${escapeHtml(statusUrl)}" style="color:#111110">${order.instapay ? "Open your order to add the payment reference" : "View your order"}</a></p>`,
  );

  const text = [
    `Thank you — order ${order.number} is in.`,
    "",
    ...nextSteps,
    "",
    ...order.items.map(
      (item) =>
        `${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ""} × ${item.quantity} — ${money(item.lineTotal, order.currency)}`,
    ),
    "",
    ...totalsRows(order).map(([label, value]) => `${label}: ${value}`),
    "",
    "Delivering to:",
    ...address,
    "",
    `View your order: ${statusUrl}`,
  ].join("\n");

  return { to: order.email ?? "", subject: `Order ${order.number} received — QUATTRO`, html, text };
}

export function newOrderNotification(order: OrderSummary, adminUrl: string): Omit<Email, "to"> {
  const text = [
    order.instapay
      ? `New order ${order.number} — InstaPay, waiting for the customer’s transfer.`
      : `New order ${order.number} — awaiting phone confirmation.`,
    `Customer: ${order.shippingAddress.fullName}, ${order.phone}`,
    `Total: ${money(order.total, order.currency)} (${order.instapay ? "InstaPay" : "cash on delivery"})`,
    `Open it: ${adminUrl}`,
  ].join("\n");
  return {
    subject: `New order ${order.number} — ${money(order.total, order.currency)}`,
    html: layout(`New order ${order.number}`, text.split("\n").map(escapeHtml).join("<br>")),
    text,
  };
}

/** Statuses a customer hears about by email. Others are internal steps. */
export const NOTIFIED_STATUSES = [
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;
export type NotifiedStatus = (typeof NOTIFIED_STATUSES)[number];

export function orderStatusEmail(
  order: OrderSummary,
  status: NotifiedStatus,
  trackUrl: string,
  /** Why it was cancelled, when the customer should hear a specific reason. */
  reason?: "unpaid",
): Email {
  const unpaidCod = order.paymentMethod === "cod" && order.paymentStatus !== "paid";
  const due = money(order.total, order.currency);
  const copy: Record<NotifiedStatus, { subject: string; title: string; lines: string[] }> = {
    confirmed: {
      subject: `Order ${order.number} confirmed — QUATTRO`,
      title: `Order ${order.number} is confirmed.`,
      lines: ["Thank you for confirming. We’re preparing your order for delivery."],
    },
    shipped: {
      subject: `Order ${order.number} is on its way — QUATTRO`,
      title: `Order ${order.number} is on its way.`,
      lines: [
        "Your order has left us and is out for delivery.",
        ...(unpaidCod ? [`Please have ${due} ready in cash for the courier.`] : []),
      ],
    },
    delivered: {
      subject: `Order ${order.number} delivered — QUATTRO`,
      title: `Order ${order.number} has been delivered.`,
      lines: ["Thank you for shopping with QUATTRO."],
    },
    returned: {
      subject: `Return received for order ${order.number} — QUATTRO`,
      title: `We’ve received your return for order ${order.number}.`,
      lines: [
        order.paymentStatus === "refunded"
          ? `Your refund of ${due} has been recorded. ${REFUND_POLICY}`
          : "Thank you — the items are back with us.",
      ],
    },
    cancelled: {
      subject: `Order ${order.number} cancelled — QUATTRO`,
      title: `Order ${order.number} has been cancelled.`,
      lines:
        reason === "unpaid" && order.instapay
          ? [
              `We didn’t receive the InstaPay payment within ${order.instapay.holdHours} hours, so the order has been cancelled and the items released.`,
              "You’re welcome to order again any time.",
            ]
          : ["If you didn’t expect this, reply to this email or contact us and we’ll help."],
    },
  };
  const { subject, title, lines } = copy[status];
  const html = layout(
    title,
    `${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
<p style="margin-top:24px"><a href="${escapeHtml(trackUrl)}" style="color:#111110">Track your order</a></p>`,
  );
  const text = [title, "", ...lines, "", `Track your order: ${trackUrl}`].join("\n");
  return { to: order.email ?? "", subject, html, text };
}

export function paymentRejectedEmail(order: OrderSummary, trackUrl: string): Email {
  const title = `We couldn’t verify the payment for order ${order.number}.`;
  const lines = [
    `We couldn’t match an InstaPay transfer of ${money(order.total, order.currency)} to the reference you sent.`,
    "Please check the reference in your banking app and send it again from your order page, or contact us.",
  ];
  const html = layout(
    title,
    `${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
<p style="margin-top:24px"><a href="${escapeHtml(trackUrl)}" style="color:#111110">Your order</a></p>`,
  );
  return {
    to: order.email ?? "",
    subject: `Payment not verified — order ${order.number}`,
    html,
    text: [title, "", ...lines, "", `Your order: ${trackUrl}`].join("\n"),
  };
}
