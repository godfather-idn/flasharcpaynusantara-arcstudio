<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import QRCode from "qrcode";
import { ArrowLeft, QrCode, DollarSign, Hash, CheckCircle2, Clock, XCircle, Wallet, History, Copy } from "lucide-vue-next";
import type { Address, Hash as TxHash } from "viem";

const router = useRouter();
const arc = useArcAppKit();

const chainId = Number(import.meta.env.VITE_ARC_CHAIN_ID || 5042002);
const isMainnet = computed(() => chainId === 5042);
const networkLabel = computed(() => isMainnet.value ? "Mainnet" : "Testnet");

// Form state
const amount = ref("");
const generateOrderId = () => `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
const orderId = ref(generateOrderId());
const qrCodeUrl = ref("");
const showQR = ref(false);
const paymentStatus = ref<"idle" | "waiting" | "success" | "error">("idle");
const paymentMessage = ref("");
const copied = ref(false);
const showWalletModal = ref(false);
const isMobileDevice = ref(false);

let cleanupWatcher: (() => void) | null = null;

const isMobileCheck = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

onMounted(async () => {
  isMobileDevice.value = isMobileCheck();
  try {
    await arc.connectWallet();
  } catch (e) {
    console.error("Failed to connect wallet:", e);
  }
});

onUnmounted(() => {
  if (cleanupWatcher) cleanupWatcher();
});

const formatAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const copyAddress = async () => {
  if (!arc.account.value) return;
  try {
    await navigator.clipboard.writeText(arc.account.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {}
};

const handleWalletSelect = async (walletType: string) => {
  showWalletModal.value = false;
  try {
    await arc.connectWallet();
  } catch (e: any) {
    console.error("Failed to connect wallet:", e);
  }
};

const generateQR = async () => {
  if (!arc.isConnected.value || !arc.account.value || !amount.value || !orderId.value) return;

  const amountNum = parseFloat(amount.value);
  if (isNaN(amountNum) || amountNum <= 0) return;

  try {
    const amountRaw = arc.parseUSDC(amount.value).toString();
    const baseUrl = window.location.origin;
    const payUrl = `${baseUrl}/pay?merchant=${arc.account.value}&amount=${amountRaw}&orderId=${orderId.value}`;

    qrCodeUrl.value = await QRCode.toDataURL(payUrl, {
      width: 300,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    showQR.value = true;
    paymentStatus.value = "waiting";
    paymentMessage.value = "Waiting for payment...";

    if (cleanupWatcher) cleanupWatcher();
    cleanupWatcher = arc.watchPayments(arc.account.value as Address, (event) => {
      if (event.orderId === orderId.value) {
        paymentStatus.value = "success";
        paymentMessage.value = `Payment received! ${arc.formatUSDC(event.amount)} USDC`;
        if (cleanupWatcher) { cleanupWatcher(); cleanupWatcher = null; }
      }
    });

    // 5-minute timeout
    setTimeout(() => {
      if (paymentStatus.value === "waiting") {
        paymentStatus.value = "error";
        paymentMessage.value = "Payment timeout. Please generate a new QR code.";
        if (cleanupWatcher) { cleanupWatcher(); cleanupWatcher = null; }
      }
    }, 5 * 60 * 1000);
  } catch (e) {
    console.error("Failed to generate QR:", e);
  }
};

const resetForm = () => {
  amount.value = "";
  orderId.value = generateOrderId();
  qrCodeUrl.value = "";
  showQR.value = false;
  paymentStatus.value = "idle";
  paymentMessage.value = "";
  if (cleanupWatcher) { cleanupWatcher(); cleanupWatcher = null; }
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 pb-8">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6 mt-4">
        <button @click="router.push('/')" class="flex items-center gap-2 text-white hover:text-purple-200 transition-colors text-lg">
          <ArrowLeft :size="24" />
          <span class="font-medium">Back</span>
        </button>
        <NuxtLink to="/merchant-history" class="flex items-center gap-2 text-white hover:text-purple-200 transition-colors text-lg">
          <History :size="24" />
          <span class="font-medium">History</span>
        </NuxtLink>
      </div>

      <!-- Page Title -->
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-bold text-white">Merchant POS</h1>
      </div>

      <!-- Connection Status -->
      <div class="bg-white/10 backdrop-blur-lg rounded-xl p-4 mb-6 border border-white/20">
        <div v-if="arc.isConnected.value" class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-3 h-3 rounded-full bg-green-500" style="box-shadow: 0 0 8px #22c55e"></div>
            <span class="text-white font-medium">Connected</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs bg-purple-600/50 border border-purple-400/50 px-2 py-1 rounded-md text-white">{{ networkLabel }}</span>
            <button @click="copyAddress" class="text-white font-medium bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md text-sm transition-colors" title="Copy Address">
              {{ copied ? "Copied!" : formatAddress(arc.account.value || "") }}
            </button>
          </div>
        </div>
        <div v-else class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-3 h-3 rounded-full bg-red-500" style="box-shadow: 0 0 8px #ef4444"></div>
            <span class="text-white font-medium">Not Connected</span>
          </div>
          <button @click="showWalletModal = true" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2 text-sm">
            <Wallet :size="16" />
            Connect Wallet
          </button>
        </div>
      </div>

      <!-- Form -->
      <div v-if="!showQR" class="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
        <h2 class="text-2xl font-bold text-white mb-6">Create Payment QR</h2>
        <div class="space-y-6">
          <!-- Amount -->
          <div>
            <label class="block text-white font-medium mb-2 flex items-center gap-2">
              <DollarSign :size="20" />
              Amount (USDC)
            </label>
            <input
              v-model="amount"
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              placeholder="Enter amount in USDC"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 focus:bg-white/20 transition-all"
            />
          </div>
          <!-- Order ID -->
          <div>
            <label class="block text-white font-medium mb-2 flex items-center gap-2">
              <Hash :size="20" />
              Order ID
            </label>
            <input
              v-model="orderId"
              type="text"
              placeholder="Enter order ID"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 focus:bg-white/20 transition-all"
            />
          </div>
          <!-- Generate Button -->
          <button
            @click="generateQR"
            :disabled="!arc.isConnected.value || !amount || !orderId"
            class="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <QrCode :size="20" />
            Generate QR Code
          </button>
        </div>
      </div>

      <!-- QR Code Display -->
      <div v-else class="space-y-6">
        <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-white">Payment QR Code</h2>
          </div>
          <div class="flex flex-col items-center">
            <div class="bg-white p-4 rounded-xl mb-6 relative">
              <img :src="qrCodeUrl" alt="Payment QR Code" class="w-64 h-64 transition-all duration-300" :class="{ 'opacity-30 blur-[2px]': paymentStatus === 'error' }" />
              <div v-if="paymentStatus === 'error'" class="absolute inset-0 flex items-center justify-center">
                <XCircle :size="64" class="text-red-500 bg-white rounded-full" />
              </div>
            </div>
            <div class="text-center space-y-2 mb-4">
              <p class="text-purple-200 uppercase tracking-widest text-sm font-semibold">[ Total Bayar ]</p>
              <p class="text-white text-4xl font-extrabold">{{ amount }} USDC</p>
              <p class="text-purple-200 pt-2">Order ID: {{ orderId }}</p>
            </div>
            <div v-if="paymentStatus !== 'error' && paymentStatus !== 'success'" class="mt-2 w-full max-w-xs">
              <button @click="resetForm" class="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-xl transition-all border border-white/20">
                Generate New QR
              </button>
            </div>
          </div>
        </div>

        <!-- Payment Status -->
        <div v-if="paymentStatus === 'error'" class="backdrop-blur-lg rounded-xl p-6 border bg-red-500/20 border-red-500 text-center">
          <div class="flex items-center justify-center gap-3 mb-4">
            <XCircle :size="24" class="text-red-400" />
            <span class="text-white font-semibold">{{ paymentMessage }}</span>
          </div>
          <button @click="resetForm" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
            Buat QR Code Baru
          </button>
        </div>

        <div v-else
          :class="{
            'bg-green-500/20 border-green-500': paymentStatus === 'success',
            'bg-yellow-500/20 border-yellow-500': paymentStatus === 'waiting',
          }"
          class="backdrop-blur-lg rounded-xl p-6 border"
        >
          <div class="flex items-center gap-3">
            <CheckCircle2 v-if="paymentStatus === 'success'" :size="24" class="text-green-400" />
            <Clock v-if="paymentStatus === 'waiting'" :size="24" class="text-yellow-400" />
            <span class="text-white font-semibold">{{ paymentMessage }}</span>
          </div>
          <div v-if="paymentStatus === 'success'" class="mt-4">
            <button @click="resetForm" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors">
              New Transaction
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Wallet Modal -->
    <WalletConnectModal
      :is-open="showWalletModal"
      :is-mobile="isMobileDevice"
      @close="showWalletModal = false"
      @select-wallet="handleWalletSelect"
    />
  </div>
</template>
