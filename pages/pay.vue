<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
        <NuxtLink to="/" class="text-gray-500 hover:text-gray-800">← Back</NuxtLink>
        <h1 class="text-xl font-bold text-gray-900 flex-1 text-center">Payment Details</h1>
        <NuxtLink to="/scan" class="text-blue-600 text-sm font-medium">Scan QR</NuxtLink>
      </div>
    </header>

    <div class="max-w-lg mx-auto px-4 py-6 space-y-4">
      <!-- Invalid URL warning -->
      <div v-if="!isValidParams" class="bg-red-50 border-2 border-red-400 rounded-xl p-6 text-center">
        <div class="text-4xl mb-2">❌</div>
        <div class="font-bold text-red-700">Invalid Payment Link</div>
        <div class="text-red-500 text-sm mt-1">Required parameters are missing or invalid.</div>
        <NuxtLink to="/scan" class="inline-block mt-4 bg-red-600 text-white rounded-lg px-6 py-2 font-semibold hover:bg-red-700">
          Scan a New QR
        </NuxtLink>
      </div>

      <template v-else>
        <!-- Payment summary -->
        <div class="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h2 class="font-bold text-gray-900 mb-4">Payment Summary</h2>
          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-gray-500">Merchant</span>
              <span class="font-mono text-sm text-gray-800">{{ shortAddress(params.merchant) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Order ID</span>
              <span class="font-mono text-sm text-gray-800">{{ params.orderId }}</span>
            </div>
            <div class="border-t border-gray-200 pt-3 flex justify-between items-center">
              <span class="font-bold text-gray-900 text-lg">Total</span>
              <span class="font-bold text-3xl text-gray-900">{{ displayAmount }} USDC</span>
            </div>
          </div>
        </div>

        <!-- Wallet section -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div v-if="!arc.isConnected.value">
            <div class="text-center text-gray-500 mb-4">Connect your wallet to pay</div>
            <button
              @click="arc.connectWallet"
              :disabled="arc.isLoading.value"
              class="w-full bg-blue-600 text-white rounded-lg py-4 font-bold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {{ arc.isLoading.value ? "Connecting…" : "Connect Wallet" }}
            </button>
            <div v-if="arc.error.value" class="mt-2 text-red-500 text-sm text-center">{{ arc.error.value }}</div>
          </div>

          <div v-else>
            <div class="flex justify-between items-center mb-4">
              <div>
                <div class="text-xs text-gray-500">Your Wallet</div>
                <div class="font-mono text-sm">{{ shortAddress(arc.account.value!) }}</div>
              </div>
              <div class="text-right">
                <div class="text-xs text-gray-500">USDC Balance</div>
                <div class="font-bold" :class="hasEnough ? 'text-gray-900' : 'text-red-500'">
                  {{ arc.formatBalance() }} USDC
                </div>
              </div>
            </div>

            <div v-if="!hasEnough" class="bg-red-50 border border-red-300 rounded-lg p-3 mb-4 text-sm text-red-600">
              ⚠️ Insufficient USDC balance. You need {{ displayAmount }} USDC.
            </div>

            <!-- Progress steps -->
            <div v-if="payStatus !== 'idle'" class="mb-4">
              <div class="flex items-center gap-2 text-sm mb-1">
                <span :class="stepClass(1)">1. Connect</span>
                <span class="text-gray-300">→</span>
                <span :class="stepClass(2)">2. Approve</span>
                <span class="text-gray-300">→</span>
                <span :class="stepClass(3)">3. Confirm</span>
              </div>
              <div v-if="txHash" class="text-xs text-gray-500 mt-1">
                Tx:
                <a :href="`https://explorer.testnet.arc.io/tx/${txHash}`" target="_blank" class="text-blue-600 hover:underline font-mono">
                  {{ shortHash(txHash) }}
                </a>
              </div>
            </div>

            <!-- Pay button -->
            <button
              v-if="payStatus !== 'success'"
              @click="pay"
              :disabled="!hasEnough || payStatus === 'processing'"
              class="w-full bg-green-600 text-white rounded-lg py-4 font-bold text-lg hover:bg-green-700 disabled:opacity-50 transition"
            >
              {{ payButtonLabel }}
            </button>

            <!-- Success state -->
            <div v-if="payStatus === 'success'" class="bg-green-50 border-2 border-green-500 rounded-xl p-5 text-center">
              <div class="text-4xl mb-2">🎉</div>
              <div class="font-bold text-green-700 text-lg">Payment Successful!</div>
              <div class="text-green-600 text-sm mt-1">Your payment has been processed onchain.</div>
              <div class="flex gap-2 justify-center mt-4">
                <NuxtLink to="/scan" class="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-green-700">
                  Scan Another
                </NuxtLink>
                <NuxtLink :to="`/receipt?txHash=${txHash}&merchant=${params.merchant}&orderId=${params.orderId}&amount=${params.rawAmount}&payer=${arc.account.value}`" class="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-gray-200">
                  View Receipt
                </NuxtLink>
              </div>
            </div>

            <!-- Error state -->
            <div v-if="payStatus === 'error'" class="mt-3 bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-600">
              {{ payError }}
              <button @click="payStatus = 'idle'; payError = ''" class="ml-2 underline">Retry</button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Hash } from "viem";

const route = useRoute();
const arc = useArcAppKit();

const params = computed(() => {
  const merchant = (route.query.merchant as string) || "";
  const rawAmount = (route.query.amount as string) || "";
  const orderId = (route.query.orderId as string) || "";
  return { merchant, rawAmount, orderId };
});

const isValidParams = computed(() => {
  const { merchant, rawAmount, orderId } = params.value;
  return (
    /^0x[0-9a-fA-F]{40}$/.test(merchant) &&
    Number(rawAmount) > 0 &&
    orderId.length > 0
  );
});

const displayAmount = computed(() => {
  if (!params.value.rawAmount) return "0.00";
  return arc.formatUSDC(BigInt(params.value.rawAmount));
});

const hasEnough = computed(() => {
  if (!arc.isConnected.value) return false;
  return arc.balance.value >= BigInt(params.value.rawAmount || "0");
});

const payStatus = ref<"idle" | "processing" | "success" | "error">("idle");
const payError = ref("");
const txHash = ref<Hash | "">("");
const currentStep = ref(1);

const payButtonLabel = computed(() => {
  if (payStatus.value === "processing") return "Processing…";
  return `Pay ${displayAmount.value} USDC`;
});

const stepClass = (step: number) => {
  if (currentStep.value > step) return "text-green-600 font-semibold";
  if (currentStep.value === step) return "text-blue-600 font-semibold";
  return "text-gray-400";
};

const shortAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
const shortHash = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-6)}`;

const pay = async () => {
  if (!arc.isConnected.value || !arc.account.value) return;
  payStatus.value = "processing";
  payError.value = "";
  currentStep.value = 2;

  try {
    const amount = BigInt(params.value.rawAmount);
    currentStep.value = 3;
    const hash = await arc.payMerchant(
      params.value.merchant as `0x${string}`,
      params.value.orderId,
      amount
    );
    txHash.value = hash;
    payStatus.value = "success";
    currentStep.value = 4;
  } catch (e) {
    payStatus.value = "error";
    payError.value = e instanceof Error ? e.message : "Transaction failed.";
    currentStep.value = 1;
  }
};
</script>
