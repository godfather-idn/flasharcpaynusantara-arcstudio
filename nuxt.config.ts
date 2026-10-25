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
      arcRpcUrl:
        process.env.VITE_ARC_RPC_URL || "https://rpc.testnet.arc.io",
      arcChainId: process.env.VITE_ARC_CHAIN_ID || "5042002",
      flashArcPayAddress: process.env.VITE_FLASH_ARC_PAY_ADDRESS || "",
      usdcContractAddress:
        process.env.VITE_USDC_CONTRACT_ADDRESS ||
        "0x3600000000000000000000000000000000000000",
    },
  },

  vite: {
    define: {
      global: "globalThis",
    },
    optimizeDeps: {
      include: ["viem", "@circle-fin/app-kit", "@circle-fin/adapter-viem-v2"],
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  compatibilityDate: "2024-11-01",
});
