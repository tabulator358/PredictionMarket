"use client";

import React, { useEffect, useMemo, useState } from "react";
import { type Address, formatUnits, parseUnits, zeroAddress } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWalletClient,
  useWriteContract,
} from "wagmi";

/**
 * Scalar Prediction Market (ERC20)
 * Dark theme + glass design
 */

// ---------------------- ABIs ----------------------
const PREDICTION_ABI = [
  {
    inputs: [
      { name: "_description", type: "string" },
      { name: "_collateral", type: "address" },
    ],
    name: "createBet",
    outputs: [{ name: "betId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "_betId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    name: "fundBet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "_betId", type: "uint256" },
      { name: "outcome1e18", type: "uint256" },
    ],
    name: "resolveBet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "_betId", type: "uint256" },
      { name: "isYes", type: "bool" },
      { name: "amountTokens", type: "uint256" },
    ],
    name: "redeem",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "uint256" }],
    name: "bets",
    outputs: [
      { name: "description", type: "string" },
      { name: "creator", type: "address" },
      { name: "yesToken", type: "address" },
      { name: "noToken", type: "address" },
      { name: "collateral", type: "address" },
      { name: "totalCollateral", type: "uint256" },
      { name: "resolved", type: "bool" },
      { name: "outcome1e18", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  { name: "betCount", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  {
    name: "getBetTokens",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }, { type: "address" }, { type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "payoutPerToken",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "balancesOf",
    inputs: [{ type: "uint256" }, { type: "address" }],
    outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bool" }, { type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ERC20_ABI = [
  { name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  {
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

// ---------------------- Helpers ----------------------
const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="glass rounded-2xl p-5 space-y-3 border border-white/10">
    <div className="text-xs uppercase tracking-wide opacity-70 mb-1">{title}</div>
    {children}
  </div>
);

function trimAddr(addr?: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "-";
}

function toOutcome1e18(x: string) {
  const t = x.trim();
  const val = t.endsWith("%") ? parseFloat(t.slice(0, -1)) / 100 : parseFloat(t);
  const clamped = Math.min(Math.max(isNaN(val) ? 0 : val, 0), 1);
  return BigInt(Math.floor(clamped * 1e18));
}

async function fetchTokenMeta(pc: ReturnType<typeof usePublicClient>["data"], address: Address) {
  try {
    const [dec, sym] = await Promise.all([
      pc!.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
      pc!.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
    ]);
    return { decimals: dec, symbol: sym };
  } catch {
    return { decimals: 18, symbol: "TOK" };
  }
}

// ---------------------- Main ----------------------
export default function PredictionPage() {
  const { address } = useAccount();
  const { data: wc } = useWalletClient();
  const pc = usePublicClient();

  // Contract + meta
  const [contract, setContract] = useState<Address | "">("");
  const [decimals, setDecimals] = useState(18);
  const [collatSymbol, setCollatSymbol] = useState("TOK");

  // UI states
  const [newDesc, setNewDesc] = useState("");
  const [newCollat, setNewCollat] = useState<"" | Address>("");

  const [fundBetId, setFundBetId] = useState("0");
  const [fundAmount, setFundAmount] = useState("");

  const [resBetId, setResBetId] = useState("0");
  const [outcomeTxt, setOutcomeTxt] = useState("0.5");

  const [redBetId, setRedBetId] = useState("0");
  const [isYes, setIsYes] = useState(true);
  const [redeemAmount, setRedeemAmount] = useState("");

  const [betIdInfo, setBetIdInfo] = useState("0");
  const betIdNum = useMemo(() => Number(betIdInfo || 0), [betIdInfo]);

  // ---------------------- Reads ----------------------
  const { data: betCount } = useReadContract({
    address: contract || undefined,
    abi: PREDICTION_ABI,
    functionName: "betCount",
    query: { enabled: Boolean(contract) },
  });

  const { data: betTuple } = useReadContract({
    address: contract || undefined,
    abi: PREDICTION_ABI,
    functionName: "bets",
    args: [BigInt(betIdNum || 0)],
    query: { enabled: Boolean(contract) },
  });

  const { data: payoutTuple } = useReadContract({
    address: contract || undefined,
    abi: PREDICTION_ABI,
    functionName: "payoutPerToken",
    args: [BigInt(betIdNum || 0)],
    query: { enabled: Boolean(contract) },
  });

  const { data: balancesTuple } = useReadContract({
    address: contract || undefined,
    abi: PREDICTION_ABI,
    functionName: "balancesOf",
    args: [BigInt(betIdNum || 0), (address ?? zeroAddress) as Address],
    query: { enabled: Boolean(contract && address) },
  });

  useEffect(() => {
    (async () => {
      if (!pc || !contract) return;
      try {
        const tokens = (await pc.readContract({
          address: contract as Address,
          abi: PREDICTION_ABI,
          functionName: "getBetTokens",
          args: [BigInt(betIdNum || 0)],
        })) as readonly [Address, Address, Address];
        const meta = await fetchTokenMeta(pc, tokens[2]);
        setDecimals(meta.decimals);
        setCollatSymbol(meta.symbol);
      } catch {}
    })();
  }, [pc, contract, betIdNum]);

  // ---------------------- Writes ----------------------
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: txLoading } = useWaitForTransactionReceipt({ hash: txHash });

  async function onCreateBet() {
    if (!contract || !newCollat) return;
    await writeContractAsync({
      address: contract as Address,
      abi: PREDICTION_ABI,
      functionName: "createBet",
      args: [newDesc, newCollat],
    });
    setNewDesc("");
  }

  async function onFundBet() {
    if (!contract || !fundAmount) return;
    const id = BigInt(Number(fundBetId || 0));

    const tokens = (await pc!.readContract({
      address: contract as Address,
      abi: PREDICTION_ABI,
      functionName: "getBetTokens",
      args: [id],
    })) as readonly [Address, Address, Address];
    const collateral = tokens[2];

    const d = (await pc!.readContract({
      address: collateral,
      abi: ERC20_ABI,
      functionName: "decimals",
    })) as number;
    const amountRaw = parseUnits(fundAmount, d);

    const approveHash = await wc!.writeContract({
      address: collateral,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [contract as Address, amountRaw],
      account: address!,
      chain: await wc!.getChainId(),
    });
    await pc!.waitForTransactionReceipt({ hash: approveHash });

    await writeContractAsync({
      address: contract as Address,
      abi: PREDICTION_ABI,
      functionName: "fundBet",
      args: [id, amountRaw],
    });
  }

  async function onResolveBet() {
    if (!contract) return;
    const id = BigInt(Number(resBetId || 0));
    const outcome = toOutcome1e18(outcomeTxt);
    await writeContractAsync({
      address: contract as Address,
      abi: PREDICTION_ABI,
      functionName: "resolveBet",
      args: [id, outcome],
    });
  }

  async function onRedeem() {
    if (!contract || !redeemAmount) return;
    const id = BigInt(Number(redBetId || 0));
    const [yes, no] = (await pc!.readContract({
      address: contract as Address,
      abi: PREDICTION_ABI,
      functionName: "getBetTokens",
      args: [id],
    })) as readonly [Address, Address, Address];

    const token = isYes ? yes : no;
    const amountRaw = parseUnits(redeemAmount, 18);

    const approveHash = await wc!.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [contract as Address, amountRaw],
      account: address!,
      chain: await wc!.getChainId(),
    });
    await pc!.waitForTransactionReceipt({ hash: approveHash });

    await writeContractAsync({
      address: contract as Address,
      abi: PREDICTION_ABI,
      functionName: "redeem",
      args: [id, isYes, amountRaw],
    });
  }

  // ---------------------- UI ----------------------
  const inputCls =
    "w-full rounded-xl border border-white/10 bg-white/5 p-2 text-base-content placeholder:opacity-70 focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8 text-base-content">
      <div className="glass p-6 rounded-2xl">
        <h1 className="text-3xl font-bold">Scalar Prediction Market (ERC20)</h1>
        <p className="opacity-80 mt-1">
          Works with an already deployed <code>PredictionMarketERC20</code> contract.
        </p>
      </div>

      <Card title="1) Contract">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <label className="text-sm opacity-70">Contract address</label>
            <input className={inputCls} value={contract} onChange={e => setContract(e.target.value as Address)} />
          </div>
          <div>
            <label className="text-sm opacity-70">Decimals</label>
            <input
              className={`${inputCls} w-24`}
              type="number"
              min={0}
              max={36}
              value={decimals}
              onChange={e => setDecimals(parseInt(e.target.value || "18"))}
            />
          </div>
          <div className="text-sm opacity-70">
            Total bets: <span className="font-mono">{betCount?.toString() ?? "-"}</span>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="2) Create a bet">
          <label className="text-sm opacity-70">Description</label>
          <input className={inputCls} value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          <label className="text-sm opacity-70 mt-2">Collateral address</label>
          <input className={inputCls} value={newCollat} onChange={e => setNewCollat(e.target.value as Address)} />
          <button
            className="btn btn-primary w-full mt-3"
            onClick={onCreateBet}
            disabled={!newCollat || !newDesc || isPending}
          >
            {isPending || txLoading ? "Sending…" : "Create Bet"}
          </button>
        </Card>

        <Card title="3) Fund a bet">
          <label className="text-sm opacity-70">Bet ID</label>
          <input className={inputCls} value={fundBetId} onChange={e => setFundBetId(e.target.value)} />
          <label className="text-sm opacity-70 mt-2">Amount ({collatSymbol})</label>
          <input className={inputCls} value={fundAmount} onChange={e => setFundAmount(e.target.value)} />
          <button className="btn btn-primary w-full mt-3" onClick={onFundBet} disabled={!fundAmount || isPending}>
            {isPending || txLoading ? "Sending…" : "Approve & Fund"}
          </button>
        </Card>

        <Card title="4) Resolve a bet">
          <label className="text-sm opacity-70">Bet ID</label>
          <input className={inputCls} value={resBetId} onChange={e => setResBetId(e.target.value)} />
          <label className="text-sm opacity-70 mt-2">Outcome (0..1 or %)</label>
          <input className={inputCls} value={outcomeTxt} onChange={e => setOutcomeTxt(e.target.value)} />
          <button className="btn btn-primary w-full mt-3" onClick={onResolveBet} disabled={isPending}>
            {isPending || txLoading ? "Sending…" : "Resolve"}
          </button>
        </Card>

        <Card title="5) Redeem (YES/NO)">
          <label className="text-sm opacity-70">Bet ID</label>
          <input className={inputCls} value={redBetId} onChange={e => setRedBetId(e.target.value)} />
          <label className="text-sm opacity-70 mt-2">Token amount</label>
          <input className={inputCls} value={redeemAmount} onChange={e => setRedeemAmount(e.target.value)} />

          <div className="flex gap-4 mt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={isYes} onChange={() => setIsYes(true)} /> YES
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={!isYes} onChange={() => setIsYes(false)} /> NO
            </label>
          </div>

          <button className="btn btn-primary w-full mt-3" onClick={onRedeem} disabled={!redeemAmount || isPending}>
            {isPending || txLoading ? "Sending…" : "Approve & Redeem"}
          </button>
        </Card>
      </div>

      <Card title="6) Info panel / read">
        <label className="text-sm opacity-70">Bet ID</label>
        <input className={inputCls} value={betIdInfo} onChange={e => setBetIdInfo(e.target.value)} />

        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div className="glass p-3 rounded-xl">
            <div className="text-xs opacity-70 mb-1">YES / NO / Collateral</div>
            <div className="font-mono text-sm break-all">
              {betTuple ? (
                <>
                  <div>YES: {trimAddr((betTuple as any)[2])}</div>
                  <div>NO: {trimAddr((betTuple as any)[3])}</div>
                  <div>COL: {trimAddr((betTuple as any)[4])}</div>
                </>
              ) : (
                "-"
              )}
            </div>
          </div>

          <div className="glass p-3 rounded-xl">
            <div className="text-xs opacity-70 mb-1">Status</div>
            <div className="text-sm">
              <div>Description: {(betTuple as any)?.[0] ?? "-"}</div>
              <div>Creator: {trimAddr((betTuple as any)?.[1])}</div>
              <div>
                Pool: {(betTuple as any)?.[5] ? formatUnits((betTuple as any)[5], decimals) : "-"} {collatSymbol}
              </div>
              <div>Resolved: {(betTuple as any)?.[6] ? "yes" : "no"}</div>
              <div>Outcome: {(betTuple as any)?.[7] ? Number((betTuple as any)[7]) / 1e18 : "-"}</div>
            </div>
          </div>
        </div>

        {payoutTuple && (
          <div className="glass p-3 rounded-xl mt-3">
            <div className="text-xs opacity-70 mb-1">Payout per 1 token</div>
            <div className="text-sm font-mono">
              YES: {Number((payoutTuple as any)[0]) / 1e18} | NO: {Number((payoutTuple as any)[1]) / 1e18}
            </div>
          </div>
        )}
      </Card>

      {txHash && (
        <div className="text-sm opacity-70">
          Tx:{" "}
          <a className="underline" target="_blank" href={`https://explorer.zora.energy/tx/${txHash}`} rel="noreferrer">
            {txHash}
          </a>
        </div>
      )}
    </div>
  );
}
