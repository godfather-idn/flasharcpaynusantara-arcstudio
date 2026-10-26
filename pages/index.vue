<script setup lang="ts">
import { ref } from 'vue'
import { Laptop, ScanLine, History, ChevronRight } from 'lucide-vue-next'

const activeTab = ref<'customer' | 'merchant'>('customer')
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
    <div class="max-w-md w-full">
      <!-- Logo + Title -->
      <div class="text-center mb-8 flex flex-col items-center">
        <img src="~/assets/logo.png" alt="FlashArcPay Logo" class="w-32 h-auto mb-4 drop-shadow-xl" />
        <h1 class="text-3xl font-bold text-white mb-2">FlashArcPay</h1>
        <p class="text-sm text-purple-200 px-4">Indonesian QRIS-Standard Payment on Arc Network</p>
      </div>

      <!-- Tab Switcher -->
      <div class="flex bg-white/10 backdrop-blur-md rounded-xl p-1 mb-8 shadow-lg">
        <button
          @click="activeTab = 'customer'"
          :class="['flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300', activeTab === 'customer' ? 'bg-white text-purple-900 shadow-sm' : 'text-white/70 hover:text-white']"
        >
          Customer
        </button>
        <button
          @click="activeTab = 'merchant'"
          :class="['flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300', activeTab === 'merchant' ? 'bg-white text-purple-900 shadow-sm' : 'text-white/70 hover:text-white']"
        >
          Merchant
        </button>
      </div>

      <div class="space-y-4">
        <!-- Customer Menus -->
        <template v-if="activeTab === 'customer'">
          <NuxtLink to="/scan" class="group flex items-center bg-white/10 backdrop-blur-lg rounded-2xl p-4 hover:bg-white/20 active:scale-[0.98] transition-all duration-300 border border-white/20 shadow-lg hover:shadow-blue-500/20">
            <div class="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center mr-4 shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-md">
              <ScanLine :size="28" class="text-white" />
            </div>
            <div class="flex-1">
              <h2 class="text-xl font-bold text-white mb-1">Scan QR</h2>
              <p class="text-sm text-purple-200">Scan code to pay</p>
            </div>
            <ChevronRight :size="24" class="text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all duration-300" />
          </NuxtLink>

          <NuxtLink to="/customer-history" class="group flex items-center bg-white/10 backdrop-blur-lg rounded-2xl p-4 hover:bg-white/20 active:scale-[0.98] transition-all duration-300 border border-white/20 shadow-lg hover:shadow-orange-500/20">
            <div class="w-14 h-14 bg-orange-500 rounded-xl flex items-center justify-center mr-4 shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-md">
              <History :size="28" class="text-white" />
            </div>
            <div class="flex-1">
              <h2 class="text-xl font-bold text-white mb-1">History</h2>
              <p class="text-sm text-purple-200">Your transactions</p>
            </div>
            <ChevronRight :size="24" class="text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all duration-300" />
          </NuxtLink>
        </template>

        <!-- Merchant Menus -->
        <template v-if="activeTab === 'merchant'">
          <NuxtLink to="/merchant" class="group flex items-center bg-white/10 backdrop-blur-lg rounded-2xl p-4 hover:bg-white/20 active:scale-[0.98] transition-all duration-300 border border-white/20 shadow-lg hover:shadow-purple-500/20">
            <div class="w-14 h-14 bg-purple-500 rounded-xl flex items-center justify-center mr-4 shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-md">
              <Laptop :size="28" class="text-white" />
            </div>
            <div class="flex-1">
              <h2 class="text-xl font-bold text-white mb-1">Merchant POS</h2>
              <p class="text-sm text-purple-200">Create QR code</p>
            </div>
            <ChevronRight :size="24" class="text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all duration-300" />
          </NuxtLink>

          <NuxtLink to="/merchant-history" class="group flex items-center bg-white/10 backdrop-blur-lg rounded-2xl p-4 hover:bg-white/20 active:scale-[0.98] transition-all duration-300 border border-white/20 shadow-lg hover:shadow-green-500/20">
            <div class="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center mr-4 shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-md">
              <History :size="28" class="text-white" />
            </div>
            <div class="flex-1">
              <h2 class="text-xl font-bold text-white mb-1">History</h2>
              <p class="text-sm text-purple-200">Incoming payments</p>
            </div>
            <ChevronRight :size="24" class="text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all duration-300" />
          </NuxtLink>
        </template>
      </div>
    </div>
  </div>
</template>
