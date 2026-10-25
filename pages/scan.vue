<template>
  <div class="relative w-full h-screen bg-black overflow-hidden">
    <!-- Camera view -->
    <video
      ref="videoEl"
      class="absolute inset-0 w-full h-full object-cover"
      playsinline
      muted
    />

    <!-- Overlay -->
    <div class="absolute inset-0 flex flex-col">
      <!-- Top bar -->
      <div class="flex items-center justify-between px-4 pt-safe pt-6 pb-4 bg-gradient-to-b from-black/70 to-transparent">
        <NuxtLink to="/" class="text-white font-medium flex items-center gap-1">
          ← Back
        </NuxtLink>
        <span class="text-white font-bold text-lg">Scan QR Code</span>
        <button
          v-if="torchSupported"
          @click="toggleTorch"
          class="text-white text-xl"
        >
          {{ torchOn ? "🔦" : "💡" }}
        </button>
        <div v-else class="w-8" />
      </div>

      <!-- Scan frame -->
      <div class="flex-1 flex items-center justify-center">
        <div class="relative w-64 h-64">
          <!-- Corner markers -->
          <div class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
          <div class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
          <div class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
          <div class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />

          <!-- Scanning line -->
          <div
            v-if="scanning"
            class="absolute left-0 right-0 h-0.5 bg-blue-400 shadow-[0_0_8px_2px_rgba(96,165,250,0.8)]"
            :style="{ top: scanLinePos + '%' }"
          />
        </div>
      </div>

      <!-- Bottom bar -->
      <div class="px-4 pb-10 bg-gradient-to-t from-black/70 to-transparent">
        <p class="text-white/80 text-sm text-center mb-4">
          {{ statusMessage }}
        </p>

        <!-- Camera error fallback -->
        <div v-if="cameraError" class="bg-red-900/70 border border-red-500 rounded-xl p-4 mb-4">
          <div class="text-white text-sm text-center">{{ cameraError }}</div>
        </div>

        <!-- Manual input toggle -->
        <button
          @click="showManual = !showManual"
          class="w-full bg-white/20 border border-white/30 text-white rounded-xl py-3 font-medium hover:bg-white/30 transition mb-3"
        >
          ✏️ Enter Code Manually
        </button>

        <!-- Manual input -->
        <div v-if="showManual" class="bg-black/80 rounded-xl p-4 space-y-3">
          <input
            v-model="manualUrl"
            type="url"
            placeholder="Paste payment URL…"
            class="w-full bg-white/10 border border-white/20 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
          />
          <button
            @click="processManualUrl"
            :disabled="!manualUrl"
            class="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold disabled:opacity-40"
          >
            Go to Payment →
          </button>
          <div v-if="manualError" class="text-red-400 text-sm text-center">{{ manualError }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter();
const videoEl = ref<HTMLVideoElement | null>(null);

const scanning = ref(false);
const cameraError = ref("");
const statusMessage = ref("Point camera at a FlashArcPay QR code");
const showManual = ref(false);
const manualUrl = ref("");
const manualError = ref("");
const torchSupported = ref(false);
const torchOn = ref(false);
const scanLinePos = ref(0);

let animFrame: number | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;
let stream: MediaStream | null = null;
// ZXing reader is lazily imported in startCamera
let _readerRef: { decodeFromCanvas: (c: HTMLCanvasElement) => { getText: () => string } } | null = null;

// Animate scan line
const animateScanLine = () => {
  let direction = 1;
  scanInterval = setInterval(() => {
    scanLinePos.value += direction * 2;
    if (scanLinePos.value >= 98) direction = -1;
    if (scanLinePos.value <= 2) direction = 1;
  }, 20);
};

const stopCamera = () => {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (scanInterval) clearInterval(scanInterval);
  if (animFrame) cancelAnimationFrame(animFrame);
  scanning.value = false;
};

const parsePaymentUrl = (urlStr: string): string | null => {
  try {
    const url = new URL(urlStr);
    const merchant = url.searchParams.get("merchant");
    const amount = url.searchParams.get("amount");
    const orderId = url.searchParams.get("orderId");
    if (
      !merchant ||
      !amount ||
      !orderId ||
      !/^0x[0-9a-fA-F]{40}$/.test(merchant)
    )
      return null;
    return `/pay?merchant=${merchant}&amount=${amount}&orderId=${encodeURIComponent(orderId)}`;
  } catch {
    return null;
  }
};

const processResult = (text: string) => {
  stopCamera();
  const path = parsePaymentUrl(text);
  if (path) {
    statusMessage.value = "QR detected! Redirecting…";
    router.push(path);
  } else {
    cameraError.value = "QR code is not a valid FlashArcPay payment link.";
    scanning.value = false;
  }
};

const processManualUrl = () => {
  manualError.value = "";
  const path = parsePaymentUrl(manualUrl.value);
  if (path) {
    stopCamera();
    router.push(path);
  } else {
    manualError.value = "Invalid payment URL. Please check and try again.";
  }
};

const toggleTorch = async () => {
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  if (!track) return;
  try {
    await (track as unknown as { applyConstraints: (c: unknown) => Promise<void> })
      .applyConstraints({ advanced: [{ torch: !torchOn.value }] });
    torchOn.value = !torchOn.value;
  } catch {
    /* torch not supported */
  }
};

const startCamera = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });

    if (videoEl.value) {
      videoEl.value.srcObject = stream;
      await videoEl.value.play();
    }

    scanning.value = true;
    animateScanLine();

    // Check torch support
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
    torchSupported.value = !!capabilities?.torch;

    // Lazy-load ZXing
    const ZXing = await import("@zxing/library");
    const reader = new ZXing.BrowserQRCodeReader();
    _readerRef = reader as unknown as typeof _readerRef;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx || !videoEl.value) return;

    const video = videoEl.value;

    const scan = () => {
      if (!scanning.value) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          // decodeFromCanvas is the stable API in @zxing/library 0.21
          const result = (reader as unknown as { decodeFromCanvas: (c: HTMLCanvasElement) => { getText: () => string } }).decodeFromCanvas(canvas);
          if (result) processResult(result.getText());
        } catch {
          /* no QR yet — thrown when nothing is decoded */
        }
      }
      animFrame = requestAnimationFrame(scan);
    };
    animFrame = requestAnimationFrame(scan);
  } catch (e) {
    cameraError.value =
      e instanceof Error && e.name === "NotAllowedError"
        ? "Camera access denied. Please allow camera permission and reload."
        : "Unable to access camera. Use manual input instead.";
    showManual.value = true;
  }
};

onMounted(() => {
  // Only run in browser (SPA mode)
  startCamera();
});

onUnmounted(stopCamera);
</script>
