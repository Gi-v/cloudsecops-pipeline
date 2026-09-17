import { motion } from "framer-motion";
import { Toaster } from "sonner";
import { Route, Routes, useLocation } from "react-router-dom";
import CommandPalette from "@/components/CommandPalette";
import ErrorBoundary from "@/components/ErrorBoundary";
import Sidebar from "@/components/Sidebar";
import Spotlight from "@/components/Spotlight";
import { LiveFeedProvider } from "@/context/LiveFeedContext";
import DashboardPage from "@/pages/DashboardPage";
import EvidencePage from "@/pages/EvidencePage";
import FindingsPage from "@/pages/FindingsPage";
import PolicySimulatorPage from "@/pages/PolicySimulatorPage";
import ResourcesPage from "@/pages/ResourcesPage";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    // Enter-only fade (no `exit`) — this used to be wrapped in
    // <AnimatePresence mode="wait"> for a proper cross-fade between routes,
    // but AnimatePresence's exit-completion tracking never resolves on the
    // framer-motion + React 19 + react-router-dom v7 combination this
    // project is now on (reproduced identically on framer-motion 12.43.0
    // and 13.4.0): the exit animation visually finishes — computed opacity
    // reaches 0 — but AnimatePresence never unmounts the old child or mounts
    // the new one, so every navigation after the first got stuck showing
    // the previous page forever. Keying this motion.div by pathname still
    // gets React to swap Route content immediately (that's plain React
    // reconciliation, unrelated to AnimatePresence) and still fades each
    // new page in — it just no longer waits on a fade-out that wasn't
    // completing anyway.
    <motion.div
      key={location.pathname}
      className="page-fade"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14, ease: "easeOut" }}
    >
      <Routes location={location}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/findings" element={<FindingsPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/policies" element={<PolicySimulatorPage />} />
        <Route path="/evidence" element={<EvidencePage />} />
      </Routes>
    </motion.div>
  );
}

export default function App() {
  return (
    <LiveFeedProvider>
      <div className="aurora-bg" aria-hidden="true">
        <Spotlight fill="#5b6af0" />
        <Spotlight fill="#1db954" className="spotlight-2" />
      </div>
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <ErrorBoundary>
            <AnimatedRoutes />
          </ErrorBoundary>
        </main>
      </div>

      <CommandPalette />
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </LiveFeedProvider>
  );
}
