<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
        <NuxtLink to="/" class="text-gray-500 hover:text-gray-800">← Back</NuxtLink>
        <h1 class="text-xl font-bold text-gray-900 flex-1 text-center">My Payments</h1>
        <select v-model="filter" class="text-sm border border-gray-200 rounded-lg px-2 py-1">
          <option value="">All</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>
    </header>

    <div class="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div v-if="!arc.isConnected.value" class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
        <p class="text-gray-500 mb-4">Connect your wallet to view payment history</p>
        <button
          @click="arc.connectWallet"
          :disabled="arc.isLoading.value"
          class="bg-blue-600 text-white rounded-lg px-6 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {{ arc.isLoading.value ? "Connecting…" : "Connect Wallet" }}
        </button>
      </div>

      <template v-else>
        <!-- Stats -->
        <div class="grid grid-cols-3 gap-3">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-blue-700">{{ stats.count }}</div>
            <div class="text-xs text-blue-600 mt-1">Payments Made</div>
          </div>
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-red-600">{{ stats.total }}</div>
            <div class="text-xs text-red-500 mt-1">USDC Spent</div>
          </div>
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-purple-700">{{ stats.avg }}</div>
            <div class="text-xs text-purple-600 mt-1">Avg Amount</div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="records.length === 0" class="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <div class="text-5xl mb-3">📱</div>
          <div class="font-semibold text-gray-700">No payments yet</div>
          <div class="text-gray-400 text-sm mt-1">Scan a merchant QR code to make your first payment</div>
          <NuxtLink to="/scan" class="inline-block mt-4 bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-semibold hover:bg-blue-700">
            Scan to Pay
          </NuxtLink>
        </div>

        <!-- Records -->
        <div v-else class="space-y-3">
          <div
            v-for="record in records"
            :key="record.id"
            class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition cursor-pointer"
            @click="record.txHash && openExplorer(record.txHash)"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-mono text-sm text-gray-800 truncate">{{ record.orderId }}</span>
                  <span :class="badgeClass(record.status)" class="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0">
                    {{ record.status }}
                  </span>
                </div>
                <div class="text-xs text-gray-500">To: {{ shortAddress(record.merchant) }}</div>
                <div class="text-xs text-gray-400 mt-0.5">{{ formatDate(record.timestamp) }}</div>
                <div v-if="record.txHash" class="text-xs text-blue-500 mt-0.5 font-mono">
                  Tx: {{ shortHash(record.txHash) }}
                </div>
              </div>
              <div class="text-right ml-3">
                <div class="font-bold text-gray-900">{{ history.formatAmount(record.amount) }}</div>
                <div class="text-xs text-gray-500">USDC</div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const arc = useArcAppKit();
const history = usePaymentHistory();

const filter = ref("");

const records = computed(() => {
  if (!arc.account.value) return [];
  return history.getPayments(arc.account.value, {
    type: "customer",
    status: filter.value || undefined,
  });
});

const stats = computed(() => {
  if (!arc.account.value) return { count: 0, total: "0.00", avg: "0.00" };
  const all = history.getPayments(arc.account.value, { type: "customer" });
  const succeeded = all.filter((r) => r.status === "success");
  const totalRaw = succeeded.reduce((sum, r) => sum + BigInt(r.amount), 0n);
  const avg =
    succeeded.length > 0 ? totalRaw / BigInt(succeeded.length) : 0n;
  return {
    count: all.length,
    total: history.formatAmount(totalRaw.toString()),
    avg: history.formatAmount(avg.toString()),
  };
});

const badgeClass = (status: string) => {
  if (status === "success") return "bg-green-100 text-green-800";
  if (status === "pending") return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
};

const shortAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
const shortHash = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-6)}`;

const formatDate = (ts: number) =>
  new Date(ts).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const openExplorer = (txHash: string) => {
  window.open(`https://explorer.testnet.arc.io/tx/${txHash}`, "_blank");
};
</script>
