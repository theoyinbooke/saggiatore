import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ModelRegistryProvider } from "@/components/ModelRegistryProvider";

import "./index.css";
import App from "./App.tsx";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

function Root() {
  const app = (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );

  // Clerk + Convex (both keys set)
  if (convex && clerkPubKey) {
    return (
      <ClerkProvider publishableKey={clerkPubKey}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ModelRegistryProvider>{app}</ModelRegistryProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    );
  }

  // Convex only (dev mode, no Clerk)
  if (convex) {
    return (
      <ConvexProvider client={convex}>
        <ModelRegistryProvider>{app}</ModelRegistryProvider>
      </ConvexProvider>
    );
  }

  // No backend (mock data mode)
  return <ModelRegistryProvider>{app}</ModelRegistryProvider>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
