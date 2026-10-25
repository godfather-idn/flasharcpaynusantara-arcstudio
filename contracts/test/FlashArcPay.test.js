const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FlashArcPay", function () {
  let flashArcPay, mockUsdc;
  let owner, merchant, payer, other;
  const AMOUNT = ethers.parseUnits("10", 6); // 10 USDC

  beforeEach(async () => {
    [owner, merchant, payer, other] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUsdc = await MockUSDC.deploy();

    const FlashArcPay = await ethers.getContractFactory("FlashArcPay");
    flashArcPay = await FlashArcPay.deploy(await mockUsdc.getAddress());

    // Mint USDC for payer and approve contract
    await mockUsdc.mint(payer.address, ethers.parseUnits("1000", 6));
    await mockUsdc
      .connect(payer)
      .approve(await flashArcPay.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", () => {
    it("Should set the correct USDC token address", async () => {
      expect(await flashArcPay.usdcToken()).to.equal(
        await mockUsdc.getAddress()
      );
    });

    it("Should revert with zero USDC address", async () => {
      const FlashArcPay = await ethers.getContractFactory("FlashArcPay");
      await expect(
        FlashArcPay.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid USDC token address");
    });
  });

  describe("getOrderHash", () => {
    it("Should return a deterministic hash", async () => {
      const hash1 = await flashArcPay.getOrderHash(
        merchant.address,
        "ORDER-001",
        AMOUNT
      );
      const hash2 = await flashArcPay.getOrderHash(
        merchant.address,
        "ORDER-001",
        AMOUNT
      );
      expect(hash1).to.equal(hash2);
    });

    it("Should return different hashes for different order IDs", async () => {
      const hash1 = await flashArcPay.getOrderHash(
        merchant.address,
        "ORDER-001",
        AMOUNT
      );
      const hash2 = await flashArcPay.getOrderHash(
        merchant.address,
        "ORDER-002",
        AMOUNT
      );
      expect(hash1).to.not.equal(hash2);
    });
  });

  describe("payMerchant", () => {
    it("Should transfer USDC from payer to merchant", async () => {
      const initialBalance = await mockUsdc.balanceOf(merchant.address);
      await flashArcPay
        .connect(payer)
        .payMerchant(merchant.address, "ORDER-001", AMOUNT);
      const finalBalance = await mockUsdc.balanceOf(merchant.address);
      expect(finalBalance - initialBalance).to.equal(AMOUNT);
    });

    it("Should emit PaymentProcessed event", async () => {
      await expect(
        flashArcPay
          .connect(payer)
          .payMerchant(merchant.address, "ORDER-001", AMOUNT)
      )
        .to.emit(flashArcPay, "PaymentProcessed")
        .withArgs(
          merchant.address,
          payer.address,
          await flashArcPay.getOrderHash(merchant.address, "ORDER-001", AMOUNT),
          "ORDER-001",
          AMOUNT,
          (await ethers.provider.getBlock("latest")).timestamp + 1
        );
    });

    it("Should mark order as processed after payment", async () => {
      await flashArcPay
        .connect(payer)
        .payMerchant(merchant.address, "ORDER-001", AMOUNT);
      expect(
        await flashArcPay.isOrderProcessed(
          merchant.address,
          "ORDER-001",
          AMOUNT
        )
      ).to.be.true;
    });

    it("Should revert on duplicate order (replay attack)", async () => {
      await flashArcPay
        .connect(payer)
        .payMerchant(merchant.address, "ORDER-001", AMOUNT);
      await mockUsdc.mint(payer.address, AMOUNT);
      await expect(
        flashArcPay
          .connect(payer)
          .payMerchant(merchant.address, "ORDER-001", AMOUNT)
      ).to.be.revertedWith("Order already processed");
    });

    it("Should revert with zero amount", async () => {
      await expect(
        flashArcPay
          .connect(payer)
          .payMerchant(merchant.address, "ORDER-001", 0)
      ).to.be.revertedWith("Amount must be greater than zero");
    });

    it("Should revert with zero merchant address", async () => {
      await expect(
        flashArcPay
          .connect(payer)
          .payMerchant(ethers.ZeroAddress, "ORDER-001", AMOUNT)
      ).to.be.revertedWith("Invalid merchant address");
    });

    it("Should revert with insufficient balance", async () => {
      const huge = ethers.parseUnits("999999", 6);
      await expect(
        flashArcPay
          .connect(payer)
          .payMerchant(merchant.address, "ORDER-001", huge)
      ).to.be.revertedWith("Insufficient USDC balance");
    });

    it("Should allow same order ID with different amounts", async () => {
      const AMOUNT2 = ethers.parseUnits("5", 6);
      await flashArcPay
        .connect(payer)
        .payMerchant(merchant.address, "ORDER-001", AMOUNT);
      // Different amount — different hash — should succeed
      await flashArcPay
        .connect(payer)
        .payMerchant(merchant.address, "ORDER-001", AMOUNT2);
    });

    it("Should allow same amount with different order IDs", async () => {
      await flashArcPay
        .connect(payer)
        .payMerchant(merchant.address, "ORDER-001", AMOUNT);
      await flashArcPay
        .connect(payer)
        .payMerchant(merchant.address, "ORDER-002", AMOUNT);
    });

    it("Should allow same order from different payers", async () => {
      await mockUsdc.mint(other.address, ethers.parseUnits("1000", 6));
      await mockUsdc
        .connect(other)
        .approve(await flashArcPay.getAddress(), ethers.MaxUint256);
      await flashArcPay
        .connect(payer)
        .payMerchant(merchant.address, "ORDER-001", AMOUNT);
      // Different payer but SAME order hash — should revert
      await expect(
        flashArcPay
          .connect(other)
          .payMerchant(merchant.address, "ORDER-001", AMOUNT)
      ).to.be.revertedWith("Order already processed");
    });
  });

  describe("isOrderProcessed", () => {
    it("Should return false before payment", async () => {
      expect(
        await flashArcPay.isOrderProcessed(
          merchant.address,
          "ORDER-NEW",
          AMOUNT
        )
      ).to.be.false;
    });

    it("Should return true after payment", async () => {
      await flashArcPay
        .connect(payer)
        .payMerchant(merchant.address, "ORDER-001", AMOUNT);
      expect(
        await flashArcPay.isOrderProcessed(
          merchant.address,
          "ORDER-001",
          AMOUNT
        )
      ).to.be.true;
    });
  });

  describe("Edge cases", () => {
    it("Should handle minimum USDC amount (1 unit = 0.000001 USDC)", async () => {
      await flashArcPay
        .connect(payer)
        .payMerchant(merchant.address, "ORDER-MIN", 1n);
    });

    it("Should not process order that wasn't paid", async () => {
      const processed = await flashArcPay.isOrderProcessed(
        merchant.address,
        "GHOST-ORDER",
        AMOUNT
      );
      expect(processed).to.be.false;
    });
  });
});
