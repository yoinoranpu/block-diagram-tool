import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  // Relative assets work on GitHub Pages under /block-diagram-tool/.
  base: "./",
  plugins: [react()],
  optimizeDeps: { include: ["nerdamer/all.js"] },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("katex")) return "math-display";
        },
      },
    },
  },
});
