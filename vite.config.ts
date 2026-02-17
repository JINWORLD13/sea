import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    /* proxy: {
      "/ais": {
        target: "wss://stream.aisstream.io/v0/stream",
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ais/, ""),
      },
    }, */
  },
});
