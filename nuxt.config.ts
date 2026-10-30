// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false, // SPA mode — required for window.ethereum / Web3 compatibility

  modules: ["@nuxtjs/tailwindcss"],

  app: {
    head: {
      title: "FlashArcPay Nusantara",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content:
            "Indonesian QRIS-Standard Payment Experience Built Native on Arc Network via Circle Arc App Kit",
        },
      ],
      link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
    },
  },

  runtimeConfig: {
    public: {
      // Arc network — set VITE_ARC_CHAIN_ID=5042 for mainnet, 5042002 for testnet
      arcChainId:  process.env.VITE_ARC_CHAIN_ID  || "5042002",
      arcRpcUrl:   process.env.VITE_ARC_RPC_URL   || "https://rpc.testnet.arc.io",
      arcExplorer: process.env.VITE_ARC_EXPLORER   || "https://explorer.testnet.arc.io",

      // USDC is a fixed predeploy at the same address on every Arc network
      usdcContractAddress:
        process.env.VITE_USDC_CONTRACT_ADDRESS ||
        "0x3600000000000000000000000000000000000000",

      // Deployed FlashArcPay contract address (set after deploy)
      flashArcPayAddress: process.env.VITE_FLASH_ARC_PAY_ADDRESS || "",
    },
  },

  vite: {
    define: {
      global: "globalThis",
    },
    resolve: {
      alias: {
        "#app-manifest": "/home/user/app/.nuxt/manifest/latest.json",
      },
    },
    server: {
      allowedHosts: true,
      fs: {
        strict: false,
      },
      hmr: {
        host: "i6ae5wg74ra3pkmnfo4z2.preview.studio.arc.io",
        protocol: "wss",
        clientPort: 443,
      },
    },
    optimizeDeps: {
      include: [
        "viem",
        "viem/chains",
        "@circle-fin/app-kit",
        "@circle-fin/adapter-viem-v2",
      ],
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  compatibilityDate: "2024-11-01",
});
