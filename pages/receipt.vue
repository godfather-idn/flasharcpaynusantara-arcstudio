<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white border-b border-gray-200">
      <div class="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
        <button @click="$router.back()" class="text-gray-500 hover:text-gray-800">← Back</button>
        <h1 class="text-xl font-bold text-gray-900 flex-1 text-center">Payment Receipt</h1>
        <button @click="share" class="text-blue-600 text-sm font-medium">Share</button>
      </div>
    </header>

    <div class="max-w-md mx-auto px-4 py-8">
      <div class="bg-white rounded-2xl shadow-xl overflow-hidden">
        <!-- Top branding strip -->
        <div class="bg-gradient-to-r from-blue-600 to-purple-700 px-8 py-5 text-white text-center">
          <div class="text-2xl mb-1">⚡ FlashArcPay Nusantara</div>
          <div class="text-xs text-white/70 uppercase tracking-widest">Transaction Receipt</div>
        </div>

        <div class="px-8 py-6 space-y-4">
          <!-- Status badge -->
          <div class="flex justify-center">
            <span class="bg-green-100 text-green-800 font-semibold px-4 py-1 rounded-full text-sm">
              ✅ Confirmed
            </span>
          </div>

          <!-- QR code for receipt verification -->
          <div v-if="receiptQr" class="flex justify-center my-4">
            <img :src="receiptQr" alt="Receipt QR" class="w-28 h-28 rounded-lg border border-gray-200" />
          </div>

          <!-- Divider -->
          <div class="border-t-2 border-dashed border-gray-200" />

          <!-- Details -->
          <div class="space-y-3 text-sm">
            <div v-if="params.txHash" class="flex justify-between gap-2">
              <span class="text-gray-500 flex-shrink-0">Receipt ID</span>
              <span class="font-mono text-gray-800 text-right break-all">{{ shortHash(params.txHash) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Order ID</span>
              <span class="font-mono text-gray-800">{{ params.orderId }}</span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-gray-500 flex-shrink-0">From</span>
              <span class="font-mono text-gray-800 text-right break-all">{{ shortAddress(params.payer) }}</span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-gray-500 flex-shrink-0">To</span>
              <span class="font-mono text-gray-800 text-right break-all">{{ shortAddress(params.merchant) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Date</span>
              <span class="text-gray-800">{{ formatDate(Date.now()) }}</span>
            </div>
          </div>

          <!-- Divider -->
          <div class="border-t-2 border-dashed border-gray-200" />

          <!-- Amount -->
          <div class="flex justify-between items-center">
            <span class="text-gray-700 font-semibold text-lg">Total Paid</span>
            <span class="text-3xl font-bold text-gray-900">{{ displayAmount }} USDC</span>
          </div>

          <!-- Explorer link -->
          <div v-if="params.txHash" class="text-center">
            <a
              :href="`https://explorer.testnet.arc.io/tx/${params.txHash}`"
              target="_blank"
              class="text-blue-600 hover:underline text-sm"
            >
              View on Arc Explorer →
            </a>
          </div>

          <!-- Footer -->
          <div class="border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
            Thank you for your payment
            <br />Built with ❤️ for the Arc Network ecosystem
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-3 mt-6">
        <NuxtLink
          to="/scan"
          class="flex-1 bg-blue-600 text-white rounded-xl py-3 font-semibold text-center hover:bg-blue-700 transition"
        >
          Scan Another QR
        </NuxtLink>
        <NuxtLink
          to="/customer-history"
          class="flex-1 bg-white border border-gray-300 text-gray-700 rounded-xl py-3 font-semibold text-center hover:bg-gray-50 transition"
        >
          My History
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import QRCode from "qrcode";

const route = useRoute();

const params = computed(() => ({
  txHash: (route.query.txHash as string) || "",
  merchant: (route.query.merchant as string) || "",
  orderId: (route.query.orderId as string) || "",
  rawAmount: (route.query.amount as string) || "0",
  payer: (route.query.payer as string) || "",
}));

const receiptQr = ref("");

const displayAmount = computed(() => {
  try {
    const raw = BigInt(params.value.rawAmount);
    return (Number(raw) / 1_000_000).toFixed(6);
  } catch {
    return "0.000000";
  }
});

const shortAddress = (addr: string) =>
  addr ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : "—";
const shortHash = (hash: string) =>
  hash ? `${hash.slice(0, 12)}…${hash.slice(-8)}` : "—";

const formatDate = (ts: number) =>
  new Date(ts).toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "medium",
  });

const share = async () => {
  const text = `FlashArcPay Receipt\nOrder: ${params.value.orderId}\nAmount: ${displayAmount.value} USDC\nTx: ${params.value.txHash}`;
  if (navigator.share) {
    await navigator.share({ title: "FlashArcPay Receipt", text });
  } else {
    await navigator.clipboard.writeText(text);
    alert("Receipt details copied to clipboard!");
  }
};

onMounted(async () => {
  if (params.value.txHash) {
    try {
      receiptQr.value = await QRCode.toDataURL(
        `https://explorer.testnet.arc.io/tx/${params.value.txHash}`,
        { width: 112, margin: 1 }
      );
    } catch {
      /* ignore */
    }
  }
});
</script>
