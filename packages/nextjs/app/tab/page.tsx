// packages/nextjs/app/tab/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Address, isAddress, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { AddressInput, IntegerInput } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

// packages/nextjs/app/tab/page.tsx

// packages/nextjs/app/tab/page.tsx

// packages/nextjs/app/tab/page.tsx

// packages/nextjs/app/tab/page.tsx

// packages/nextjs/app/tab/page.tsx

// packages/nextjs/app/tab/page.tsx

// packages/nextjs/app/tab/page.tsx

// packages/nextjs/app/tab/page.tsx

// packages/nextjs/app/tab/page.tsx

// packages/nextjs/app/tab/page.tsx

export default function TABcoinPage() {
  const { address: connectedAddress } = useAccount();

  // ——— Contract binding ———
  const { data: tabcoin } = useDeployedContractInfo("TABcoin");
  const contractName = "TABcoin";

  // ——— Local UI state ———
  const [mintTo, setMintTo] = useState<Address | undefined>(undefined);
  const [mintAmount, setMintAmount] = useState<string>("0");
  const [burnAmount, setBurnAmount] = useState<string>("0");
  const [authAddr, setAuthAddr] = useState<Address | undefined>(undefined);
  const watchAddr = authAddr ?? connectedAddress;

  // ——— Reads ———
  const { data: symbol } = useScaffoldReadContract({ contractName, functionName: "symbol" });
  const { data: decimals } = useScaffoldReadContract({ contractName, functionName: "decimals" });
  const { data: owner } = useScaffoldReadContract({ contractName, functionName: "owner" });
  const { data: authorizer } = useScaffoldReadContract({ contractName, functionName: "authorizer" });
  const { data: claimAmount } = useScaffoldReadContract({ contractName, functionName: "CLAIM_AMOUNT" });

  const { data: myBalance } = useScaffoldReadContract({
    contractName,
    functionName: "balanceOf",
    args: [connectedAddress as Address],
    enabled: !!connectedAddress,
  });
  const { data: watchedBalance } = useScaffoldReadContract({
    contractName,
    functionName: "balanceOf",
    args: [watchAddr as Address],
    enabled: !!watchAddr,
  });
  const { data: isAuthorized } = useScaffoldReadContract({
    contractName,
    functionName: "claimAuthorized",
    args: [watchAddr as Address],
    enabled: !!watchAddr,
  });
  const { data: isConsumed } = useScaffoldReadContract({
    contractName,
    functionName: "claimConsumed",
    args: [watchAddr as Address],
    enabled: !!watchAddr,
  });

  const isOwner = useMemo(
    () => !!owner && !!connectedAddress && owner.toLowerCase() === connectedAddress.toLowerCase(),
    [owner, connectedAddress],
  );
  const isAuth = useMemo(
    () => !!authorizer && !!connectedAddress && authorizer.toLowerCase() === connectedAddress.toLowerCase(),
    [authorizer, connectedAddress],
  );

  // ——— Writes ———
  const { writeContractAsync: writeTAB } = useScaffoldWriteContract(contractName);

  const onMint = async () => {
    try {
      if (!isAuth) throw new Error("Only the authorizer can mint.");
      if (!mintTo || !isAddress(mintTo)) throw new Error("Enter a valid recipient address.");
      const d = Number(decimals ?? 18);
      const amt = parseUnits(mintAmount || "0", d);
      await writeTAB({ functionName: "mint", args: [mintTo, amt] });
      notification.success(`Mint complete: ${mintAmount} ${symbol ?? "TAB"} → ${mintTo}`);
      setMintAmount("0");
    } catch (e: any) {
      notification.error(e?.message ?? "Mint failed");
    }
  };

  const onBurn = async () => {
    try {
      const d = Number(decimals ?? 18);
      const amt = parseUnits(burnAmount || "0", d);
      await writeTAB({ functionName: "burn", args: [amt] });
      notification.success(`Burn complete: ${burnAmount} ${symbol ?? "TAB"}`);
      setBurnAmount("0");
    } catch (e: any) {
      notification.error(e?.message ?? "Burn failed");
    }
  };

  const onAuthorize = async () => {
    try {
      if (!isAuth) throw new Error("Only the authorizer can approve a claim.");
      if (!authAddr || !isAddress(authAddr)) throw new Error("Enter a valid address for authorization.");
      await writeTAB({ functionName: "authorizeClaim", args: [authAddr] });
      notification.success(`Claim authorization for ${authAddr} completed.`);
    } catch (e: any) {
      notification.error(e?.message ?? "Authorization failed");
    }
  };

  const onRevoke = async () => {
    try {
      if (!isAuth) throw new Error("Only the authorizer can revoke a claim.");
      if (!authAddr || !isAddress(authAddr)) throw new Error("Enter a valid address to revoke authorization.");
      await writeTAB({ functionName: "revokeClaim", args: [authAddr] });
      notification.success(`Claim authorization for ${authAddr} revoked.`);
    } catch (e: any) {
      notification.error(e?.message ?? "Revocation failed");
    }
  };

  const onClaim = async () => {
    try {
      await writeTAB({ functionName: "claim", args: [] });
      notification.success(
        `Claim complete: ${(Number(claimAmount ?? 0) / 10 ** Number(decimals ?? 18)).toString()} ${symbol ?? "TAB"}`,
      );
    } catch (e: any) {
      notification.error(e?.message ?? "Claim failed");
    }
  };

  // ——— Helpers ———
  const fmtToken = (bn?: bigint) => {
    if (bn === undefined || bn === null) return "-";
    const d = Number(decimals ?? 18);
    const factor = 10 ** d;
    const num = Number(bn) / factor;
    return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 text-base-content">
      {/* Header */}
      <div className="glass p-4 rounded-2xl flex items-center justify-between">
        <h1 className="text-2xl font-bold">TABcoin Console</h1>
        <div className="text-sm opacity-80">
          {tabcoin?.address ? (
            <span className="font-mono">Contract: {tabcoin.address}</span>
          ) : (
            <span className="text-warning">TABcoin contract not deployed or not loaded.</span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass p-4 rounded-2xl">
          <div className="text-xs opacity-70 mb-1">Token</div>
          <div className="text-lg font-semibold">
            {symbol ?? "…"} ({Number(decimals ?? 18)} dec)
          </div>
          <div className="mt-2 text-sm">
            <div>
              Owner: <span className="font-mono">{owner ?? "…"}</span>
            </div>
            <div>
              Authorizer: <span className="font-mono">{authorizer ?? "…"}</span>
            </div>
            <div>
              Are you owner? <b>{isOwner ? "Yes" : "No"}</b> | Are you authorizer? <b>{isAuth ? "Yes" : "No"}</b>
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
                {fmtToken(myBalance)} {symbol ?? "TAB"}
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
            <AddressInput value={authAddr} onChange={addr => setAuthAddr(addr as Address)} placeholder="0x…" />
            <div className="text-sm">
              <div>
                Claim authorized? <b>{isAuthorized ? "Yes" : "No"}</b>
              </div>
              <div>
                Claim consumed? <b>{isConsumed ? "Yes" : "No"}</b>
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
            <button className="btn btn-primary" onClick={onAuthorize} disabled={!isAuth || !authAddr}>
              Authorize claim
            </button>
            <button className="btn" onClick={onRevoke} disabled={!isAuth || !authAddr}>
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
          <AddressInput value={mintTo} onChange={addr => setMintTo(addr as Address)} placeholder="0x…" />
          <label className="text-xs opacity-70">Amount ({symbol ?? "TAB"})</label>
          <IntegerInput value={mintAmount} onChange={val => setMintAmount(val || "0")} placeholder="0" />
          <button className="btn btn-primary w-full" onClick={onMint} disabled={!isAuth}>
            Mint
          </button>
        </div>

        <div className="glass p-4 rounded-2xl space-y-3">
          <div className="text-lg font-semibold">Burn</div>
          <label className="text-xs opacity-70">Amount to burn ({symbol ?? "TAB"})</label>
          <IntegerInput value={burnAmount} onChange={val => setBurnAmount(val || "0")} placeholder="0" />
          <button className="btn w-full" onClick={onBurn} disabled={!connectedAddress}>
            Burn
          </button>
        </div>
      </div>

      {/* Watch balance of any address */}
      <div className="glass p-4 rounded-2xl">
        <div className="text-lg font-semibold mb-2">Watched address status</div>
        <div className="text-sm">
          Address: <span className="font-mono">{watchAddr ?? "-"}</span> — Balance:{" "}
          <b>
            {fmtToken(watchedBalance)} {symbol ?? "TAB"}
          </b>
        </div>
      </div>
    </div>
  );
}
