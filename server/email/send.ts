import { serverEnv } from "../env.js";

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Send a transactional email through Resend's HTTP API. Without an API key
 * (local development) the email is written to the log instead, so flows that
 * send mail still work end to end.
 *
 * Never throws: an email failure must not fail the action that triggered it
 * (an order is placed whether or not its receipt was delivered).
 */
export async function sendEmail(
  email: Email,
  log: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void },
) {
  const { RESEND_API_KEY, EMAIL_FROM } = serverEnv();

  if (!RESEND_API_KEY) {
    log.info(`[email:dev] to=${email.to} subject="${email.subject}"\n${email.text}`);
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: EMAIL_FROM, ...email }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      log.error({ status: response.status, body: await response.text() }, "email send failed");
    }
  } catch (error) {
    log.error(error, "email send failed");
  }
}

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}
