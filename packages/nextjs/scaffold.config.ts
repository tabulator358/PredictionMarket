import * as chains from "viem/chains";

export type ScaffoldConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
  onlyLocalBurnerWallet: boolean;
};

export const DEFAULT_ALCHEMY_API_KEY = "oKxs-03sij-U_N0iOlrSsZFr29-IqbuF";

const scaffoldConfig = {
  /**
   * Target network: local Hardhat (for yarn chain + yarn deploy)
   */
  targetNetworks: [chains.hardhat],

  /**
   * Interval pro načítání nových dat z RPC (ms)
   */
  pollingInterval: 30000,

  /**
   * Alchemy API key – použij tvůj vlastní z .env.local,
   * např. NEXT_PUBLIC_ALCHEMY_API_KEY=xxxxx
   */
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,

  /**
   * RPC overrides – zde definuješ konkrétní RPC endpoint pro Sepolia.
   * Můžeš použít Infura, Alchemy nebo jiný poskytovatel.
   * Získáš např. na: https://dashboard.alchemy.com nebo https://infura.io
   */
  rpcOverrides: {
    [chains.hardhat.id]: process.env.NEXT_PUBLIC_RPC_URL_31337 || "http://127.0.0.1:8545",
  },

  /**
   * WalletConnect Project ID – doporučuji uložit do .env.local
   * NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=xxxxx
   */
  walletConnectProjectId:
    process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ||
    "3a8170812b534d0ff9d794f19a901d64",

  /**
   * Burner wallet bude k dispozici jen při lokálním běhu (hardhat),
   * na testnetu ji nechceme ukazovat.
   */
  onlyLocalBurnerWallet: false,
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
