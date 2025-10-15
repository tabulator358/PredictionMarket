import { useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import scaffoldConfig from "~~/scaffold.config";
import { useGlobalState } from "~~/services/store/store";
import { ChainWithAttributes } from "~~/utils/scaffold-eth";
import { NETWORKS_EXTRA_DATA } from "~~/utils/scaffold-eth";

/**
 * Returns the active target network for the app:
 * - If wallet is connected to one of scaffold.config.targetNetworks, use that
 * - Otherwise fall back to the 0th network from scaffold.config.targetNetworks
 */
export function useTargetNetwork(): { targetNetwork: ChainWithAttributes } {
  const { chain } = useAccount();
  const targetNetwork = useGlobalState(({ targetNetwork }) => targetNetwork);
  const setTargetNetwork = useGlobalState(({ setTargetNetwork }) => setTargetNetwork);

  useEffect(() => {
    const supported = scaffoldConfig.targetNetworks;
    if (!supported || supported.length === 0) return;

    // If connected to a supported chain, use it; otherwise fallback to the first target network
    const fromWallet = chain?.id
      ? supported.find(n => n.id === chain.id)
      : undefined;

    const next = (fromWallet ?? supported[0]) as ChainWithAttributes;

    // Merge extra display attributes if available
    const extra = NETWORKS_EXTRA_DATA[next.id] ?? {};
    const nextWithAttrs = { ...next, ...extra } as ChainWithAttributes;

    if (nextWithAttrs.id !== targetNetwork.id) {
      setTargetNetwork(nextWithAttrs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain?.id, setTargetNetwork, targetNetwork.id]);

  return useMemo(() => ({ targetNetwork }), [targetNetwork]);
}
