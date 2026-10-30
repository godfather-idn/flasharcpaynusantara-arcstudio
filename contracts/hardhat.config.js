require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Arc network constants
const ARC_MAINNET_CHAIN_ID = 5042;
const ARC_TESTNET_CHAIN_ID = 5042002;
const ARC_MAINNET_RPC      = "https://rpc.mainnet.arc.io";
const ARC_TESTNET_RPC      = "https://rpc.testnet.arc.io";

// Minimum gas price required by Arc Mainnet mempool: 20 Gwei
// In native-USDC wei (18 decimals): 20_000_000_000
const MIN_GAS_PRICE_GWEI = 20;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },

  networks: {
    // ── Local ──────────────────────────────────────────────────────────────
    hardhat: {},

    // ── Arc Testnet ────────────────────────────────────────────────────────
    arcTestnet: {
      url:     process.env.ARC_TESTNET_RPC_URL || ARC_TESTNET_RPC,
      chainId: ARC_TESTNET_CHAIN_ID,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },

    // ── Arc Mainnet ────────────────────────────────────────────────────────
    // WARNING: transactions on Arc Mainnet involve real USDC and are
    // irreversible.  Never commit DEPLOYER_PRIVATE_KEY to source control.
    arcMainnet: {
      url:     process.env.ARC_MAINNET_RPC_URL || ARC_MAINNET_RPC,
      chainId: ARC_MAINNET_CHAIN_ID,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      // Enforce minimum gas price so txs are not rejected by the mempool
      gasPrice: MIN_GAS_PRICE_GWEI * 1e9,  // 20 Gwei in wei
    },

    // Legacy alias — kept for backward-compat with existing CI scripts
    arc: {
      url:     process.env.ARC_RPC_URL || ARC_TESTNET_RPC,
      chainId: Number(process.env.ARC_CHAIN_ID || ARC_TESTNET_CHAIN_ID),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
