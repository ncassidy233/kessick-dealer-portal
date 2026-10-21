import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/error-boundary";
import DealerPortalPreview from "@/pages/portal/preview";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <DealerPortalPreview />
  </ErrorBoundary>,
);

// Lets browsers install the portal as an app. Skipped where service workers
// aren't allowed, such as inside an embedded preview.
if ("serviceWorker" in navigator && window.isSecureContext && window.self === window.top) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
