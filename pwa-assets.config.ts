import { defineConfig, minimal2023Preset as preset } from "@vite-pwa/assets-generator/config";

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...preset,
    transparent: { ...preset.transparent, padding: 0 },
    maskable: { ...preset.maskable, padding: 0, resizeOptions: { background: "#FF7A1A" } },
    apple: { ...preset.apple, padding: 0, resizeOptions: { background: "#FF7A1A" } },
  },
  images: ["public/orange-finance-icon.svg"],
});
