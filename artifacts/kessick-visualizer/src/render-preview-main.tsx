import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/error-boundary";
import DealerPortalPreview from "@/pages/portal/preview";
import "./index.css";

document.documentElement.style.colorScheme = "light";
document.body.style.backgroundColor = "#eeedf3";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <DealerPortalPreview />
  </ErrorBoundary>,
);
