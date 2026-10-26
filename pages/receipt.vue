<script setup lang="ts">
import { ref, onMounted } from "vue";
import QRCode from "qrcode";
import { ArrowLeft, Copy, Printer, ExternalLink, CheckCircle2, XCircle, Hash, DollarSign, Wallet, Calendar, Loader2, Download } from "lucide-vue-next";

const route = useRoute();
const router = useRouter();

const explorerUrl = import.meta.env.VITE_ARC_EXPLORER_URL || "https://explorer.testnet.arc.io";

// URL params
const txHash = route.query.txHash as string | undefined;
const orderId = route.query.orderId as string | undefined;
const merchant = route.query.merchant as string | undefined;
const amount = route.query.amount as string | undefined;
const payer = route.query.payer as string | undefined;

// State
const loading = ref(true);
const error = ref("");
const qrCodeUrl = ref("");
const showPrintDialog = ref(false);
const paperSize = ref<"a4" | "thermal" | "letter">("a4");
const includeQRCode = ref(true);
const includeFullDetails = ref(true);
const toast = ref<{ message: string; type: "success" | "error" } | null>(null);

// Derived receipt data from URL params
const receipt = ref<{
  transactionHash: string;
  orderId: string;
  merchant: string;
  payer: string;
  amount: bigint;
  timestamp: Date;
  status: "success" | "error";
} | null>(null);

onMounted(async () => {
  if (!txHash) {
    error.value = "No transaction hash provided";
    loading.value = false;
    return;
  }
  try {
    receipt.value = {
      transactionHash: txHash,
      orderId: orderId || "N/A",
      merchant: merchant || "N/A",
      payer: payer || "N/A",
      amount: amount ? BigInt(amount) : 0n,
      timestamp: new Date(),
      status: "success",
    };
    // Generate QR code for explorer link
    const explorerTxUrl = `${explorerUrl}/tx/${txHash}`;
    qrCodeUrl.value = await QRCode.toDataURL(explorerTxUrl, {
      width: 150, margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
  } catch (e: any) {
    error.value = e.message || "Failed to load receipt";
  } finally {
    loading.value = false;
  }
});

const formatAddress = (addr: string) => {
  if (!addr || addr === "N/A") return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const formatUSDC = (amt: bigint) =>
  (Number(amt) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatTimestamp = (date: Date) =>
  date.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const showToast = (message: string, type: "success" | "error") => {
  toast.value = { message, type };
  setTimeout(() => { toast.value = null; }, 3000);
};

const copyToClipboard = async (text: string, label = "Text") => {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied!`, "success");
  } catch {
    showToast("Failed to copy", "error");
  }
};

const copyReceiptUrl = () => copyToClipboard(window.location.href, "Receipt URL");

const viewOnExplorer = () => {
  if (receipt.value) window.open(`${explorerUrl}/tx/${receipt.value.transactionHash}`, "_blank");
};

const downloadQRCode = () => {
  if (!qrCodeUrl.value || !receipt.value) return;
  const link = document.createElement("a");
  link.href = qrCodeUrl.value;
  link.download = `receipt-${receipt.value.transactionHash.slice(0, 8)}-qr.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("QR code downloaded!", "success");
};

const executePrint = () => {
  showPrintDialog.value = false;
  const cssSize = paperSize.value === "a4" ? "210mm 297mm" : paperSize.value === "thermal" ? "80mm auto" : "216mm 279mm";
  const cssMargin = paperSize.value === "thermal" ? "5mm" : "10mm";
  const style = document.createElement("style");
  style.textContent = `@page { size: ${cssSize}; margin: ${cssMargin}; } body { min-height: auto !important; } .min-h-screen { min-height: auto !important; }`;
  document.head.appendChild(style);
  window.print();
  setTimeout(() => document.head.removeChild(style), 100);
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8 print:hidden">
        <button @click="router.back()" class="flex items-center gap-2 text-white hover:text-purple-200 transition-colors">
          <ArrowLeft :size="24" />
          <span>Back</span>
        </button>
        <h1 class="text-3xl font-bold text-white">Payment Receipt</h1>
        <div></div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="bg-white/10 backdrop-blur-lg rounded-xl p-12 border border-white/20">
        <div class="flex items-center justify-center">
          <Loader2 :size="32" class="text-purple-400 animate-spin" />
          <span class="ml-3 text-white">Loading receipt...</span>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="bg-red-500/20 backdrop-blur-lg rounded-xl p-12 border border-red-500/20">
        <div class="text-center">
          <XCircle :size="48" class="text-red-400 mx-auto mb-4" />
          <h3 class="text-xl font-bold text-white mb-2">Error Loading Receipt</h3>
          <p class="text-red-200">{{ error }}</p>
        </div>
      </div>

      <!-- Receipt Content -->
      <div v-else-if="receipt" class="space-y-6">
        <!-- Transaction Info -->
        <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Hash :size="24" />
            Transaction Info
          </h2>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-purple-200">Transaction Hash</span>
              <div class="flex items-center gap-2">
                <span class="text-white font-mono text-sm">{{ formatAddress(receipt.transactionHash) }}</span>
                <button @click="copyToClipboard(receipt.transactionHash, 'Transaction Hash')" class="text-purple-400 hover:text-purple-300 transition-colors print:hidden">
                  <Copy :size="16" />
                </button>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-purple-200 flex items-center gap-2">
                <Calendar :size="16" />
                Timestamp
              </span>
              <span class="text-white">{{ formatTimestamp(receipt.timestamp) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-purple-200">Status</span>
              <div class="flex items-center gap-2">
                <CheckCircle2 :size="20" class="text-green-400" />
                <span class="text-green-400 font-medium">Success</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Payment Info -->
        <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <DollarSign :size="24" />
            Payment Info
          </h2>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-purple-200">Amount</span>
              <span class="text-white font-bold text-xl">{{ formatUSDC(receipt.amount) }} USDC</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-purple-200">Order ID</span>
              <span class="text-white font-mono">{{ receipt.orderId }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-purple-200 flex items-center gap-2">
                <Wallet :size="16" />
                Merchant
              </span>
              <div class="flex items-center gap-2">
                <span class="text-white font-mono text-sm">{{ formatAddress(receipt.merchant) }}</span>
                <button v-if="receipt.merchant !== 'N/A'" @click="copyToClipboard(receipt.merchant, 'Merchant Address')" class="text-purple-400 hover:text-purple-300 transition-colors print:hidden">
                  <Copy :size="16" />
                </button>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-purple-200 flex items-center gap-2">
                <Wallet :size="16" />
                Payer
              </span>
              <div class="flex items-center gap-2">
                <span class="text-white font-mono text-sm">{{ formatAddress(receipt.payer) }}</span>
                <button v-if="receipt.payer !== 'N/A'" @click="copyToClipboard(receipt.payer, 'Payer Address')" class="text-purple-400 hover:text-purple-300 transition-colors print:hidden">
                  <Copy :size="16" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-wrap gap-4 print:hidden">
          <button @click="copyReceiptUrl" class="flex-1 min-w-[150px] bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2">
            <Copy :size="20" />
            Share URL
          </button>
          <button @click="showPrintDialog = true" class="flex-1 min-w-[150px] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2">
            <Printer :size="20" />
            Print
          </button>
          <button @click="viewOnExplorer" class="flex-1 min-w-[150px] bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2">
            <ExternalLink :size="20" />
            View on Explorer
          </button>
        </div>

        <!-- QR Code -->
        <div v-if="qrCodeUrl" class="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 flex flex-col items-center">
          <h3 class="text-lg font-bold text-white mb-4">Scan to Verify on Explorer</h3>
          <div class="bg-white p-4 rounded-lg">
            <img :src="qrCodeUrl" alt="Transaction QR Code" class="w-32 h-32" />
          </div>
          <p class="text-purple-200 text-sm mt-3 text-center">Scan this QR code to view transaction details on Arc Explorer</p>
          <button @click="downloadQRCode" class="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 print:hidden">
            <Download :size="20" />
            Download QR Code
          </button>
        </div>

        <!-- Print Dialog -->
        <div v-if="showPrintDialog" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:hidden">
          <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 class="text-xl font-bold text-gray-900 mb-4">Select Paper Size</h3>
            <div class="space-y-3 mb-6">
              <button @click="paperSize = 'a4'" :class="paperSize === 'a4' ? 'bg-purple-100 border-purple-500' : 'bg-gray-50 border-gray-300'" class="w-full p-4 border-2 rounded-lg flex items-center gap-3 transition-colors">
                <div class="w-8 h-8 border-2 border-gray-400 rounded flex items-center justify-center text-xs">A4</div>
                <div class="text-left"><p class="font-semibold text-gray-900">A4 Paper</p><p class="text-sm text-gray-600">210mm x 297mm</p></div>
              </button>
              <button @click="paperSize = 'thermal'" :class="paperSize === 'thermal' ? 'bg-purple-100 border-purple-500' : 'bg-gray-50 border-gray-300'" class="w-full p-4 border-2 rounded-lg flex items-center gap-3 transition-colors">
                <div class="w-8 h-8 border-2 border-gray-400 rounded flex items-center justify-center text-xs">80</div>
                <div class="text-left"><p class="font-semibold text-gray-900">Thermal Printer</p><p class="text-sm text-gray-600">80mm (Receipt)</p></div>
              </button>
              <button @click="paperSize = 'letter'" :class="paperSize === 'letter' ? 'bg-purple-100 border-purple-500' : 'bg-gray-50 border-gray-300'" class="w-full p-4 border-2 rounded-lg flex items-center gap-3 transition-colors">
                <div class="w-8 h-8 border-2 border-gray-400 rounded flex items-center justify-center text-xs">L</div>
                <div class="text-left"><p class="font-semibold text-gray-900">Letter</p><p class="text-sm text-gray-600">216mm x 279mm</p></div>
              </button>
            </div>
            <div v-if="paperSize === 'thermal'" class="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
              <h4 class="font-semibold text-gray-900 mb-3">Print Options</h4>
              <label class="flex items-center gap-2 mb-2 cursor-pointer">
                <input type="checkbox" v-model="includeQRCode" class="w-4 h-4" />
                <span class="text-sm text-gray-700">Include QR Code</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="includeFullDetails" class="w-4 h-4" />
                <span class="text-sm text-gray-700">Include Full Details</span>
              </label>
            </div>
            <div class="flex gap-3">
              <button @click="showPrintDialog = false" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold py-3 px-6 rounded-lg transition-colors">Cancel</button>
              <button @click="executePrint" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2">
                <Printer :size="20" />
                Print
              </button>
            </div>
          </div>
        </div>

        <!-- Toast -->
        <div v-if="toast" :class="['fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg transition-all duration-300 z-50', toast.type === 'success' ? 'bg-green-600' : 'bg-red-600']">
          <div class="flex items-center gap-2 text-white">
            <CheckCircle2 v-if="toast.type === 'success'" :size="20" />
            <XCircle v-else :size="20" />
            <span>{{ toast.message }}</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="text-center py-8 border-t border-white/20">
          <h3 class="text-2xl font-bold text-white mb-2">FlashArcPay Nusantara</h3>
          <p class="text-purple-200">Thank you for your payment</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  @page { size: auto; margin: 0; }
  body { background: white !important; color: #000 !important; min-height: auto !important; }
  .min-h-screen { background: white !important; padding: 20px !important; min-height: auto !important; }
  button { display: none !important; }
  .max-w-3xl { max-width: 100% !important; margin: 0 auto !important; }
  .bg-white\/10 { background: white !important; border: 1px solid #e5e7eb !important; }
  .text-white { color: #111827 !important; }
  .text-purple-200 { color: #6b7280 !important; }
}
</style>
