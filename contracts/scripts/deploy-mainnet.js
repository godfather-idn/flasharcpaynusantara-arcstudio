/**
 * FlashArcPay Nusantara — Arc Mainnet Deployment Script
 *
 * IMPORTANT: This script targets Arc MAINNET. Transactions are irreversible
 * and involve real USDC. Ensure you have:
 *   1. Obtained an independent security audit of FlashArcPay.sol.
 *   2. Funded your deployer wallet with USDC on Arc Mainnet.
 *   3. Reviewed all addresses and parameters below.
 *
 * Usage:
 *   cd contracts
 *   DEPLOYER_PRIVATE_KEY=<your-key> node scripts/deploy-mainnet.js
 *
 * Or via Hardhat:
 *   cd contracts
 *   npx hardhat run scripts/deploy-mainnet.js --network arcMainnet
 *
 * Arc Mainnet parameters
 * ──────────────────────
 *  Chain ID        : 5042
 *  RPC             : https://rpc.mainnet.arc.io
 *  USDC (ERC-20)   : 0x3600000000000000000000000000000000000000  (6 decimals)
 *  Min gas price   : 20 Gwei (20e9 in native-USDC wei, 18 decimals)
 */

const hre = require("hardhat");
const { ethers } = hre;

// Arc Mainnet constants
const ARC_MAINNET_USDC  = "0x3600000000000000000000000000000000000000";
const MIN_GAS_PRICE     = ethers.parseUnits("20", "gwei");  // 20 Gwei

async function main() {
  const network = hre.network.name;
  console.log(`\nDeploying FlashArcPay on network: ${network}`);

  // Abort if this is somehow run on the wrong network
  const chainId = (await ethers.provider.getNetwork()).chainId;
  if (chainId !== 5042n) {
    throw new Error(
      `Expected Arc Mainnet (chainId 5042), got chainId ${chainId}. ` +
      "Use --network arcMainnet or set the correct RPC."
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance : ${ethers.formatUnits(balance, 6)} USDC (ERC-20 view)`);

  // Enforce minimum gas price
  const feeData = await ethers.provider.getFeeData();
  const effectiveGasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
  if (effectiveGasPrice < MIN_GAS_PRICE) {
    console.warn(
      `WARNING: Network gas price (${ethers.formatUnits(effectiveGasPrice, "gwei")} Gwei) ` +
      `is below Arc Mainnet minimum (20 Gwei). ` +
      `Overriding to 20 Gwei to ensure mempool acceptance.`
    );
  }

  console.log(`\nDeploying FlashArcPay with USDC token: ${ARC_MAINNET_USDC}`);

  const FlashArcPay = await ethers.getContractFactory("FlashArcPay");
  const contract = await FlashArcPay.deploy(ARC_MAINNET_USDC, {
    maxFeePerGas:         MIN_GAS_PRICE,
    maxPriorityFeePerGas: MIN_GAS_PRICE,
  });

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\nFlashArcPay deployed successfully!`);
  console.log(`Contract address : ${address}`);
  console.log(`Explorer         : https://explorer.arc.io/address/${address}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Add to .env: VITE_FLASH_ARC_PAY_ADDRESS=${address}`);
  console.log(`  2. Set VITE_ARC_CHAIN_ID=5042`);
  console.log(`  3. Set VITE_ARC_RPC_URL=https://rpc.mainnet.arc.io`);
  console.log(`  4. Set VITE_ARC_EXPLORER=https://explorer.arc.io`);
  console.log(`  5. Rebuild: bunx nuxt generate`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
