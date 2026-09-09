/**
 * Vendor-domain ownership proof for the PerkOS facilitator (Stack).
 * Stack's "file_upload" verification fetches /.well-known/perkos-verify.txt
 * and expects the token it issued when the domain was claimed.
 */
export async function GET() {
  const token = process.env.PERKOS_VERIFY_TOKEN || "";
  if (!token) return new Response("not configured", { status: 404 });
  return new Response(token, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
