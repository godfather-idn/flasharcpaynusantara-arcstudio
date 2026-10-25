<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
        <NuxtLink to="/" class="text-gray-500 hover:text-gray-800 transition">
          ← Back
        </NuxtLink>
        <h1 class="text-xl font-bold text-gray-900 flex-1 text-center">Merchant POS</h1>
        <NuxtLink to="/merchant-history" class="text-blue-600 text-sm font-medium">History</NuxtLink>
      </div>
    </header>

    <div class="max-w-lg mx-auto px-4 py-6 space-y-4">
      <!-- Wallet card -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div v-if="arc.isConnected.value && arc.account.value" class="flex items-center justify-between">
          <div>
            <div class="text-xs text-gray-500 uppercase tracking-wide">Merchant Wallet</div>
            <div class="font-mono text-sm text-gray-800 flex items-center gap-2">
              {{ shortAddress(arc.account.value) }}
              <button @click="copyAddress" class="text-blue-500 hover:text-blue-700 text-xs">
                {{ copied ? "✓ Copied" : "Copy" }}
              </button>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs text-gray-500">USDC Balance</div>
            <div class="font-bold text-gray-900">{{ arc.formatBalance() }} USDC</div>
          </div>
        </div>
        <button
          v-else
          @click="arc.connectWallet"
          :disabled="arc.isLoading.value"
          class="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {{ arc.isLoading.value ? "Connecting…" : "Connect Wallet" }}
        </button>
        <div v-if="arc.error.value" class="mt-2 text-red-500 text-sm">{{ arc.error.value }}</div>
      </div>

      <!-- Input form -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
        <h2 class="font-bold text-gray-900">New Payment Request</h2>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Amount (USDC)</label>
          <div class="relative">
            <input
              v-model="amount"
              type="number"
              min="0.000001"
              step="0.01"
              placeholder="0.00"
              class="w-full border-2 border-gray-300 rounded-lg p-4 text-lg font-bold focus:border-blue-500 focus:outline-none pr-20"
            />
            <span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">USDC</span>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
          <input
            v-model="orderId"
            type="text"
            placeholder="ORDER-001"
            class="w-full border-2 border-gray-300 rounded-lg p-4 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          @click="generateQR"
          :disabled="!canGenerate"
          class="w-full bg-blue-600 text-white rounded-lg py-4 font-bold text-lg hover:bg-blue-700 disabled:opacity-40 transition"
        >
          {{ generating ? "Generating…" : "Generate QR Code" }}
        </button>
      </div>

      <!-- QR Code display -->
      <div v-if="qrDataUrl" class="bg-white rounded-xl shadow-lg border border-gray-200 p-6 text-center">
        <h3 class="font-bold text-gray-900 mb-4">Scan to Pay</h3>
        <div class="flex justify-center mb-4">
          <img :src="qrDataUrl" alt="Payment QR Code" class="w-64 h-64 rounded-lg shadow" />
        </div>
        <div class="text-sm text-gray-500 mb-1">Amount: <span class="font-bold text-gray-900">{{ amount }} USDC</span></div>
        <div class="text-sm text-gray-500 mb-4">Order ID: <span class="font-mono text-gray-900">{{ orderId }}</span></div>

        <!-- Buttons -->
        <div class="flex gap-2 justify-center">
          <a
            :href="qrDataUrl"
            :download="`qr-${orderId}.png`"
            class="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium transition"
          >
            ⬇ Download
          </a>
          <button
            @click="copyPaymentLink"
            class="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium transition"
          >
            {{ copiedLink ? "✓ Copied" : "🔗 Copy Link" }}
          </button>
        </div>
      </div>

      <!-- Payment status -->
      <div v-if="qrDataUrl" class="bg-gray-50 rounded-lg p-4 border-2" :class="statusBorderClass">
        <div class="flex items-center gap-3">
          <div class="text-2xl">{{ statusIcon }}</div>
          <div>
            <div class="font-semibold text-gray-900">{{ statusLabel }}</div>
            <div v-if="paymentEvent" class="text-sm text-gray-600 mt-1">
              From: {{ shortAddress(paymentEvent.payer) }} · Tx:
              <a
                :href="`https://explorer.testnet.arc.io/tx/${paymentEvent.txHash}`"
                target="_blank"
                class="text-blue-600 hover:underline font-mono"
              >{{ shortHash(paymentEvent.txHash) }}</a>
            </div>
            <div v-if="pollStatus === 'waiting'" class="text-xs text-gray-400 mt-1">
              Listening for payment… ({{ waitSeconds }}s)
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import QRCode from "qrcode";
import type { Address, Hash } from "viem";

const arc = useArcAppKit();

const amount = ref("");
const orderId = ref("");
const qrDataUrl = ref("");
const generating = ref(false);
const copied = ref(false);
const copiedLink = ref(false);
const pollStatus = ref<"idle" | "waiting" | "success" | "error">("idle");
const waitSeconds = ref(0);
const paymentEvent = ref<{
  payer: Address;
  orderId: string;
  amount: bigint;
  txHash: Hash;
} | null>(null);

let cleanupWatcher: (() => void) | null = null;
let waitTimer: ReturnType<typeof setInterval> | null = null;

const canGenerate = computed(
  () =>
    arc.isConnected.value &&
    arc.account.value &&
    Number(amount.value) > 0 &&
    orderId.value.trim().length > 0 &&
    !generating.value
);

const statusBorderClass = computed(() => {
  if (pollStatus.value === "success") return "border-green-400";
  if (pollStatus.value === "error") return "border-red-400";
  if (pollStatus.value === "waiting") return "border-yellow-400";
  return "border-gray-200";
});

const statusIcon = computed(() => {
  if (pollStatus.value === "success") return "✅";
  if (pollStatus.value === "error") return "❌";
  if (pollStatus.value === "waiting") return "⏳";
  return "🔵";
});

const statusLabel = computed(() => {
  if (pollStatus.value === "success") return "Payment received!";
  if (pollStatus.value === "error") return "Payment failed";
  if (pollStatus.value === "waiting") return "Waiting for payment…";
  return "QR code ready";
});

const shortAddress = (addr: string) =>
  `${addr.slice(0, 6)}…${addr.slice(-4)}`;
const shortHash = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-6)}`;

const copyAddress = async () => {
  if (!arc.account.value) return;
  await navigator.clipboard.writeText(arc.account.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
};

const copyPaymentLink = async () => {
  if (!arc.account.value) return;
  const url = buildPaymentUrl();
  await navigator.clipboard.writeText(url);
  copiedLink.value = true;
  setTimeout(() => (copiedLink.value = false), 2000);
};

const buildPaymentUrl = () => {
  if (!arc.account.value) return "";
  const base = window.location.origin;
  const amountRaw = arc.parseUSDC(amount.value).toString();
  return `${base}/pay?merchant=${arc.account.value}&amount=${amountRaw}&orderId=${encodeURIComponent(orderId.value)}`;
};

const generateQR = async () => {
  if (!canGenerate.value) return;
  generating.value = true;
  qrDataUrl.value = "";
  paymentEvent.value = null;
  pollStatus.value = "idle";
  cleanupPoll();

  try {
    const url = buildPaymentUrl();
    qrDataUrl.value = await QRCode.toDataURL(url, { width: 256, margin: 1 });
    pollStatus.value = "waiting";
    waitSeconds.value = 0;
    waitTimer = setInterval(() => waitSeconds.value++, 1000);

    // Start event listener
    const merchant = arc.account.value as Address;
    cleanupWatcher = arc.watchPayments(merchant, (event) => {
      if (event.orderId === orderId.value) {
        paymentEvent.value = {
          payer: event.payer,
          orderId: event.orderId,
          amount: event.amount,
          txHash: event.txHash,
        };
        pollStatus.value = "success";
        cleanupPoll();
        arc.fetchBalance();
      }
    });
  } finally {
    generating.value = false;
  }
};

const cleanupPoll = () => {
  if (cleanupWatcher) {
    cleanupWatcher();
    cleanupWatcher = null;
  }
  if (waitTimer) {
    clearInterval(waitTimer);
    waitTimer = null;
  }
};

onUnmounted(cleanupPoll);
</script>
