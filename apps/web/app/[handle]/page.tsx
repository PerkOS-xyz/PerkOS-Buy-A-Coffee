import { notFound } from "next/navigation";
import { getCreatorByHandle } from "@/lib/db";
import { publicConfig } from "@/lib/config";
import { isAllowedReturnTo } from "@/lib/returnTo";
import { APP_URL } from "@/lib/config";
import Checkout from "./Checkout";

export const dynamic = "force-dynamic";

type Search = { return_to?: string; amount?: string; memo?: string };

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Search>;
}) {
  const { handle } = await params;
  const q = await searchParams;
  const creator = await getCreatorByHandle(handle);
  if (!creator || !creator.active || !creator.pay_to || !creator.handle) notFound();

  const returnTo = typeof q.return_to === "string" ? q.return_to : null;
  const returnAllowed = isAllowedReturnTo(returnTo, creator.allowed_origins, APP_URL);
  const preset = q.amount ? Number(q.amount) : null;

  return (
    <main className="wrap">
      <div className="row" style={{ gap: "1rem" }}>
        {creator.avatar_url ? <img className="avatar" src={creator.avatar_url} alt="" /> : null}
        <div>
          <div className="lbl">Buy a coffee for</div>
          <h1>{creator.display_name || creator.handle}</h1>
        </div>
      </div>
      {creator.message ? <p className="dim">{creator.message}</p> : null}
      <Checkout
        handle={creator.handle}
        payTo={creator.pay_to}
        displayName={creator.display_name || creator.handle}
        amounts={creator.default_amounts}
        presetAmount={preset && Number.isFinite(preset) ? preset : null}
        presetMemo={typeof q.memo === "string" ? q.memo.slice(0, 140) : ""}
        returnTo={returnTo}
        returnAllowed={returnAllowed}
        config={publicConfig()}
      />
    </main>
  );
}
