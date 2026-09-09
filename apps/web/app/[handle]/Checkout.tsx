"use client";

import { useEffect, useMemo, useState } from "react";
import { createPublicClient, createWalletClient, custom, formatUnits, http, type Address, type Hex } from "viem";
import type { PublicConfig } from "@/lib/config";

type Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
type Wallet = { name: string; icon?: string; provider: Provider };

const ERC20_BALANCE = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

function discoverWallets(): Promise<Wallet[]> {
  return new Promise((resolve) => {
    const found = new Map<string, Wallet>();
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent).detail as { info: { name: string; icon: string; rdns: string }; provider: Provider };
      found.set(d.info.rdns, { name: d.info.name, icon: d.info.icon, provider: d.provider });
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      const eth = (window as unknown as { ethereum?: Provider }).ethereum;
      if (found.size === 0 && eth) found.set("injected", { name: "Browser wallet", provider: eth });
      resolve([...found.values()]);
    }, 300);
  });
}

type Step = "idle" | "connecting" | "ready" | "signing" | "settling" | "paid" | "failed";

export default function Checkout(props: {
  handle: string;
  payTo: string;
  amounts: number[];
  presetAmount: number | null;
  presetMemo: string;
  returnTo: string | null;
  returnAllowed: boolean;
  config: PublicConfig;
}) {
  const { config } = props;
  const presets = props.amounts.length ? props.amounts : [5, 10, 50];
  const [amount, setAmount] = useState<number>(props.presetAmount ?? presets[0]);
  const [customAmount, setCustomAmount] = useState<string>(props.presetAmount && !presets.includes(props.presetAmount) ? String(props.presetAmount) : "");
  const [memo, setMemo] = useState(props.presetMemo);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);

  useEffect(() => {
    discoverWallets().then(setWallets);
  }, []);

  const publicClient = useMemo(() => createPublicClient({ transport: http(config.rpcUrl) }), [config.rpcUrl]);

  const effectiveAmount = customAmount ? Number(customAmount) : amount;
  const amountOk = Number.isFinite(effectiveAmount) && effectiveAmount >= config.minUsdc && effectiveAmount <= config.maxUsdc;
  const fee = amountOk ? (effectiveAmount * config.feeBps) / 10000 : 0;

  async function connect(w: Wallet) {
    setError(null);
    setStep("connecting");
    try {
      const accounts = (await w.provider.request({ method: "eth_requestAccounts" })) as string[];
      const acct = accounts[0] as Address;
      const hexChain = `0x${config.chainId.toString(16)}`;
      const current = (await w.provider.request({ method: "eth_chainId" })) as string;
      if (current.toLowerCase() !== hexChain) {
        try {
          await w.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChain }] });
        } catch (e: unknown) {
          const code = (e as { code?: number }).code;
          if (code === 4902) {
            await w.provider.request({
              method: "wallet_addEthereumChain",
              params: [{ chainId: hexChain, chainName: config.networkName, rpcUrls: [config.rpcUrl], nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 } }],
            });
          } else throw e;
        }
      }
      const bal = (await publicClient.readContract({ address: config.usdc as Address, abi: ERC20_BALANCE, functionName: "balanceOf", args: [acct] })) as bigint;
      setWallet(w);
      setAccount(acct);
      setBalance(formatUnits(bal, 6));
      setStep("ready");
    } catch (e: unknown) {
      setError((e as Error).message || "Could not connect");
      setStep("idle");
    }
  }

  async function pay() {
    if (!wallet || !account || !amountOk) return;
    setError(null);
    try {
      setStep("signing");
      const prep = await fetch("/api/checkout/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: props.handle, amount: effectiveAmount, memo, returnTo: props.returnTo, from: account }),
      }).then((r) => r.json());
      if (!prep.ok) throw new Error(prep.error || "Could not prepare the payment");

      const walletClient = createWalletClient({ account, transport: custom(wallet.provider as never) });
      const signature = (await walletClient.signTypedData({
        account,
        domain: prep.typedData.domain,
        types: prep.typedData.types,
        primaryType: prep.typedData.primaryType,
        message: {
          ...prep.typedData.message,
          value: BigInt(prep.typedData.message.value),
          validAfter: BigInt(prep.typedData.message.validAfter),
          validBefore: BigInt(prep.typedData.message.validBefore),
        },
      })) as Hex;

      setStep("settling");
      const res = await fetch("/api/checkout/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coffeeId: prep.coffeeId, signature }),
      }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error || "Settlement failed");
      setTx(res.transaction || null);
      setStep("paid");
      if (res.redirect) {
        setTimeout(() => {
          window.location.href = res.redirect;
        }, 1500);
      }
    } catch (e: unknown) {
      const m = (e as Error).message || "Payment failed";
      setError(m.includes("User rejected") || m.includes("denied") ? "Signature cancelled." : m);
      setStep(wallet ? "ready" : "idle");
    }
  }

  function cancel() {
    if (props.returnTo && props.returnAllowed) {
      const u = new URL(props.returnTo);
      u.searchParams.set("coffee", "cancelled");
      window.location.href = u.toString();
    } else {
      window.history.length > 1 ? window.history.back() : (window.location.href = "/");
    }
  }

  if (step === "paid") {
    return (
      <section className="card" style={{ marginTop: "1.5rem" }}>
        <div className="lbl">Thank you</div>
        <h2 style={{ marginTop: ".4rem" }}>Coffee delivered ☕</h2>
        <p className="dim">
          {effectiveAmount} USDC sent to {props.handle}.{" "}
          {tx ? <a href={txLink(config.network, tx)} target="_blank" rel="noreferrer">View transaction</a> : null}
        </p>
        {props.returnTo && props.returnAllowed ? <p className="note">Taking you back…</p> : props.returnTo ? <p className="note">You can close this tab and return to the original page.</p> : null}
      </section>
    );
  }

  return (
    <section className="card" style={{ marginTop: "1.5rem" }}>
      <div className="lbl">Amount · USDC on {config.networkName}</div>
      <div className="amounts">
        {presets.map((a) => (
          <button key={a} type="button" className={`amt ${!customAmount && amount === a ? "on" : ""}`} onClick={() => { setAmount(a); setCustomAmount(""); }}>
            ${a}
          </button>
        ))}
        <input
          type="number"
          className={`amt ${customAmount ? "on" : ""}`}
          placeholder="Custom"
          min={config.minUsdc}
          max={config.maxUsdc}
          step="0.5"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
        />
      </div>
      <label className="f" htmlFor="memo">Message (optional)</label>
      <input id="memo" type="text" maxLength={140} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Say something nice" />

      <p className="note" style={{ marginTop: "1rem" }}>
        {amountOk ? (
          <>
            {props.handle} receives {(effectiveAmount - fee).toFixed(2)} USDC · {fee.toFixed(2)} USDC covers the facilitator&apos;s gas (2%). One signature, no gas for you.
          </>
        ) : (
          <>Enter an amount between {config.minUsdc} and {config.maxUsdc} USDC.</>
        )}
      </p>

      {!account ? (
        <div className="row" style={{ marginTop: "1rem" }}>
          {wallets.length === 0 ? (
            <p className="note">No wallet detected. Install MetaMask, Coinbase Wallet or Rabby, then reload.</p>
          ) : (
            wallets.map((w) => (
              <button key={w.name} type="button" className="btn" disabled={step === "connecting"} onClick={() => connect(w)}>
                {w.icon ? <img src={w.icon} alt="" width={16} height={16} style={{ verticalAlign: "-3px", marginRight: 6 }} /> : null}
                Connect {w.name}
              </button>
            ))
          )}
          <button type="button" className="btn ghost" onClick={cancel}>Cancel</button>
        </div>
      ) : (
        <div className="row" style={{ marginTop: "1rem" }}>
          <button type="button" className="btn" disabled={!amountOk || step === "signing" || step === "settling" || (balance !== null && Number(balance) < effectiveAmount)} onClick={pay}>
            {step === "signing" ? "Sign in your wallet…" : step === "settling" ? "Settling on-chain…" : `Pay $${amountOk ? effectiveAmount : ""}`}
          </button>
          <button type="button" className="btn ghost" onClick={cancel}>Cancel</button>
          <span className="note">
            {account.slice(0, 6)}…{account.slice(-4)} · {balance !== null ? `${Number(balance).toFixed(2)} USDC` : ""}
          </span>
        </div>
      )}
      {balance !== null && amountOk && Number(balance) < effectiveAmount ? (
        <p className="msg err">Not enough USDC on {config.networkName}. {config.network === "base" ? <a href="https://www.coinbase.com/price/usd-coin" target="_blank" rel="noreferrer">Get USDC on Base</a> : <a href="https://faucet.circle.com/" target="_blank" rel="noreferrer">Get test USDC</a>}</p>
      ) : null}
      {error ? <p className="msg err">{error}</p> : null}
    </section>
  );
}

function txLink(network: string, tx: string) {
  return network === "base" ? `https://basescan.org/tx/${tx}` : `https://sepolia.basescan.org/tx/${tx}`;
}
