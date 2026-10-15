import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { seedDefaults } from "./lib/repo";
import { SyncProvider } from "./sync-context";
import { completeGoogleSignIn } from "./lib/google-auth";
import { supabase } from "./lib/supabase";

// Ask the browser not to evict IndexedDB under storage pressure.
void navigator.storage?.persist?.();

const authError = await completeGoogleSignIn(supabase, window.location.href, (url) => {
  window.history.replaceState(null, "", url);
});
await seedDefaults();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SyncProvider initialAuthError={authError}>
      <App />
    </SyncProvider>
  </StrictMode>,
);
