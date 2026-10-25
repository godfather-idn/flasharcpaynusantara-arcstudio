const { ethers } = require("hardhat");

async function main() {
  const usdcAddress =
    process.env.USDC_CONTRACT_ADDRESS ||
    "0x3600000000000000000000000000000000000000";

  console.log("Deploying FlashArcPay...");
  console.log("USDC address:", usdcAddress);

  const FlashArcPay = await ethers.getContractFactory("FlashArcPay");
  const contract = await FlashArcPay.deploy(usdcAddress);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("FlashArcPay deployed to:", address);
  console.log(
    "\nUpdate your .env:\nVITE_FLASH_ARC_PAY_ADDRESS=" + address
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
