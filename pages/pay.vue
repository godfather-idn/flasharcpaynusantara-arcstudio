<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { ArrowLeft, Wallet, CheckCircle2, Loader2, XCircle, DollarSign, Hash, User, Receipt, History, Copy } from "lucide-vue-next";

const router = useRouter();
const route = useRoute();
const arc = useArcAppKit();
const paymentHistory = usePaymentHistory();

const chainId = Number(import.meta.env.VITE_ARC_CHAIN_ID || 5042002);
const isMainnet = computed(() => chainId === 5042);
const networkLabel = computed(() => isMainnet.value ? "Mainnet" : "Testnet");
const networkName = computed(() => isMainnet.value ? "Arc Mainnet" : "Arc Testnet");

// Payment details from URL
const merchantAddress = ref<`0x${string}` | "">("");
const amount = ref("");     // display USDC string
const rawAmount = ref("");  // raw USDC units string
const orderId = ref("");

// Payment state
const paymentStatus = ref<"idle" | "processing" | "success" | "error">("idle");
const paymentMessage = ref("");
const transactionHash = ref("");
const isConnecting = ref(false);
const showWalletModal = ref(false);
const isMobileDevice = ref(false);

const explorerUrl = import.meta.env.VITE_ARC_EXPLORER_URL || "https://explorer.testnet.arc.io";

const isMobileCheck = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

watch(arc.isConnected, (newVal) => {
  if (newVal && paymentStatus.value === "error" && paymentMessage.value.includes("connect wallet")) {
    paymentStatus.value = "idle";
    paymentMessage.value = "";
  }
});

const copyToClipboard = async (text: string) => {
  try { await navigator.clipboard.writeText(text); } catch {}
};

onMounted(() => {
  isMobileDevice.value = isMobileCheck();

  if (route.query.merchant) merchantAddress.value = route.query.merchant as `0x${string}`;
  if (route.query.amount) {
    rawAmount.value = route.query.amount as string;
    // amount query is raw USDC units (6 decimals) — convert to display
    try {
      amount.value = arc.formatUSDC(BigInt(rawAmount.value));
    } catch {
      amount.value = route.query.amount as string;
    }
  }
  if (route.query.orderId) orderId.value = route.query.orderId as string;

  if (!merchantAddress.value || !rawAmount.value || !orderId.value) {
    paymentStatus.value = "error";
    paymentMessage.value = "Invalid payment parameters. Please scan a valid QR code.";
  }
});

const handleConnectWallet = async () => {
  isConnecting.value = true;
  try {
    await arc.connectWallet();
    await arc.fetchBalance();
  } catch (e) {
    paymentStatus.value = "error";
    paymentMessage.value = "Failed to connect wallet. Please try again.";
  } finally {
    isConnecting.value = false;
  }
};

const handleWalletSelect = async (walletType: string) => {
  showWalletModal.value = false;
  await handleConnectWallet();
};

const formatAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatBalance = (bal: bigint) => arc.formatBalance(bal);

const canProcessPayment = computed(() => {
  return (
    arc.isConnected.value &&
    merchantAddress.value &&
    rawAmount.value &&
    orderId.value &&
    paymentStatus.value !== "processing" &&
    paymentStatus.value !== "success"
  );
});

const hasEnough = computed(() => {
  if (!arc.isConnected.value) return true; // don't show warning before connecting
  try {
    return arc.balance.value >= BigInt(rawAmount.value || "0");
  } catch {
    return false;
  }
});

const handlePayment = async () => {
  if (!arc.isConnected.value || !merchantAddress.value || !rawAmount.value || !orderId.value) return;

  paymentStatus.value = "processing";
  paymentMessage.value = "Processing payment...";

  try {
    const amountBigInt = BigInt(rawAmount.value);
    const hash = await arc.payMerchant(merchantAddress.value, orderId.value, amountBigInt);
    transactionHash.value = hash;
    paymentStatus.value = "success";
    paymentMessage.value = "Payment successful!";

    // Save to customer payment history
    if (arc.account.value) {
      paymentHistory.addPayment(arc.account.value, {
        type: "customer",
        orderId: orderId.value,
        merchant: merchantAddress.value,
        payer: arc.account.value,
        amount: amountBigInt.toString(),
        timestamp: Date.now(),
        status: "success",
        txHash: hash,
      });
    }
  } catch (e: any) {
    paymentStatus.value = "error";
    if (e.message?.includes("insufficient funds") || e.message?.includes("exceeds balance")) {
      paymentMessage.value = "Insufficient USDC balance for gas.";
    } else if (e.message?.includes("user rejected")) {
      paymentMessage.value = "Transaction rejected. Please approve in your wallet.";
    } else if (e.message?.includes("execution reverted")) {
      paymentMessage.value = "Transaction reverted. Please check the payment details.";
    } else if (e.message?.includes("chain") || e.message?.includes("network")) {
      paymentMessage.value = `Please switch your wallet to ${networkName.value} (Chain ID: ${chainId}).`;
    } else {
      paymentMessage.value = `Payment failed: ${e.message || "Unknown error"}`;
    }
  }
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
    <div class="max-w-2xl mx-auto">
      <!-- Header -->
      <div class="relative flex items-center justify-center mb-8">
        <button @click="router.push('/')" class="absolute left-0 p-2 -ml-2 flex items-center gap-2 text-white hover:text-purple-200 transition-colors">
          <ArrowLeft :size="28" />
          <span class="font-medium text-lg">Back</span>
        </button>
        <h1 class="text-3xl font-bold text-white">Payment</h1>
      </div>

      <!-- Payment Details Card -->
      <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 mb-6">
        <h2 class="text-2xl font-bold text-white mb-6">Payment Details</h2>
        <div class="space-y-4">
          <!-- Merchant -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <User :size="20" class="text-purple-300" />
              <div>
                <p class="text-purple-200 text-sm">Merchant</p>
                <p class="text-white font-semibold">{{ merchantAddress ? formatAddress(merchantAddress) : "N/A" }}</p>
              </div>
            </div>
            <button v-if="merchantAddress" @click="copyToClipboard(merchantAddress)" class="p-2 hover:bg-white/10 rounded-lg text-purple-300 transition-colors">
              <Copy :size="18" />
            </button>
          </div>
          <!-- Amount -->
          <div class="flex items-center gap-3">
            <DollarSign :size="20" class="text-purple-300" />
            <div>
              <p class="text-purple-200 text-sm">Amount</p>
              <p class="text-white font-semibold">{{ amount }} USDC</p>
            </div>
          </div>
          <!-- Order ID -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <Hash :size="20" class="text-purple-300" />
              <div>
                <p class="text-purple-200 text-sm">Order ID</p>
                <p class="text-white font-semibold">{{ orderId }}</p>
              </div>
            </div>
            <button v-if="orderId" @click="copyToClipboard(orderId)" class="p-2 hover:bg-white/10 rounded-lg text-purple-300 transition-colors">
              <Copy :size="18" />
            </button>
          </div>
        </div>
      </div>

      <!-- Wallet Card -->
      <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-white">Wallet</h2>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium" :class="arc.isConnected.value ? 'text-green-400' : 'text-red-400'">
              {{ arc.isConnected.value ? "Connected" : "Not Connected" }}
            </span>
            <div
              :class="arc.isConnected.value ? 'bg-green-500' : 'bg-red-500'"
              class="w-3 h-3 rounded-full"
              :style="arc.isConnected.value ? 'box-shadow: 0 0 8px #22c55e' : 'box-shadow: 0 0 8px #ef4444'"
            ></div>
          </div>
        </div>

        <div v-if="arc.isConnected.value" class="space-y-4">
          <div>
            <p class="text-purple-200 text-sm">Connected Address</p>
            <p class="text-white font-semibold">{{ formatAddress(arc.account.value || "") }}</p>
          </div>
          <div>
            <p class="text-purple-200 text-sm">USDC Balance</p>
            <p class="text-white font-semibold" :class="hasEnough ? '' : 'text-red-400'">
              {{ formatBalance(arc.balance.value) }} USDC
            </p>
          </div>
          <div v-if="!hasEnough" class="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-200 text-sm">
            Insufficient USDC balance. You need {{ amount }} USDC.
          </div>
        </div>

        <div v-else>
          <p class="text-purple-200 mb-4 text-sm">Connect your wallet to proceed with payment</p>
          <button
            @click="showWalletModal = true"
            :disabled="isConnecting"
            class="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Loader2 v-if="isConnecting" class="animate-spin" :size="20" />
            <Wallet v-else :size="20" />
            {{ isConnecting ? "Connecting..." : "Connect Wallet" }}
          </button>
        </div>
      </div>

      <!-- Status Card -->
      <div
        v-if="paymentStatus !== 'idle'"
        :class="{
          'bg-green-500/20 border-green-500': paymentStatus === 'success',
          'bg-yellow-500/20 border-yellow-500': paymentStatus === 'processing',
          'bg-red-500/20 border-red-500': paymentStatus === 'error',
        }"
        class="backdrop-blur-lg rounded-xl p-6 border mb-6"
      >
        <div class="flex items-center gap-3">
          <CheckCircle2 v-if="paymentStatus === 'success'" :size="24" class="text-green-400" />
          <Loader2 v-if="paymentStatus === 'processing'" :size="24" class="text-yellow-400 animate-spin" />
          <XCircle v-if="paymentStatus === 'error'" :size="24" class="text-red-400" />
          <span class="text-white font-semibold">{{ paymentMessage }}</span>
        </div>
        <div v-if="transactionHash" class="mt-4">
          <p class="text-purple-200 text-sm">Transaction Hash</p>
          <a
            :href="`${explorerUrl}/tx/${transactionHash}`"
            target="_blank"
            class="text-blue-300 text-sm break-all hover:underline"
          >{{ transactionHash }}</a>
        </div>
      </div>

      <!-- Pay Button -->
      <button
        v-if="canProcessPayment"
        @click="handlePayment"
        :disabled="!hasEnough"
        class="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
      >
        Pay {{ amount }} USDC
      </button>

      <!-- Success Actions -->
      <div v-if="paymentStatus === 'success'" class="space-y-3 mt-4">
        <button
          @click="router.push(`/receipt?txHash=${transactionHash}&merchant=${merchantAddress}&orderId=${orderId}&amount=${rawAmount}&payer=${arc.account.value}`)"
          class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
        >
          <Receipt :size="20" />
          View Receipt
        </button>
        <button
          @click="router.push('/customer-history')"
          class="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 border border-white/20 flex items-center justify-center gap-2"
        >
          <History :size="20" />
          View Payment History
        </button>
        <button
          @click="router.push('/')"
          class="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 border border-white/20"
        >
          Return to Home
        </button>
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
