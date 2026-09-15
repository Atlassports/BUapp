import "server-only";

/**
 * Email delivery. With no provider configured the code is printed to the
 * server console, which is exactly what you want while developing — and a
 * hard failure in production, where a silently undelivered code means a
 * student who can't sign up.
 */
export async function sendVerificationCode(email: string, code: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set; refusing to drop a verification email.");
    }
    console.log(
      `\n  ┌─────────────────────────────────────────┐\n` +
        `  │  Sidekick verification code             │\n` +
        `  │  ${email.padEnd(37)}│\n` +
        `  │  →  ${code}                              │\n` +
        `  └─────────────────────────────────────────┘\n`,
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? "Sidekick <onboarding@resend.dev>",
      to: [email],
      subject: `${code} is your Sidekick code`,
      text: `Your Sidekick verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`,
    }),
  });

  if (!res.ok) throw new Error(`Email delivery failed: ${res.status} ${await res.text()}`);
}
