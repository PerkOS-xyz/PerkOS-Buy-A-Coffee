import { countSettled, getCreatorByHandle } from "@/lib/db";

/** GET /badge/{handle}.svg — a README badge that links to the checkout. */
export async function GET(_req: Request, ctx: { params: Promise<{ handle: string }> }) {
  const raw = (await ctx.params).handle;
  const handle = raw.replace(/\.svg$/i, "");
  let c = null;
  let count = 0;
  try {
    c = await getCreatorByHandle(handle);
    if (c) count = (await countSettled(c.id)).count;
  } catch (e) {
    console.error("badge: db unavailable", (e as Error).message);
  }
  const label = "Buy me an x402 coffee";
  const right = c ? (count > 0 ? `☕ ${count}` : "☕ USDC") : "not found";
  const lw = 10 + label.length * 6.6;
  const rw = 14 + right.length * 6.6;
  const w = Math.round(lw + rw);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${label}: ${right}">
<title>${label}: ${right}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${Math.round(lw)}" height="20" fill="#0c0f13"/><rect x="${Math.round(lw)}" width="${Math.round(rw)}" height="20" fill="#e0a145"/><rect width="${w}" height="20" fill="url(#s)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${Math.round(lw / 2)}" y="14" fill="#e9e4d9">${label}</text>
<text x="${Math.round(lw + rw / 2)}" y="14" fill="#0c0f13" font-weight="bold">${right}</text>
</g></svg>`;
  return new Response(svg, {
    status: 200,
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=600" },
  });
}
