import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.includes("node_modules/jspdf") || id.includes("node_modules/jszip") || id.includes("node_modules/qrcode")) {
            return "print-tools";
          }
          if (id.includes("node_modules/solid-js")) {
            return "solid-vendor";
          }
          return undefined;
        },
      },
    },
  },
});
