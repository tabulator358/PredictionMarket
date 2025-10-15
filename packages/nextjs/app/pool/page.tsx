"use client";

import { useEffect, useMemo, useState } from "react";
import { Address } from "viem";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const ZERO: Address = "0x0000000000000000000000000000000000000000";

function isAddressLike(x: string): x is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(x);
}

export default function PoolPage() {
  // Deployed contract infos from hardhat-deploy
  const { data: helperInfo } = useDeployedContractInfo("UniV3PoolHelper");
  const { data: marketInfo } = useDeployedContractInfo("PredictionMarketERC20");

  const helperAddress = (helperInfo?.address ?? "") as Address;
  const marketDeployedAddress = (marketInfo?.address ?? "") as Address;

  // Write handle for UniV3PoolHelper
  const { writeContractAsync, isPending } = useScaffoldWriteContract("UniV3PoolHelper");

  // Form state
  const [marketAddr, setMarketAddr] = useState<Address>(ZERO);
  const [betId, setBetId] = useState<string>("");

  // Prefill market if deployed locally/testnet
  useEffect(() => {
    if (marketDeployedAddress && isAddressLike(marketDeployedAddress)) {
      setMarketAddr(marketDeployedAddress);
    }
  }, [marketDeployedAddress]);

  const validMarket = useMemo(() => isAddressLike(marketAddr), [marketAddr]);
  const validBetId = useMemo(() => /^\d+$/.test(betId) && BigInt(betId) >= 0n, [betId]);

  const canSubmit = !!helperAddress && validMarket && validBetId && marketAddr !== ZERO;

  const onEnsurePoolsForBet = async () => {
    await writeContractAsync({
      functionName: "ensurePoolsForBet",
      args: [marketAddr, BigInt(betId)],
    });
  };

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-white/5 text-base-content placeholder:opacity-70 p-2 focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6 text-base-content">
      {/* Header */}
      <header className="glass rounded-2xl p-5 space-y-1">
        <h1 className="text-2xl font-semibold">Pool Helper</h1>
        <p className="text-sm opacity-80">
          Helper contract: <b className="font-mono">{helperAddress || "not deployed"}</b>
        </p>
      </header>

      {/* Main Form */}
      <section className="glass rounded-2xl p-5 space-y-4">
        {!helperAddress && (
          <p className="text-warning text-sm">
            Deploy <code>UniV3PoolHelper</code> first (e.g. <code>packages/hardhat/deploy/02_deploy_pool.ts</code>) and
            reload the page.
          </p>
        )}

        <div>
          <label className="text-sm opacity-80">PredictionMarketERC20 address</label>
          <input
            className={`${inputCls} mt-1 ${validMarket || marketAddr === ZERO ? "" : "border-error/50"}`}
            placeholder="0x…"
            value={marketAddr}
            onChange={e => setMarketAddr((e.target.value || "") as Address)}
          />
          {marketDeployedAddress && (
            <div className="text-xs opacity-70 mt-1">
              Detected deployed market: <span className="font-mono">{marketDeployedAddress}</span>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm opacity-80">Bet ID</label>
          <input
            className={`${inputCls} mt-1 ${validBetId || betId === "" ? "" : "border-error/50"}`}
            placeholder="e.g. 0"
            inputMode="numeric"
            value={betId}
            onChange={e => setBetId(e.target.value)}
          />
        </div>

        <div className="pt-2">
          <button
            className="btn btn-primary w-full"
            disabled={!canSubmit || isPending}
            onClick={onEnsurePoolsForBet}
            title={
              !helperAddress
                ? "Helper not deployed?"
                : !canSubmit
                  ? "Enter a valid market address and Bet ID"
                  : "Create/ensure TAB–YES and TAB–NO pools"
            }
          >
            {isPending ? "Confirm in wallet…" : "Ensure Pools for Bet"}
          </button>
        </div>

        <p className="text-xs opacity-70 leading-relaxed">
          This page calls <code>ensurePoolsForBet(market, betId)</code>. The helper:
          <br />• reads <code>collateral()</code> and <code>getBetTokens(betId)</code> from the contract
          <br />• creates/initializes Uniswap V3 pools TAB–YES and TAB–NO (1% fee, 1:1 price) if they don’t already
          exist
        </p>
      </section>
    </main>
  );
}
