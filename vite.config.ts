/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json" with { type: "json" };

// IndexedDB is scoped per origin (including port): dev and preview share one port
// so the data typed in either mode is the same.
const PORT = 5180;

export default defineConfig(({ mode }) => ({
  base: mode === "github-pages" ? "/orangefinance/" : "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["orange-finance-symbol.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Orange Finance",
        short_name: "Orange Finance",
        description: "Suas finanças, de forma simples.",
        lang: "pt-BR",
        id: "./",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#FBF7F4",
        theme_color: "#FBF7F4",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: PORT, strictPort: true },
  preview: { port: PORT, strictPort: true },
  test: { environment: "node" },
}));
