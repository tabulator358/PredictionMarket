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
import { notification } from "~~/utils/scaffold-eth/notification";
import { Address as AddressComp } from "~~/components/scaffold-eth/Address/Address";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";

/**
 * Scalar Prediction Market (ERC20)
 * Fixed contract & fixed collateral (from contract.collateral()).
 * Dark theme + glass design
 */

// ---------------------- Constants ----------------------
const ENV_MARKET_ADDRESS = process.env.NEXT_PUBLIC_PREDICTION_ADDRESS as Address | undefined;

// ---------------------- ABIs ----------------------
const PREDICTION_ABI = [
  // constructor(IERC20 _collateral) -> už je nasazený; nepotřebujeme ABI položku
  {
    name: "createBet",
    inputs: [{ name: "_description", type: "string" }],
    outputs: [{ name: "betId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    name: "fundBet",
    inputs: [
      { name: "_betId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    name: "resolveBet",
    inputs: [
      { name: "_betId", type: "uint256" },
      { name: "outcome1e18", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    name: "redeem",
    inputs: [
      { name: "_betId", type: "uint256" },
      { name: "isYes", type: "bool" },
      { name: "amountTokens", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    // mapping(uint256 => Bet)
    name: "bets",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "description", type: "string" },
      { name: "creator", type: "address" },
      { name: "yesToken", type: "address" },
      { name: "noToken", type: "address" },
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
    outputs: [{ type: "address" }, { type: "address" }],
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
  {
    // public immutable collateral;
    name: "collateral",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ERC20_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

// ---------------------- UI helpers ----------------------
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

type PublicClientLike = { readContract: (args: any) => Promise<any> };

async function fetchTokenMeta(pc: PublicClientLike, address: Address) {
  try {
    const [dec, sym] = await Promise.all([
      pc.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
      pc.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
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
  const { data: marketInfo } = useDeployedContractInfo("PredictionMarketERC20");

  const marketAddress = useMemo(() => {
    return (
      (ENV_MARKET_ADDRESS as Address | undefined) ||
      (marketInfo?.address as Address | undefined) ||
      undefined
    );
  }, [ENV_MARKET_ADDRESS, marketInfo?.address]);
  const isMarketReady = !!marketAddress;

  // Collateral meta
  const { data: collateralAddr } = useReadContract({
    address: isMarketReady ? (marketAddress as Address) : undefined,
    abi: PREDICTION_ABI,
    functionName: "collateral",
  });

  const [decimals, setDecimals] = useState(18);
  const [collatSymbol, setCollatSymbol] = useState("TOK");

  // UI states
  const [newDesc, setNewDesc] = useState("");

  const [fundBetId, setFundBetId] = useState("0");
  const [fundAmount, setFundAmount] = useState("");

  const [resBetId, setResBetId] = useState("0");
  const [outcomeTxt, setOutcomeTxt] = useState("0.5");

  const [redBetId, setRedBetId] = useState("0");
  const [isYes, setIsYes] = useState(true);
  const [redeemAmount, setRedeemAmount] = useState("");

  const [betIdInfo, setBetIdInfo] = useState("0");
  const betIdNum = useMemo(() => Number(betIdInfo || 0), [betIdInfo]);

  // Check if user is Oracle
  const ORACLE_ADDRESS = "0x9bc0ccBb80544ff09F8ac14bB07dddb688FdEE2B";
  const isOracle = useMemo(() => {
    return address && address.toLowerCase() === ORACLE_ADDRESS.toLowerCase();
  }, [address]);

  // ---------------------- Reads ----------------------
  const { data: betCount } = useReadContract({
    address: isMarketReady ? (marketAddress as Address) : undefined,
    abi: PREDICTION_ABI,
    functionName: "betCount",
  });

  const { data: betTuple } = useReadContract({
    address: isMarketReady ? (marketAddress as Address) : undefined,
    abi: PREDICTION_ABI,
    functionName: "bets",
    args: [BigInt(betIdNum || 0)],
  });

  const { data: balancesTuple } = useReadContract({
    address: isMarketReady ? (marketAddress as Address) : undefined,
    abi: PREDICTION_ABI,
    functionName: "balancesOf",
    args: [BigInt(betIdNum || 0), (address ?? zeroAddress) as Address],
  });

  // Collateral balance for connected wallet
  const { data: collateralBal, error: collateralError } = useReadContract({
    address: collateralAddr && address ? (collateralAddr as Address) : undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [((address ?? zeroAddress) as Address)],
  });

  // načti metadata kolaterálu (decimals + symbol)
  useEffect(() => {
    (async () => {
      if (!pc || !collateralAddr) return;
      try {
        const meta = await fetchTokenMeta(pc, collateralAddr as Address);
        setDecimals(meta.decimals);
        setCollatSymbol(meta.symbol);
      } catch {
        // ignore
      }
    })();
  }, [pc, collateralAddr]);

  // ---------------------- Writes ----------------------
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: txLoading } = useWaitForTransactionReceipt({ hash: txHash });

  async function onCreateBet() {
    if (!isMarketReady) return notification.error("Contract address not found. Run yarn deploy or set NEXT_PUBLIC_PREDICTION_ADDRESS.");
    if (!newDesc) return;
    await writeContractAsync({
      address: marketAddress as Address,
      abi: PREDICTION_ABI,
      functionName: "createBet",
      args: [newDesc],
    });
    setNewDesc("");
  }

  async function onApproveCollateral() {
    try {
      console.log("DEBUG - marketAddress:", marketAddress);
      console.log("DEBUG - collateralAddr:", collateralAddr);
      console.log("DEBUG - address:", address);
      console.log("DEBUG - isMarketReady:", isMarketReady);
      
      if (!isMarketReady) throw new Error("Contract address not found. Run yarn deploy or set NEXT_PUBLIC_PREDICTION_ADDRESS.");
      if (!address) throw new Error("Připoj peněženku.");
      if (!wc || !pc) throw new Error("Klient není inicializován, zkus stránku znovu načíst.");
      if (!collateralAddr) throw new Error("Kolaterál není načtený.");
      if (!fundAmount) throw new Error("Zadej částku.");

      const d =
        (await pc.readContract({
          address: collateralAddr as Address,
          abi: ERC20_ABI,
          functionName: "decimals",
        })) || 18;
      const amountRaw = parseUnits(fundAmount, Number(d));

      const approveHash = await wc.writeContract({
        address: collateralAddr as Address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [marketAddress as Address, amountRaw],
        account: address,
      });
      await pc.waitForTransactionReceipt({ hash: approveHash });

      notification.success("Approve dokončen.");
    } catch (e: any) {
      notification.error(e?.shortMessage ?? e?.message ?? "Approve selhalo");
    }
  }

  async function onFundBet() {
    try {
      if (!isMarketReady) throw new Error("Contract address not found. Run yarn deploy or set NEXT_PUBLIC_PREDICTION_ADDRESS.");
      if (!address) throw new Error("Připoj peněženku.");
      if (!fundAmount) throw new Error("Zadej částku.");

      const idNum = Number(fundBetId || 0);
      if (!Number.isFinite(idNum) || idNum < 0) throw new Error("Neplatné Bet ID.");
      const id = BigInt(idNum);

      const d =
        (await pc!.readContract({
          address: collateralAddr as Address,
          abi: ERC20_ABI,
          functionName: "decimals",
        })) || 18;
      const amountRaw = parseUnits(fundAmount, Number(d));

      await writeContractAsync({
        address: marketAddress as Address,
        abi: PREDICTION_ABI,
        functionName: "fundBet",
        args: [id, amountRaw],
      });

      notification.success("Fundování dokončeno.");
      setFundAmount("");
    } catch (e: any) {
      notification.error(e?.shortMessage ?? e?.message ?? "Fund selhalo");
    }
  }

  async function onResolveBet() {
    if (!isMarketReady) return notification.error("Contract address not found. Run yarn deploy or set NEXT_PUBLIC_PREDICTION_ADDRESS.");
    if (!address) return notification.error("Please connect your wallet first.");
    
    // Check if user is authorized to resolve (hardcoded oracle address)
    const ORACLE_ADDRESS = "0x9bc0ccBb80544ff09F8ac14bB07dddb688FdEE2B";
    if (address.toLowerCase() !== ORACLE_ADDRESS.toLowerCase()) {
      return notification.error("Only the Oracle can resolve bets. You are not authorized to resolve this bet.");
    }
    
    const id = BigInt(Number(resBetId || 0));
    const outcome = toOutcome1e18(outcomeTxt);
    await writeContractAsync({
      address: marketAddress as Address,
      abi: PREDICTION_ABI,
      functionName: "resolveBet",
      args: [id, outcome],
    });
  }

  async function onRedeem() {
    if (!isMarketReady) return notification.error("Contract address not found. Run yarn deploy or set NEXT_PUBLIC_PREDICTION_ADDRESS.");
    if (!redeemAmount) return;
    const id = BigInt(Number(redBetId || 0));
    const [yes, no] = (await pc!.readContract({
      address: marketAddress as Address,
      abi: PREDICTION_ABI,
      functionName: "getBetTokens",
      args: [id],
    })) as readonly [Address, Address];

    const token = isYes ? yes : no;
    // NOTE: PredictionToken nejspíš používá 18 dec (mintováno 1:1 ke kolaterálu),
    // takže schválně používáme 18 (pokud máš jiné decimals, uprav kontrakt/ABI).
    const amountRaw = parseUnits(redeemAmount, 18);

    const approveHash = await wc!.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [marketAddress as Address, amountRaw],
      account: address!,
    });
    await pc!.waitForTransactionReceipt({ hash: approveHash });

    await writeContractAsync({
      address: marketAddress as Address,
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
        <h1 className="text-3xl font-bold">Tab Prediction Market</h1>
        <p className="opacity-80 mt-1">
          Uses a fixed <code>PredictionMarketERC20</code> contract.
        </p>

        <div className="mt-3 text-sm">
          <div>Contract: <span className="font-mono">{marketAddress ?? "-"}</span></div>
          <div>Collateral: <span className="font-mono">{collateralAddr ? (collateralAddr as string) : "-"}</span></div>
          <div>
            Total bets: <span className="font-mono">{betCount?.toString() ?? "-"}</span>
          </div>
        </div>
        {!isMarketReady && (
          <div className="alert alert-warning mt-3">
            Contract address not detected. Deploy locally (yarn chain && yarn deploy) or set NEXT_PUBLIC_PREDICTION_ADDRESS.
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="1) Create a bet">
          <label className="text-sm opacity-70">Description</label>
          <input className={inputCls} value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          <button
            className="btn btn-primary w-full mt-3"
            onClick={onCreateBet}
            disabled={!newDesc || isPending}
          >
            {isPending || txLoading ? "Sending…" : "Create Bet"}
          </button>
        </Card>

        <Card title="2) Fund a bet">
          <label className="text-sm opacity-70">Bet ID</label>
          <input className={inputCls} value={fundBetId} onChange={e => setFundBetId(e.target.value)} />
          <label className="text-sm opacity-70 mt-2">Amount ({collatSymbol})</label>
          <input className={inputCls} value={fundAmount} onChange={e => setFundAmount(e.target.value)} />
          <div className="flex gap-2 mt-3">
            <button
              className="btn btn-secondary flex-1"
              onClick={onApproveCollateral}
              disabled={!fundAmount || !address || !collateralAddr || !isMarketReady || isPending}
            >
              {isPending || txLoading ? "Sending…" : "Approve"}
            </button>
            <button
              className="btn btn-primary flex-1"
              onClick={onFundBet}
              disabled={!fundAmount || !address || !isMarketReady || isPending}
            >
              {isPending || txLoading ? "Sending…" : "Fund"}
            </button>
          </div>
        </Card>

        <Card title="3) Resolve a bet">
          <label className="text-sm opacity-70">Bet ID</label>
          <input className={inputCls} value={resBetId} onChange={e => setResBetId(e.target.value)} />
          <label className="text-sm opacity-70 mt-2">Outcome (0..1 or %)</label>
          <input className={inputCls} value={outcomeTxt} onChange={e => setOutcomeTxt(e.target.value)} />
          {!isOracle && (
            <div className="text-xs text-warning mt-2">
              Only the Oracle can resolve bets. You are not authorized.
            </div>
          )}
          <button 
            className="btn btn-primary w-full mt-3" 
            onClick={onResolveBet} 
            disabled={isPending || !isOracle}
          >
            {isPending || txLoading ? "Sending…" : isOracle ? "Resolve" : "Oracle Only"}
          </button>
        </Card>

        <Card title="4) Redeem (YES/NO)">
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

      <Card title="5) Info panel / read">
        <label className="text-sm opacity-70">Bet ID</label>
        <input className={inputCls} value={betIdInfo} onChange={e => setBetIdInfo(e.target.value)} />

        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div className="glass p-3 rounded-xl">
            <div className="text-xs opacity-70 mb-1">YES / NO</div>
            <div className="text-sm break-all space-y-2">
              {betTuple ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="opacity-80">YES:</span>
                    <div className="flex-1 flex items-center justify-end gap-3">
                      <AddressComp address={(betTuple as any)[2]} format="long" size="sm" />
                      {balancesTuple !== undefined && (
                        <span className="font-mono">{formatUnits((balancesTuple as any)[0] as bigint, 18)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="opacity-80">NO:</span>
                    <div className="flex-1 flex items-center justify-end gap-3">
                      <AddressComp address={(betTuple as any)[3]} format="long" size="sm" />
                      {balancesTuple !== undefined && (
                        <span className="font-mono">{formatUnits((balancesTuple as any)[1] as bigint, 18)}</span>
                      )}
                    </div>
                  </div>
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
                Pool: {(betTuple as any)?.[4] ? formatUnits((betTuple as any)[4], decimals) : "-"} {collatSymbol}
              </div>
              <div>Resolved: {(betTuple as any)?.[5] ? "yes" : "no"}</div>
              <div>Outcome: {(betTuple as any)?.[6] ? Number((betTuple as any)[6]) / 1e18 : "-"}</div>
            </div>
          </div>
        </div>

        {(balancesTuple || collateralBal !== undefined || collateralError) ? (
          <div className="glass p-3 rounded-xl mt-3">
            <div className="text-xs opacity-70 mb-1">Your balances</div>
            <div className="text-sm font-mono">
              YES: {balancesTuple ? formatUnits((balancesTuple as any)[0] as bigint, 18) : "-"} | NO:{" "}
              {balancesTuple ? formatUnits((balancesTuple as any)[1] as bigint, 18) : "-"} | Pool:{" "}
              {balancesTuple ? formatUnits((balancesTuple as any)[2] as bigint, decimals) : "-"} {collatSymbol}
              {" "}| Collateral: {collateralBal !== undefined ? formatUnits(collateralBal as bigint, decimals) : (collateralError ? "Error" : "-")} {collatSymbol}
            </div>
            {collateralError && (
              <div className="text-xs text-error mt-1">
                Collateral read error: {collateralError.message}
              </div>
            )}
          </div>
        ) : null}
      </Card>

      {txHash && (
        <div className="text-sm opacity-70">
          Tx:{" "}
          <a className="underline" target="_blank" href={`https://sepolia.etherscan.io/tx/${String(txHash)}`} rel="noreferrer">
            {String(txHash)}
          </a>
        </div>
      )}
    </div>
  );
}
