/**
 * Email delivery for verification codes.
 *
 * Intentionally free of `server-only` so `npm run mail:test` can exercise the
 * exact same code path the signup route uses. Nothing here is exposed to the
 * browser: Next only inlines env vars prefixed NEXT_PUBLIC_, so RESEND_API_KEY
 * resolves to undefined in any client bundle.
 *
 * With no provider configured the code is printed to the server console, which
 * is what you want while developing. In production a missing provider is a hard
 * failure: a silently undelivered code is a student who can't sign up, and it
 * would look identical to a working system from the inside.
 */

export type MailResult = { id: string | null };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function mailIsConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function mailFrom(): string {
  return process.env.MAIL_FROM ?? "Sidekick <onboarding@resend.dev>";
}

export async function sendVerificationCode(email: string, code: string): Promise<MailResult> {
  if (!mailIsConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new MailError(
        "RESEND_API_KEY is not set; refusing to drop a verification email.",
        "not_configured",
      );
    }
    printToConsole(email, code);
    return { id: null };
  }

  return send({
    to: email,
    subject: `${code} is your Sidekick code`,
    text:
      `Your Sidekick verification code is ${code}.\n\n` +
      `It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: verificationHtml(code),
  });
}

export async function send(message: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<MailResult> {
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    }),
  });

  const body = await res.text();
  if (!res.ok) throw MailError.fromResponse(res.status, body, message.to);

  let id: string | null = null;
  try {
    id = (JSON.parse(body) as { id?: string }).id ?? null;
  } catch {
    // A 2xx with an unparseable body still means it was accepted.
  }
  return { id };
}

/* ------------------------------------------------------------------ */

export type MailFailure =
  | "not_configured"
  | "bad_key"
  | "domain_not_verified"
  | "rejected"
  | "rate_limited"
  | "unknown";

export class MailError extends Error {
  readonly kind: MailFailure;
  /** What the operator should actually do about it. */
  readonly remedy: string;

  constructor(message: string, kind: MailFailure, remedy = "") {
    super(message);
    this.name = "MailError";
    this.kind = kind;
    this.remedy = remedy;
  }

  static fromResponse(status: number, body: string, to: string): MailError {
    const lower = body.toLowerCase();

    if (status === 401 || status === 403) {
      // Resend's most common first-run wall: an unverified sending domain only
      // permits mail to the account owner's own address.
      if (lower.includes("verify a domain") || lower.includes("own email address") || lower.includes("testing emails")) {
        return new MailError(
          `Resend refused to send to ${to} because the sending domain isn't verified yet.`,
          "domain_not_verified",
          "Verify a domain at resend.com/domains, then set MAIL_FROM to an address at that domain. " +
            "Until then Resend only delivers to the email address that owns the API key.",
        );
      }
      return new MailError("Resend rejected the API key.", "bad_key", "Check RESEND_API_KEY in your .env.");
    }

    if (status === 429) {
      return new MailError("Resend rate-limited the request.", "rate_limited", "Wait a moment and try again.");
    }

    if (status === 422) {
      return new MailError(
        `Resend rejected the message: ${body}`,
        "rejected",
        "MAIL_FROM must be an address on a domain you've verified with Resend.",
      );
    }

    return new MailError(`Resend returned ${status}: ${body}`, "unknown", "");
  }
}

function printToConsole(email: string, code: string) {
  const line = "─".repeat(46);
  console.log(
    `\n  ┌${line}┐\n` +
      `  │  Sidekick verification code${" ".repeat(18)}│\n` +
      `  │  ${email.padEnd(44)}│\n` +
      `  │${" ".repeat(46)}│\n` +
      `  │      ${code.split("").join("  ").padEnd(40)}│\n` +
      `  └${line}┘\n` +
      `  (no RESEND_API_KEY set — printing instead of sending)\n`,
  );
}

/** Kept deliberately plain: tables and inline styles are what mail clients honor. */
function verificationHtml(code: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f6f7;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border:1px solid #e4e4e8;border-radius:16px;">
            <tr>
              <td style="padding:28px 28px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#cc0000;border-radius:9px;width:34px;height:34px;text-align:center;color:#ffffff;font-size:18px;font-weight:800;">S</td>
                    <td style="padding-left:10px;font-size:16px;font-weight:700;color:#0c0c0d;">Sidekick</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 0;">
                <p style="margin:0;font-size:19px;font-weight:700;color:#0c0c0d;">Verify your BU email</p>
                <p style="margin:8px 0 0;font-size:14px;line-height:1.55;color:#55575e;">
                  Enter this code in Sidekick to finish signing in. It expires in 10 minutes.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 0;">
                <div style="background:#f1f1f3;border:1px solid #e4e4e8;border-radius:12px;padding:18px;text-align:center;font-size:32px;font-weight:700;letter-spacing:9px;color:#0c0c0d;">
                  ${code}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 28px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#8b8d95;">
                  If you didn't request this, you can ignore this email — no account is created without the code.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#8b8d95;">Sidekick · a verified BU-only marketplace</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
