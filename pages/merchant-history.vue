<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ArrowLeft, DollarSign, Calendar, TrendingUp, ExternalLink, RefreshCw, Wallet, Search, X, Filter, Eye, EyeOff } from "lucide-vue-next";

const router = useRouter();
const arc = useArcAppKit();
const history = usePaymentHistory();

const chainId = Number(import.meta.env.VITE_ARC_CHAIN_ID || 5042002);
const isMainnet = computed(() => chainId === 5042);
const networkName = computed(() => isMainnet.value ? "Arc Mainnet" : "Arc Testnet");
const explorerUrl = import.meta.env.VITE_ARC_EXPLORER_URL || "https://explorer.testnet.arc.io";

// State
const loading = ref(false);
const showFilters = ref(false);
const searchQuery = ref("");
const dateFrom = ref("");
const dateTo = ref("");
const hideBalance = ref(false);
const showWalletModal = ref(false);
const isMobileDevice = ref(false);
const connectionError = ref("");
const showInstructions = ref(false);

const isMobileCheck = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

const transactions = computed(() => {
  if (!arc.account.value) return [];
  return history.getPayments(arc.account.value, { type: "merchant" });
});

const filteredTransactions = computed(() => {
  let list = transactions.value;
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(tx =>
      tx.orderId.toLowerCase().includes(q) ||
      (tx.txHash || "").toLowerCase().includes(q)
    );
  }
  if (dateFrom.value) {
    const from = new Date(dateFrom.value).getTime();
    list = list.filter(tx => tx.timestamp >= from);
  }
  if (dateTo.value) {
    const to = new Date(dateTo.value).getTime() + 86400000;
    list = list.filter(tx => tx.timestamp <= to);
  }
  return list;
});

const stats = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const all = filteredTransactions.value;
  const total = all.reduce((sum, tx) => sum + BigInt(tx.amount), 0n);
  const todayTxs = all.filter(tx => tx.timestamp >= todayMs);
  const todayTotal = todayTxs.reduce((sum, tx) => sum + BigInt(tx.amount), 0n);
  return { total, today: todayTotal, count: all.length, todayCount: todayTxs.length };
});

const formatUSDC = (amount: bigint) => {
  return (Number(amount) / 1_000_000).toFixed(2);
};

const formatAddress = (addr: string) => {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const formatTimestamp = (ts: number) => {
  return new Date(ts).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const clearFilters = () => {
  searchQuery.value = "";
  dateFrom.value = "";
  dateTo.value = "";
};

const viewReceipt = (tx: ReturnType<typeof history.getPayments>[0]) => {
  const params = new URLSearchParams({
    txHash: tx.txHash || "",
    orderId: tx.orderId || "",
    merchant: tx.merchant || "",
    payer: tx.payer || "",
    amount: tx.amount || "0",
  });
  router.push(`/receipt?${params.toString()}`);
};

const handleWalletSelect = async () => {
  showWalletModal.value = false;
  loading.value = true;
  try {
    await arc.connectWallet();
  } catch (e: any) {
    connectionError.value = e.message || "Failed to connect wallet";
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  isMobileDevice.value = isMobileCheck();
  await arc.checkConnection();
});
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 pb-8">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6 mt-4">
        <button @click="router.push('/merchant')" class="flex items-center gap-2 text-white hover:text-purple-200 transition-colors text-lg">
          <ArrowLeft :size="24" />
          <span class="font-medium">Back</span>
        </button>
        <h1 class="text-2xl font-bold text-white">Merchant History</h1>
        <div class="flex items-center gap-2">
          <button @click="hideBalance = !hideBalance" class="p-2 text-white hover:bg-white/10 rounded-lg transition-colors" :title="hideBalance ? 'Show balances' : 'Hide balances'">
            <Eye v-if="hideBalance" :size="20" />
            <EyeOff v-else :size="20" />
          </button>
          <button @click="loading = true; arc.fetchBalance().finally(() => loading = false)" class="p-2 text-white hover:bg-white/10 rounded-lg transition-colors" title="Refresh">
            <RefreshCw :size="20" :class="{ 'animate-spin': loading }" />
          </button>
        </div>
      </div>

      <!-- Connection Status -->
      <div class="bg-white/10 backdrop-blur-lg rounded-xl p-4 mb-6 border border-white/20">
        <div v-if="arc.isConnected.value" class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-3 h-3 rounded-full bg-green-500" style="box-shadow: 0 0 8px #22c55e"></div>
            <span class="text-white font-medium">Connected</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs bg-purple-600/50 border border-purple-400/50 px-2 py-1 rounded-md text-white">{{ networkName }}</span>
            <span class="text-white text-sm font-mono">{{ formatAddress(arc.account.value || "") }}</span>
          </div>
        </div>
        <div v-else class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-3 h-3 rounded-full bg-red-500" style="box-shadow: 0 0 8px #ef4444"></div>
            <span class="text-white font-medium">Not Connected</span>
          </div>
          <button @click="showWalletModal = true" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition-colors flex items-center gap-2 text-xs">
            <Wallet :size="14" />
            Connect Wallet
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div v-if="arc.isConnected.value" class="bg-white/10 backdrop-blur-lg rounded-xl p-4 mb-6 border border-white/20">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <Filter :size="20" />
            Filters
          </h3>
          <button @click="showFilters = !showFilters" class="text-purple-200 hover:text-white transition-colors">
            {{ showFilters ? 'Hide' : 'Show' }}
          </button>
        </div>
        <div v-if="showFilters" class="space-y-4">
          <div class="flex gap-2">
            <div class="flex-1 relative">
              <Search :size="20" class="absolute left-3 top-1/2 -translate-y-1/2 text-purple-300" />
              <input v-model="searchQuery" type="text" placeholder="Search by Order ID or Tx Hash" class="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <button v-if="searchQuery" @click="searchQuery = ''" class="text-purple-400 hover:text-white transition-colors">
              <X :size="20" />
            </button>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-purple-200 text-sm mb-1">From Date</label>
              <input v-model="dateFrom" type="date" class="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label class="block text-purple-200 text-sm mb-1">To Date</label>
              <input v-model="dateTo" type="date" class="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          <button @click="clearFilters" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Clear All Filters</button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div v-if="arc.isConnected.value" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur-lg rounded-xl p-6 border border-green-500/30">
          <div class="flex items-center gap-3 mb-2">
            <DollarSign :size="24" class="text-green-400" />
            <span class="text-green-200 text-sm font-medium">Total Received</span>
          </div>
          <p class="text-3xl font-bold text-white">{{ hideBalance ? '••••' : formatUSDC(stats.total) }} USDC</p>
        </div>
        <div class="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-lg rounded-xl p-6 border border-blue-500/30">
          <div class="flex items-center gap-3 mb-2">
            <Calendar :size="24" class="text-blue-400" />
            <span class="text-blue-200 text-sm font-medium">Today's Received</span>
          </div>
          <p class="text-3xl font-bold text-white">{{ hideBalance ? '••••' : formatUSDC(stats.today) }} USDC</p>
        </div>
        <div class="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-lg rounded-xl p-6 border border-purple-500/30">
          <div class="flex items-center gap-3 mb-2">
            <TrendingUp :size="24" class="text-purple-400" />
            <span class="text-purple-200 text-sm font-medium">Total Transactions</span>
          </div>
          <p class="text-3xl font-bold text-white">{{ stats.count }}</p>
        </div>
        <div class="bg-gradient-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-lg rounded-xl p-6 border border-orange-500/30">
          <div class="flex items-center gap-3 mb-2">
            <Calendar :size="24" class="text-orange-400" />
            <span class="text-orange-200 text-sm font-medium">Today's Transactions</span>
          </div>
          <p class="text-3xl font-bold text-white">{{ stats.todayCount }}</p>
        </div>
      </div>

      <!-- Transaction Table -->
      <div v-if="arc.isConnected.value && filteredTransactions.length > 0" class="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
        <div class="p-6 border-b border-white/20">
          <h2 class="text-xl font-bold text-white">
            Recent Transactions
            <span v-if="filteredTransactions.length !== transactions.length" class="text-purple-200 text-sm ml-2">
              ({{ filteredTransactions.length }} of {{ transactions.length }})
            </span>
          </h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-white/5">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-purple-200 uppercase tracking-wider">Order ID</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-purple-200 uppercase tracking-wider">Amount</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-purple-200 uppercase tracking-wider">Payer</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-purple-200 uppercase tracking-wider">Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-purple-200 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-purple-200 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/10">
              <tr v-for="tx in filteredTransactions" :key="tx.id" class="hover:bg-white/5 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-white">{{ tx.orderId }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">{{ history.formatAmount(tx.amount) }} USDC</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-purple-200">{{ formatAddress(tx.payer || tx.merchant || "") }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-purple-200">{{ formatTimestamp(tx.timestamp) }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="tx.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                    {{ tx.status === 'success' ? 'Success' : tx.status }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <button v-if="tx.txHash" @click="viewReceipt(tx)" class="text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1">
                    <ExternalLink :size="16" />
                    View Receipt
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="arc.isConnected.value && filteredTransactions.length === 0" class="bg-white/10 backdrop-blur-lg rounded-xl p-12 border border-white/20 text-center">
        <DollarSign :size="48" class="text-purple-400 mx-auto mb-4" />
        <h3 class="text-xl font-bold text-white mb-2">No Payments Found</h3>
        <p class="text-purple-200">{{ transactions.length === 0 ? 'Start accepting payments to see your transaction history here.' : 'Try adjusting your filters to see more transactions.' }}</p>
      </div>

      <!-- Not Connected -->
      <div v-else-if="!arc.isConnected.value" class="bg-white/10 backdrop-blur-lg rounded-xl p-12 border border-white/20 text-center">
        <Wallet :size="48" class="text-purple-400 mx-auto mb-4" />
        <h3 class="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
        <p class="text-purple-200">Connect your wallet to view your payment history.</p>
      </div>
    </div>

    <WalletConnectModal
      :is-open="showWalletModal"
      :is-mobile="isMobileDevice"
      @close="showWalletModal = false"
      @select-wallet="handleWalletSelect"
    />
  </div>
</template>
