<script setup lang="ts">
import { ref } from "vue";
import { Smartphone, Shield } from "lucide-vue-next";

const props = defineProps<{
  isOpen: boolean;
  isMobile: boolean;
}>();

const emit = defineEmits<{
  close: [];
  selectWallet: [walletType: string, openInApp: boolean];
}>();

const walletOptions = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    description: "Connect using your MetaMask extension or mobile app",
  },
  {
    id: "walletconnect",
    name: "WalletConnect",
    icon: "🔗",
    description: "Scan QR code with your mobile wallet",
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    icon: "🔵",
    description: "Connect using Coinbase Wallet extension or mobile app",
  },
  {
    id: "binance",
    name: "Binance Wallet",
    icon: "🟡",
    description: "Connect using Binance Web3 Wallet",
  },
];

const handleSelectWallet = (walletType: string) => {
  emit("selectWallet", walletType, true);
  emit("close");
};

const handleClose = () => {
  emit("close");
};

const copyCurrentUrl = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    alert("URL copied! Open MetaMask manually and paste this URL.");
  } catch (err) {
    console.error("Failed to copy URL:", err);
  }
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
        @click="handleClose"
      >
        <div
          class="w-full max-w-lg bg-gradient-to-b from-gray-900 to-gray-800 rounded-t-3xl p-6 shadow-2xl"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-white">Connect Wallet</h2>
            <button
              @click="handleClose"
              class="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- Mobile Info -->
          <div v-if="isMobile" class="bg-white/5 rounded-lg p-3 mb-4">
            <div class="flex items-start gap-2">
              <Smartphone :size="16" class="text-purple-300 mt-0.5" />
              <div class="flex-1">
                <p class="text-white text-sm font-medium">Mobile Connection</p>
                <p class="text-gray-400 text-xs mt-1">
                  Click on MetaMask to open it. If the app does not open, copy this URL and open MetaMask manually.
                </p>
                <button
                  @click="copyCurrentUrl"
                  class="mt-2 text-xs bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 py-1.5 px-3 rounded-md transition-colors"
                >
                  Copy URL
                </button>
              </div>
            </div>
          </div>

          <!-- Wallet Options -->
          <div class="space-y-3 max-h-[60vh] overflow-y-auto">
            <button
              v-for="wallet in walletOptions"
              :key="wallet.id"
              @click="handleSelectWallet(wallet.id)"
              class="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all duration-200 group"
            >
              <div class="w-12 h-12 flex items-center justify-center bg-white/10 rounded-lg text-2xl group-hover:scale-110 transition-transform">
                {{ wallet.icon }}
              </div>
              <div class="flex-1 text-left">
                <h3 class="text-white font-semibold text-lg">{{ wallet.name }}</h3>
                <p class="text-gray-400 text-sm">{{ wallet.description }}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400 group-hover:text-white transition-colors">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          <!-- Footer -->
          <div class="mt-6 pt-4 border-t border-white/10">
            <div class="flex items-start gap-3 text-gray-400 text-sm">
              <Shield :size="16" class="mt-0.5 flex-shrink-0" />
              <p>By connecting your wallet, you agree to the Terms of Service and Privacy Policy.</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active > div > div,
.modal-leave-active > div > div {
  transition: transform 0.3s ease;
}
.modal-enter-from > div > div,
.modal-leave-to > div > div {
  transform: translateY(100%);
}
</style>
