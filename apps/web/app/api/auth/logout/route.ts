import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { APP_URL } from "@/lib/config";

export async function POST() {
  await clearSession();
  return NextResponse.redirect(`${APP_URL}/`, { status: 303 });
}
