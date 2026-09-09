import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { currentCreator } from "@/lib/auth";
import { getCreatorByHandle, HANDLE_RE, RESERVED_HANDLES, updateCreator } from "@/lib/db";
import { normalizeOrigin } from "@/lib/returnTo";

export async function GET() {
  const me = await currentCreator();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ creator: me });
}

const Body = z.object({
  handle: z.string().min(3).max(32).optional(),
  payTo: z.string().refine((v) => isAddress(v, { strict: false }), "invalid address").optional(),
  displayName: z.string().max(80).optional(),
  avatarUrl: z.string().url().max(500).optional().or(z.literal("")),
  message: z.string().max(280).optional(),
  amounts: z.array(z.number().min(1).max(1000)).min(1).max(4).optional(),
  allowedOrigins: z.array(z.string().max(200)).max(20).optional(),
});

export async function PUT(req: Request) {
  const me = await currentCreator();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  const b = parsed.data;

  let handle: string | undefined;
  if (b.handle !== undefined) {
    handle = b.handle.toLowerCase();
    if (!HANDLE_RE.test(handle) || RESERVED_HANDLES.has(handle)) {
      return NextResponse.json({ error: "Handle: 3 to 32 chars, letters, numbers and hyphens" }, { status: 400 });
    }
    const taken = await getCreatorByHandle(handle);
    if (taken && taken.id !== me.id) return NextResponse.json({ error: "That handle is taken" }, { status: 409 });
  }
  const origins = b.allowedOrigins?.map(normalizeOrigin).filter((o): o is string => !!o);

  const updated = await updateCreator(me.id, {
    handle,
    pay_to: b.payTo?.toLowerCase(),
    display_name: b.displayName,
    avatar_url: b.avatarUrl === "" ? null : b.avatarUrl,
    message: b.message,
    default_amounts: b.amounts,
    allowed_origins: origins,
  });
  return NextResponse.json({ creator: updated });
}
