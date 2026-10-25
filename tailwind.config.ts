import type { Config } from "tailwindcss";

export default {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue",
  ],
  theme: {
    extend: {
      colors: {
        arc: {
          blue: "#3B82F6",
          dark: "#1D4ED8",
        },
      },
      keyframes: {
        scan: {
          "0%, 100%": { top: "0%" },
          "50%": { top: "calc(100% - 4px)" },
        },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        scan: "scan 2s linear infinite",
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
      },
    },
  },
  plugins: [],
} satisfies Config;
