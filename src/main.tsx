import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { seedDefaults } from "./lib/repo";

// Ask the browser not to evict IndexedDB under storage pressure.
void navigator.storage?.persist?.();

await seedDefaults();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
