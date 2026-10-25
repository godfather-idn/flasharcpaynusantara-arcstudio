import { defineChain } from "viem";

export const getArcChain = () => {
  const config = useRuntimeConfig();
  const chainId = Number(config.public.arcChainId || 5042002);
  const rpcUrl =
    (config.public.arcRpcUrl as string) || "https://rpc.testnet.arc.io";

  return defineChain({
    id: chainId,
    name: "Arc Network",
    nativeCurrency: { decimals: 6, name: "USD Coin", symbol: "USDC" },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
    blockExplorers: {
      default: {
        name: "Arc Explorer",
        url: "https://explorer.testnet.arc.io",
      },
    },
    testnet: true,
  });
};

export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_TESTNET_RPC = "https://rpc.testnet.arc.io";
export const ARC_TESTNET_EXPLORER = "https://explorer.testnet.arc.io";
