"use client";

import { useMemo, useState } from "react";
import { Address, formatUnits, isAddress, parseUnits } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { Address as AddressComp } from "~~/components/scaffold-eth/Address/Address";
import { AddressInput, IntegerInput } from "~~/components/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

/** Minimal inline ABI – nezávislé na /deployments */
const TAB_MIN_ABI = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "AUTHORIZER", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "CLAIM_AMOUNT", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "claimAuthorized", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "claimConsumed",  stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "mint",           stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] },
  { type: "function", name: "burn",           stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
  { type: "function", name: "authorizeClaim", stateMutability: "nonpayable", inputs: [{ type: "address" }], outputs: [] },
  { type: "function", name: "revokeClaim",    stateMutability: "nonpayable", inputs: [{ type: "address" }], outputs: [] },
  { type: "function", name: "claim",          stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

export default function TABcoinPage() {
  const { address: connectedAddress } = useAccount();

  // —— Hardcoded Sepolia address ——
  const TAB_ADDRESS = "0x9285A9185649cfFDE9Ee5002249525B6049ab29d" as Address;

  // ——— Local UI state ———
  const [mintTo, setMintTo] = useState<string>("");
  const [mintAmount, setMintAmount] = useState<string>("0");
  const [burnAmount, setBurnAmount] = useState<string>("0");
  const [authAddr, setAuthAddr] = useState<string>("");

  // Helpers
  const safeStr = (x: unknown) => (x === undefined || x === null ? "" : String(x));
  const isAddrOk = (x?: string) => !!x && isAddress(x);
  const watchAddr = safeStr(authAddr) || safeStr(connectedAddress) || "";

  // --- READS ---
  const { data: symbol } = useReadContract({ abi: TAB_MIN_ABI, address: TAB_ADDRESS, functionName: "symbol" });
  const { data: decimalsRaw } = useReadContract({ abi: TAB_MIN_ABI, address: TAB_ADDRESS, functionName: "decimals" });
  const decimals = Number(decimalsRaw ?? 18);

  const { data: authorizerAddr } = useReadContract({ abi: TAB_MIN_ABI, address: TAB_ADDRESS, functionName: "AUTHORIZER" });
  const { data: claimAmountRaw } = useReadContract({ abi: TAB_MIN_ABI, address: TAB_ADDRESS, functionName: "CLAIM_AMOUNT" });
  const claimAmount = claimAmountRaw as bigint | undefined;

  const { data: myBalance } = useReadContract({
    abi: TAB_MIN_ABI, address: TAB_ADDRESS, functionName: "balanceOf",
    args: [connectedAddress as Address],
    query: { enabled: !!connectedAddress && isAddrOk(String(connectedAddress)) },
  });

  const { data: watchedBalance } = useReadContract({
    abi: TAB_MIN_ABI, address: TAB_ADDRESS, functionName: "balanceOf",
    args: [watchAddr as Address],
    query: { enabled: isAddrOk(watchAddr) },
  });

  const { data: isAuthorized } = useReadContract({
    abi: TAB_MIN_ABI, address: TAB_ADDRESS, functionName: "claimAuthorized",
    args: [watchAddr as Address],
    query: { enabled: isAddrOk(watchAddr) },
  });

  const { data: isConsumed } = useReadContract({
    abi: TAB_MIN_ABI, address: TAB_ADDRESS, functionName: "claimConsumed",
    args: [watchAddr as Address],
    query: { enabled: isAddrOk(watchAddr) },
  });

  // Derived: jsem authorizer?
  const isAuth = useMemo(() => {
    const a = safeStr(authorizerAddr).toLowerCase();
    const me = safeStr(connectedAddress).toLowerCase();
    return !!a && !!me && a === me;
  }, [authorizerAddr, connectedAddress]);

  // --- WRITES (wagmi přímo, žádný scaffold hook = žádné "Target Contract..." chyby) ---
  const { writeContractAsync: writeTAB } = useWriteContract();

  const onMint = async () => {
    try {
      if (!isAuth) throw new Error("Only the authorizer can mint.");
      if (!isAddrOk(mintTo)) throw new Error("Enter a valid recipient address.");
      const amt = parseUnits(mintAmount || "0", decimals);
      await writeTAB({ abi: TAB_MIN_ABI, address: TAB_ADDRESS, functionName: "mint", args: [mintTo as Address, amt] });
      notification.success(`Mint complete: ${mintAmount} ${symbol ?? "TAB"} → ${mintTo}`);
      setMintAmount("0");
    } catch (e: any) {
      notification.error(e?.shortMessage ?? e?.message ?? "Mint failed");
    }
  };

  const onBurn = async () => {
    try {
      const amt = parseUnits(burnAmount || "0", decimals);
      await writeTAB({ abi: TAB_MIN_ABI, address: TAB_ADDRESS, functionName: "burn", args: [amt] });
      notification.success(`Burn complete: ${burnAmount} ${symbol ?? "TAB"}`);
      setBurnAmount("0");
    } catch (e: any) {
      notification.error(e?.shortMessage ?? e?.message ?? "Burn failed");
    }
  };

  const onAuthorize = async () => {
    try {
      if (!isAuth) throw new Error("Only the authorizer can approve a claim.");
      if (!isAddrOk(authAddr)) throw new Error("Enter a valid address for authorization.");
      await writeTAB({ abi: TAB_MIN_ABI, address: TAB_ADDRESS, functionName: "authorizeClaim", args: [authAddr as Address] });
      notification.success(`Claim authorization for ${authAddr} completed.`);
    } catch (e: any) {
      notification.error(e?.shortMessage ?? e?.message ?? "Authorization failed");
    }
  };

  const onRevoke = async () => {
    try {
      if (!isAuth) throw new Error("Only the authorizer can revoke a claim.");
      if (!isAddrOk(authAddr)) throw new Error("Enter a valid address to revoke authorization.");
      await writeTAB({ abi: TAB_MIN_ABI, address: TAB_ADDRESS, functionName: "revokeClaim", args: [authAddr as Address] });
      notification.success(`Claim authorization for ${authAddr} revoked.`);
    } catch (e: any) {
      notification.error(e?.shortMessage ?? e?.message ?? "Revocation failed");
    }
  };

  const onClaim = async () => {
    try {
      await writeTAB({ abi: TAB_MIN_ABI, address: TAB_ADDRESS, functionName: "claim", args: [] });
      const amountStr = claimAmount !== undefined ? formatUnits(claimAmount, decimals) : "0";
      notification.success(`Claim complete: ${amountStr} ${symbol ?? "TAB"}`);
    } catch (e: any) {
      notification.error(e?.shortMessage ?? e?.message ?? "Claim failed");
    }
  };

  // Formatter
  const fmtToken = (bn?: bigint) => (bn === undefined || bn === null ? "-" : formatUnits(bn, decimals));

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 text-base-content">
      {/* Header */}
      <div className="glass p-4 rounded-2xl flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tabcoin – 1st offchain collateralised CZK</h1>
        <div className="text-sm opacity-80">
          <span className="font-mono">Contract: {TAB_ADDRESS}</span>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass p-4 rounded-2xl">
          <div className="text-xs opacity-70 mb-1">Token</div>
          <div className="text-lg font-semibold">
            {symbol ?? "…"} ({decimals} dec)
          </div>
          <div className="mt-2 text-sm">
            <div>
              Authorizer: <span className="font-mono">{authorizerAddr ?? "…"}</span>
            </div>
            <div>
              Are you authorizer? <b>{isAuth ? "Yes" : "No"}</b>
            </div>
          </div>
        </div>

        <div className="glass p-4 rounded-2xl">
          <div className="text-xs opacity-70 mb-1">Your wallet</div>
          <div className="text-sm">
            <div>
              Address: <span className="font-mono">{connectedAddress ?? "not connected"}</span>
            </div>
            <div>
              Balance:{" "}
              <b>
                {fmtToken(myBalance as bigint | undefined)} {symbol ?? "TAB"}
              </b>
            </div>
          </div>
        </div>
      </div>

      {/* Claim status + actions */}
      <div className="glass p-4 rounded-2xl space-y-4">
        <div className="text-lg font-semibold">One-time claim (1000 TAB)</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs opacity-70">Address for checking / authorization actions</label>
            <AddressInput value={authAddr} onChange={addr => setAuthAddr(addr ?? "")} placeholder="0x…" />
            <div className="text-sm">
              <div>
                Claim authorized? <b>{(isAuthorized as boolean) ? "Yes" : "No"}</b>
              </div>
              <div>
                Claim consumed? <b>{(isConsumed as boolean) ? "Yes" : "No"}</b>
              </div>
              <div>
                CLAIM_AMOUNT:{" "}
                <b>
                  {fmtToken(claimAmount)} {symbol ?? "TAB"}
                </b>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <button className="btn btn-primary" onClick={onAuthorize} disabled={!isAuth || !isAddrOk(authAddr)}>
              Authorize claim
            </button>
            <button className="btn" onClick={onRevoke} disabled={!isAuth || !isAddrOk(authAddr)}>
              Revoke authorization
            </button>
            <button className="btn btn-accent" onClick={onClaim} disabled={!connectedAddress}>
              Claim (for connected address)
            </button>
          </div>
        </div>
      </div>

      {/* Mint & Burn */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass p-4 rounded-2xl space-y-3">
          <div className="text-lg font-semibold">Mint (authorizer only)</div>
          <label className="text-xs opacity-70">Recipient</label>
          <AddressInput value={mintTo} onChange={addr => setMintTo(addr ?? "")} placeholder="0x…" />
          <label className="text-xs opacity-70">Amount ({symbol ?? "TAB"})</label>
          <IntegerInput value={mintAmount} onChange={val => setMintAmount(val ?? "0")} placeholder="0" />
          <button className="btn btn-primary w-full" onClick={onMint} disabled={!isAuth || !isAddrOk(mintTo)}>
            Mint
          </button>
        </div>

        <div className="glass p-4 rounded-2xl space-y-3">
          <div className="text-lg font-semibold">Burn</div>
          <label className="text-xs opacity-70">Amount to burn ({symbol ?? "TAB"})</label>
          <IntegerInput value={burnAmount} onChange={val => setBurnAmount(val ?? "0")} placeholder="0" />
          <button className="btn w-full" onClick={onBurn} disabled={!connectedAddress}>
            Burn
          </button>
        </div>
      </div>

      {/* Watch balance of any address */}
      <div className="glass p-4 rounded-2xl">
        <div className="text-lg font-semibold mb-2">Watched address status</div>
        <div className="text-sm space-y-2">
          <div className="opacity-80">Address:</div>
          <div>
            {isAddrOk(watchAddr) ? (
              <AddressComp address={watchAddr as Address} format="long" size="sm" />
            ) : (
              <span className="font-mono">-</span>
            )}
          </div>
          <div className="opacity-80 mt-2">Balance:</div>
          <div className="font-mono">{fmtToken(watchedBalance as bigint | undefined)} {symbol ?? "TAB"}</div>
        </div>
      </div>
    </div>
  );
}
