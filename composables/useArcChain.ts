import { defineChain } from "viem";

// ── Arc chain constants ───────────────────────────────────────────────────────

export const ARC_MAINNET_CHAIN_ID  = 5042;
export const ARC_TESTNET_CHAIN_ID  = 5042002;

export const ARC_MAINNET_RPC      = "https://rpc.mainnet.arc.io";
export const ARC_TESTNET_RPC      = "https://rpc.testnet.arc.io";

export const ARC_MAINNET_EXPLORER = "https://explorer.arc.io";
export const ARC_TESTNET_EXPLORER = "https://explorer.testnet.arc.io";

/// USDC is a fixed predeploy at the same address on every Arc network.
export const ARC_USDC_ADDRESS     = "0x3600000000000000000000000000000000000000";

/// Arc decimal model (same asset, two views):
///   ERC-20 view  : 6 decimals  — balances, transfers, approvals, display.
///   Native view  : 18 decimals — gas / msg.value only.
///   Conversion   : 1 ERC-20 unit = 10^12 native units.
export const USDC_ERC20_DECIMALS  = 6;
export const USDC_NATIVE_DECIMALS = 18;
export const NATIVE_TO_ERC20_SCALE = 10n ** 12n;  // BigInt for on-chain math

/// Minimum maxFeePerGas required by Arc Mainnet mempool.
/// Expressed in native-USDC wei (18-decimal units) = 20 Gwei.
export const MIN_GAS_PRICE_WEI = 20_000_000_000n; // 20e9 BigInt

// ── Arc Mainnet chain definition ─────────────────────────────────────────────

export const arcMainnet = defineChain({
  id: ARC_MAINNET_CHAIN_ID,
  name: "Arc Mainnet",
  nativeCurrency: { decimals: 18, name: "USD Coin", symbol: "USDC" },
  rpcUrls: {
    default: { http: [ARC_MAINNET_RPC] },
    public:  { http: [ARC_MAINNET_RPC] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: ARC_MAINNET_EXPLORER },
  },
  testnet: false,
});

// ── Arc Testnet chain definition ─────────────────────────────────────────────

export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { decimals: 18, name: "USD Coin", symbol: "USDC" },
  rpcUrls: {
    default: { http: [ARC_TESTNET_RPC] },
    public:  { http: [ARC_TESTNET_RPC] },
  },
  blockExplorers: {
    default: { name: "Arc Testnet Explorer", url: ARC_TESTNET_EXPLORER },
  },
  testnet: true,
});

// ── Runtime chain selector ────────────────────────────────────────────────────

/// Returns the chain object for the configured chain ID.
/// Reads VITE_ARC_CHAIN_ID from runtimeConfig; defaults to testnet.
export const getArcChain = () => {
  const config = useRuntimeConfig();
  const chainId = Number(config.public.arcChainId || ARC_TESTNET_CHAIN_ID);
  const rpcOverride = config.public.arcRpcUrl as string | undefined;

  const base = chainId === ARC_MAINNET_CHAIN_ID ? arcMainnet : arcTestnet;

  // Allow an explicit RPC override (e.g. a private node URL in .env)
  if (rpcOverride && rpcOverride !== base.rpcUrls.default.http[0]) {
    return defineChain({
      ...base,
      rpcUrls: {
        default: { http: [rpcOverride] },
        public:  { http: [rpcOverride] },
      },
    });
  }

  return base;
};

/// True when the runtime chain is Arc Mainnet.
export const isArcMainnet = () => {
  const config = useRuntimeConfig();
  return Number(config.public.arcChainId) === ARC_MAINNET_CHAIN_ID;
};
