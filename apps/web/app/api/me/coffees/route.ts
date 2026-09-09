import { NextResponse } from "next/server";
import { currentCreator } from "@/lib/auth";
import { countSettled, listCoffees } from "@/lib/db";

export async function GET() {
  const me = await currentCreator();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [coffees, stats] = await Promise.all([listCoffees(me.id), countSettled(me.id)]);
  return NextResponse.json({ coffees, stats });
}
