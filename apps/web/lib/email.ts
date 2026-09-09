import { Resend } from "resend";
import { APP_URL } from "./config";

const FROM = process.env.FROM_EMAIL || "Buy A Coffee <coffee@perkos.xyz>";

export async function sendMagicLink(email: string, token: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const link = `${APP_URL}/api/auth/callback?token=${encodeURIComponent(token)}`;
  if (!key) {
    // Local development without Resend: print the link.
    console.log(`[magic-link] ${email}: ${link}`);
    return;
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: FROM,
    to: [email],
    subject: "Your Buy A Coffee sign-in link",
    text: `Sign in to Buy A Coffee: ${link}\n\nThe link works once and expires in 15 minutes. If you did not request it, ignore this email.`,
    html: `<p>Sign in to <strong>Buy A Coffee</strong>:</p><p><a href="${link}">${link}</a></p><p>The link works once and expires in 15 minutes. If you did not request it, ignore this email.</p>`,
  });
  if (error) throw new Error(`resend: ${error.message}`);
}
