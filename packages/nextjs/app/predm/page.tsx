"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWalletClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseEther, parseUnits, formatUnits, zeroAddress, type Address } from "viem";

/**
 * Drop this file into: packages/nextjs/app/prediction/page.tsx (or any route)
 * Requires Scaffold‑ETH v2 (RainbowKit + wagmi + viem already configured)
 *
 * What it does
 *  - Connect to an already deployed PredictionMarketERC20
 *  - Create bet (with ERC20 collateral)
 *  - Fund bet (ERC20 approve + fundBet)
 *  - Resolve bet (creator only)
 *  - Redeem YES/NO (approve YES/NO for burnFrom + redeem)
 *  - Read helpers: bets(), getBetTokens(), payoutPerToken(), balancesOf()
 *
 * Notes
 *  - All amounts are in token UNITS (human). Internally converted to raw via token decimals (default 18).
 *  - If your collateral or PredictionToken uses non-18 decimals, set the decimals field appropriately in the UI.
 */

// ---------------------- ABIs ----------------------
const PREDICTION_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "_description", "type": "string" },
      { "internalType": "contract IERC20", "name": "_collateral", "type": "address" }
    ],
    "name": "createBet",
    "outputs": [{ "internalType": "uint256", "name": "betId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_betId", "type": "uint256" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "fundBet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_betId", "type": "uint256" },
      { "internalType": "uint256", "name": "outcome1e18", "type": "uint256" }
    ],
    "name": "resolveBet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_betId", "type": "uint256" },
      { "internalType": "bool", "name": "isYes", "type": "bool" },
      { "internalType": "uint256", "name": "amountTokens", "type": "uint256" }
    ],
    "name": "redeem",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // public mapping getter: bets(betId) -> Bet struct
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "bets",
    "outputs": [
      { "internalType": "string", "name": "description", "type": "string" },
      { "internalType": "address", "name": "creator", "type": "address" },
      { "internalType": "address", "name": "yesToken", "type": "address" },
      { "internalType": "address", "name": "noToken", "type": "address" },
      { "internalType": "address", "name": "collateral", "type": "address" },
      { "internalType": "uint256", "name": "totalCollateral", "type": "uint256" },
      { "internalType": "bool", "name": "resolved", "type": "bool" },
      { "internalType": "uint256", "name": "outcome1e18", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "betCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_betId", "type": "uint256" }],
    "name": "getBetTokens",
    "outputs": [
      { "internalType": "address", "name": "yes", "type": "address" },
      { "internalType": "address", "name": "no", "type": "address" },
      { "internalType": "address", "name": "collateral", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_betId", "type": "uint256" }],
    "name": "payoutPerToken",
    "outputs": [
      { "internalType": "uint256", "name": "yesPerToken", "type": "uint256" },
      { "internalType": "uint256", "name": "noPerToken", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_betId", "type": "uint256" },
      { "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "balancesOf",
    "outputs": [
      { "internalType": "uint256", "name": "yesBalance", "type": "uint256" },
      { "internalType": "uint256", "name": "noBalance", "type": "uint256" },
      { "internalType": "uint256", "name": "poolCollateral", "type": "uint256" },
      { "internalType": "bool", "name": "isResolved", "type": "bool" },
      { "internalType": "uint256", "name": "outcome1e18", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const ERC20_ABI = [
  { "type": "function", "name": "decimals", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "uint8" }] },
  { "type": "function", "name": "symbol", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "string" }] },
  { "type": "function", "name": "balanceOf", "stateMutability": "view", "inputs": [{ "type": "address" }], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "allowance", "stateMutability": "view", "inputs": [{ "type": "address" }, { "type": "address" }], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "approve", "stateMutability": "nonpayable", "inputs": [{ "type": "address" }, { "type": "uint256" }], "outputs": [{ "type": "bool" }] }
] as const;

// ---------------------- Helpers ----------------------
const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border p-5 shadow-sm bg-white/50 dark:bg-zinc-900/40">
    <div className="text-sm uppercase tracking-wide text-zinc-500 mb-3">{title}</div>
    {children}
  </div>
);

function trimAddr(addr?: string) {
  if (!addr) return "-";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function toOutcome1e18(x: string) {
  // Accepts either decimal in 0..1 (e.g. "0.42") or percent with % (e.g. "42%")
  const t = x.trim();
  const val = t.endsWith("%") ? parseFloat(t.slice(0, -1)) / 100 : parseFloat(t);
  if (isNaN(val)) return 0n;
  const clamped = Math.min(Math.max(val, 0), 1);
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

// ---------------------- Main Page ----------------------
export default function PredictionPage() {
  const { address } = useAccount();
  const { data: wc } = useWalletClient();
  const pc = usePublicClient();

  const [contract, setContract] = useState<Address | "">("");
  const [decimals, setDecimals] = useState<number>(18); // UI default
  const [collatSymbol, setCollatSymbol] = useState<string>("TOK");

  // Bet state for info panel
  const [betIdInfo, setBetIdInfo] = useState<string>("0");
  const betIdNum = useMemo(() => Number(betIdInfo || 0), [betIdInfo]);

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
    // When betId changes, try to fetch token meta from collateral
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

  // ---------------------- Actions ----------------------
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: txLoading, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // createBet
  const [newDesc, setNewDesc] = useState("");
  const [newCollat, setNewCollat] = useState<"" | Address>("");

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

  // fundBet (approve on collateral -> fundBet)
  const [fundBetId, setFundBetId] = useState("0");
  const [fundAmount, setFundAmount] = useState("");

  async function onFundBet() {
    if (!contract || !fundAmount || !newCollat) return;
    const id = BigInt(Number(fundBetId || 0));

    // 1) read collateral from bet
    const tokens = (await pc!.readContract({
      address: contract as Address,
      abi: PREDICTION_ABI,
      functionName: "getBetTokens",
      args: [id],
    })) as readonly [Address, Address, Address];
    const collateral = tokens[2];

    // token decimals
    const d = await pc!.readContract({ address: collateral, abi: ERC20_ABI, functionName: "decimals" }) as number;
    const amountRaw = parseUnits(fundAmount, d);

    // 2) approve
    const approveHash = await wc!.writeContract({
      address: collateral,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [contract as Address, amountRaw],
      account: address!,
      chain: await wc!.getChainId(),
    });
    await pc!.waitForTransactionReceipt({ hash: approveHash });

    // 3) fundBet
    await writeContractAsync({
      address: contract as Address,
      abi: PREDICTION_ABI,
      functionName: "fundBet",
      args: [id, amountRaw],
    });
  }

  // resolveBet
  const [resBetId, setResBetId] = useState("0");
  const [outcomeTxt, setOutcomeTxt] = useState("0.5");
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

  // redeem (approve YES/NO -> redeem)
  const [redBetId, setRedBetId] = useState("0");
  const [isYes, setIsYes] = useState(true);
  const [redeemAmount, setRedeemAmount] = useState("");

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

    // assume PredictionToken has 18 decimals; if not, user can adjust input by decimals they know
    const amountRaw = parseUnits(redeemAmount, 18);

    // 1) approve burning
    const approveHash = await wc!.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [contract as Address, amountRaw],
      account: address!,
      chain: await wc!.getChainId(),
    });
    await pc!.waitForTransactionReceipt({ hash: approveHash });

    // 2) redeem
    await writeContractAsync({
      address: contract as Address,
      abi: PREDICTION_ABI,
      functionName: "redeem",
      args: [id, isYes, amountRaw],
    });
  }

  // ---------------------- UI ----------------------
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <h1 className="text-3xl md:text-4xl font-semibold">Scalar Prediction Market (ERC20)</h1>
      <p className="text-zinc-500">Pracuje s již deploynutým kontraktem <code>PredictionMarketERC20</code>. Zadej jeho adresu níže.</p>

      <Card title="1) Kontrakt">
        <div className="flex flex-col md:flex-row items-start md:items-end gap-3">
          <div className="flex-1">
            <label className="text-sm text-zinc-500">Adresa kontraktu</label>
            <input
              className="w-full rounded-xl border p-2 bg-transparent"
              placeholder="0x…"
              value={contract}
              onChange={e => setContract(e.target.value as Address)}
            />
          </div>
          <div>
            <label className="text-sm text-zinc-500">Desetinná místa kolaterálu</label>
            <input
              className="w-28 rounded-xl border p-2 bg-transparent"
              type="number"
              min={0}
              max={36}
              value={decimals}
              onChange={e => setDecimals(parseInt(e.target.value || "18"))}
            />
          </div>
          <div className="text-sm text-zinc-500">Betů celkem: <span className="font-mono">{betCount?.toString() ?? "-"}</span></div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="2) Vytvořit sázku">
          <div className="space-y-2">
            <div>
              <label className="text-sm text-zinc-500">Popis</label>
              <input className="w-full rounded-xl border p-2 bg-transparent" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-zinc-500">Adresa kolaterálu (ERC20)</label>
              <input className="w-full rounded-xl border p-2 bg-transparent" placeholder="0x…" value={newCollat} onChange={e => setNewCollat(e.target.value as Address)} />
            </div>
            <button
              onClick={onCreateBet}
              disabled={!contract || !newCollat || !newDesc || isPending}
              className="rounded-xl px-4 py-2 bg-black text-white disabled:opacity-50"
            >
              {isPending || txLoading ? "Odesílám…" : "Create Bet"}
            </button>
          </div>
        </Card>

        <Card title="3) Fundovat sázku (approve + fundBet)">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-1">
              <label className="text-sm text-zinc-500">Bet ID</label>
              <input className="w-full rounded-xl border p-2 bg-transparent" value={fundBetId} onChange={e => setFundBetId(e.target.value)} />
            </div>
            <div className="col-span-1">
              <label className="text-sm text-zinc-500">Částka ({collatSymbol})</label>
              <input className="w-full rounded-xl border p-2 bg-transparent" value={fundAmount} onChange={e => setFundAmount(e.target.value)} />
            </div>
            <div className="col-span-2">
              <button
                onClick={onFundBet}
                disabled={!contract || !fundAmount || isPending}
                className="rounded-xl px-4 py-2 bg-black text-white disabled:opacity-50"
              >
                {isPending || txLoading ? "Odesílám…" : "Approve & Fund"}
              </button>
            </div>
          </div>
        </Card>

        <Card title="4) Ukončit sázku (resolve)">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-zinc-500">Bet ID</label>
              <input className="w-full rounded-xl border p-2 bg-transparent" value={resBetId} onChange={e => setResBetId(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-zinc-500">Outcome (0..1 nebo %)</label>
              <input className="w-full rounded-xl border p-2 bg-transparent" value={outcomeTxt} onChange={e => setOutcomeTxt(e.target.value)} />
            </div>
            <div className="col-span-2">
              <button
                onClick={onResolveBet}
                disabled={!contract || isPending}
                className="rounded-xl px-4 py-2 bg-black text-white disabled:opacity-50"
              >
                {isPending || txLoading ? "Odesílám…" : "Resolve"}
              </button>
            </div>
          </div>
        </Card>

        <Card title="5) Vyplatit (redeem YES/NO)">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-zinc-500">Bet ID</label>
              <input className="w-full rounded-xl border p-2 bg-transparent" value={redBetId} onChange={e => setRedBetId(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-zinc-500">Množství tokenů</label>
              <input className="w-full rounded-xl border p-2 bg-transparent" value={redeemAmount} onChange={e => setRedeemAmount(e.target.value)} />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2">
                <input type="radio" checked={isYes} onChange={() => setIsYes(true)} /> YES
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={!isYes} onChange={() => setIsYes(false)} /> NO
              </label>
            </div>
            <div className="col-span-2">
              <button
                onClick={onRedeem}
                disabled={!contract || !redeemAmount || isPending}
                className="rounded-xl px-4 py-2 bg-black text-white disabled:opacity-50"
              >
                {isPending || txLoading ? "Odesílám…" : "Approve & Redeem"}
              </button>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">Pozn.: Před redeem je nutné approve na zvoleném YES/NO pro tento kontrakt, protože volá <code>burnFrom</code>.</p>
        </Card>
      </div>

      <Card title="6) Info panel / čtení">
        <div className="grid md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-1">
            <label className="text-sm text-zinc-500">Bet ID</label>
            <input className="w-full rounded-xl border p-2 bg-transparent" value={betIdInfo} onChange={e => setBetIdInfo(e.target.value)} />
          </div>
          <div className="md:col-span-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-3">
              <div className="text-xs text-zinc-500 mb-1">YES/NO/Collateral</div>
              <div className="font-mono text-sm break-all">
                {betTuple ? (
                  <>
                    <div>YES: {trimAddr((betTuple as any)[2])}</div>
                    <div>NO: {trimAddr((betTuple as any)[3])}</div>
                    <div>COL: {trimAddr((betTuple as any)[4])}</div>
                  </>
                ) : (
                  <>-</>
                )}
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-zinc-500 mb-1">Stav</div>
              <div className="text-sm">
                <div>Popis: {(betTuple as any)?.[0] ?? "-"}</div>
                <div>Tvůrce: <span className="font-mono">{trimAddr((betTuple as any)?.[1])}</span></div>
                <div>Pool: {(betTuple as any)?.[5] ? formatUnits((betTuple as any)[5], decimals) : "-"} {collatSymbol}</div>
                <div>Resolved: {(betTuple as any)?.[6] ? "ano" : "ne"}</div>
                <div>Outcome1e18: {(betTuple as any)?.[7] ? Number((betTuple as any)[7]) / 1e18 : "-"}</div>
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-zinc-500 mb-1">Výplata na 1 token (škálováno 1e18)</div>
              <div className="text-sm font-mono">
                {payoutTuple ? (
                  <>
                    <div>YES: {Number((payoutTuple as any)[0]) / 1e18}</div>
                    <div>NO: {Number((payoutTuple as any)[1]) / 1e18}</div>
                  </>
                ) : (
                  <>-</>
                )}
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-zinc-500 mb-1">Moje balanc(e)</div>
              <div className="text-sm font-mono">
                {balancesTuple ? (
                  <>
                    <div>YES: {formatUnits((balancesTuple as any)[0] ?? 0n, 18)}</div>
                    <div>NO: {formatUnits((balancesTuple as any)[1] ?? 0n, 18)}</div>
                    <div>Pool: {formatUnits((balancesTuple as any)[2] ?? 0n, decimals)} {collatSymbol}</div>
                    <div>Resolved: {(balancesTuple as any)[3] ? "ano" : "ne"}</div>
                    <div>Outcome: {Number((balancesTuple as any)[4] ?? 0n) / 1e18}</div>
                  </>
                ) : (
                  <>-</>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {txHash && (
        <div className="text-sm text-zinc-500">
          Tx: <a className="underline" target="_blank" href={`https://explorer.zora.energy/tx/${txHash}`}>{txHash}</a> (změň explorer dle sítě)
        </div>
      )}
    </div>
  );
}
