<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 flex flex-col">
    <!-- Hero -->
    <div class="flex-1 flex flex-col items-center justify-center px-4 py-16">
      <!-- Glass card -->
      <div class="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 max-w-lg w-full text-white shadow-2xl">
        <!-- Logo + title -->
        <div class="flex items-center justify-center gap-3 mb-4">
          <span class="text-4xl">⚡</span>
          <div>
            <h1 class="text-3xl font-bold leading-tight">FlashArcPay</h1>
            <p class="text-sm font-semibold tracking-widest text-blue-200 uppercase">Nusantara</p>
          </div>
        </div>
        <p class="text-center text-white/80 text-sm mb-8 leading-relaxed">
          Indonesian QRIS-Standard Payment Experience<br />
          Built Native on Arc Network via Circle Arc App Kit
        </p>

        <!-- Feature cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <div
            v-for="feature in features"
            :key="feature.title"
            class="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            <div class="text-2xl mb-1">{{ feature.icon }}</div>
            <div class="font-semibold text-sm">{{ feature.title }}</div>
            <div class="text-xs text-white/70 mt-1">{{ feature.desc }}</div>
          </div>
        </div>

        <!-- CTA buttons -->
        <div class="flex flex-col gap-3">
          <NuxtLink
            to="/merchant"
            class="bg-white text-blue-700 font-bold rounded-xl py-4 text-center text-lg hover:bg-blue-50 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            🏪 Start as Merchant
          </NuxtLink>
          <NuxtLink
            to="/scan"
            class="bg-white/20 border-2 border-white/40 text-white font-bold rounded-xl py-4 text-center text-lg hover:bg-white/30 transition-all duration-200"
          >
            📷 Scan to Pay
          </NuxtLink>
        </div>
      </div>

      <!-- Stats row -->
      <div class="flex gap-6 mt-8 text-white/70 text-sm">
        <div class="text-center">
          <div class="font-bold text-white text-xl">6</div>
          <div>Decimals</div>
        </div>
        <div class="text-center">
          <div class="font-bold text-white text-xl">&lt;2s</div>
          <div>Settlement</div>
        </div>
        <div class="text-center">
          <div class="font-bold text-white text-xl">0</div>
          <div>Token Friction</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="text-center py-4 text-white/50 text-xs">
      Built with ❤️ for the Arc Network ecosystem &nbsp;·&nbsp;
      <NuxtLink to="/merchant-history" class="hover:text-white/80 underline">Merchant History</NuxtLink>
      &nbsp;·&nbsp;
      <NuxtLink to="/customer-history" class="hover:text-white/80 underline">My Payments</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const features = [
  { icon: "⚡", title: "Instant Payments", desc: "Sub-2s onchain settlement" },
  { icon: "🌉", title: "Cross-Chain", desc: "Unified USDC liquidity" },
  { icon: "✅", title: "Zero Friction", desc: "USDC IS the gas token" },
];
</script>
