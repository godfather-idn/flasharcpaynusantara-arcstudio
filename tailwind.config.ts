import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

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
          "0%": { top: "0%", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { top: "100%", opacity: "0" },
        },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        modalSlideUp: {
          from: { transform: "translateY(100%)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        scan: "scan 2.5s ease-in-out infinite",
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
        "modal-slide-up": "modalSlideUp 0.3s ease-out forwards",
      },
      backgroundImage: {
        "app-gradient": "linear-gradient(135deg, #4c1d95 0%, #1e3a8a 50%, #312e81 100%)",
      },
    },
  },
  plugins: [
    plugin(({ addBase, addUtilities }) => {
      addBase({
        html: {
          fontFamily:
            '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      });
      addUtilities({
        ".animate-scan": {
          animation: "scan 2.5s ease-in-out infinite",
        },
        ".bg-app": {
          background: "linear-gradient(135deg, #4c1d95 0%, #1e3a8a 50%, #312e81 100%)",
        },
        ".glass-card": {
          background: "rgba(255,255,255,0.10)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.20)",
        },
      });
    }),
  ],
} satisfies Config;
