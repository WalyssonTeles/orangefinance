import { defineConfig, minimal2023Preset as preset } from "@vite-pwa/assets-generator/config";

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: { background: "#FBF7F4" } },
    apple: { ...preset.apple, resizeOptions: { background: "#FFF8F0" } },
  },
  images: ["public/favicon.svg"],
});
