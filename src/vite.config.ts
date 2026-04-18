import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes("react-dom") || (id.includes("node_modules/react/") && !id.includes("react-i18next") && !id.includes("react-markdown"))) return "react";
          if (id.includes("react-i18next") || id.includes("node_modules/i18next")) return "react-i18n";
          if (id.includes("@radix-ui/react-accordion") || id.includes("@radix-ui/react-dialog") || id.includes("@radix-ui/react-select") || id.includes("@radix-ui/react-scroll-area")) return "ui";
          if (id.includes("recharts")) return "charts";
          if (id.includes("react-markdown")) return "markdown";
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}));
