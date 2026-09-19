import { motion } from "framer-motion";
import { Suspense, lazy } from "react";
import { RefreshCw } from "lucide-react";
import { Toaster } from "sonner";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import CommandPalette from "@/components/CommandPalette";
import ErrorBoundary from "@/components/ErrorBoundary";
import Sidebar from "@/components/Sidebar";
import Spotlight from "@/components/Spotlight";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LiveFeedProvider } from "@/context/LiveFeedContext";
import LoginPage from "@/pages/LoginPage";

// Route-level code splitting — only DashboardPage pulls in Chart.js
// (~66KB gzipped, see vendor-charts in the build output), but every page
// used to ship it anyway since react-router doesn't care which Route
// actually renders. A visit straight to /findings or /policies (a
// bookmark, a refresh, a shared link) now skips that download entirely,
// and the initial bundle for the "/" landing case shrinks too, since the
// other four pages' code moves into their own chunks instead of riding
// along in the main one.
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const EvidencePage = lazy(() => import("@/pages/EvidencePage"));
const FindingsPage = lazy(() => import("@/pages/FindingsPage"));
const PolicySimulatorPage = lazy(() => import("@/pages/PolicySimulatorPage"));
const ResourcesPage = lazy(() => import("@/pages/ResourcesPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));

function RouteLoadingFallback() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "40vh", color: "var(--t3)" }}>
      <RefreshCw size={18} className="spin" />
    </div>
  );
}

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
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes location={location}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/findings" element={<FindingsPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/policies" element={<PolicySimulatorPage />} />
          <Route path="/evidence" element={<EvidencePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route
            path="/admin"
            element={
              <RequireRole role="admin">
                <AdminPage />
              </RequireRole>
            }
          />
        </Routes>
      </Suspense>
    </motion.div>
  );
}

/** Blocks rendering the authenticated shell until the initial "is there
 * already a valid token" check resolves — otherwise every fresh page load
 * would flash a redirect to /login before AuthContext has had a chance to
 * confirm the stored token still works. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <RouteLoadingFallback />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/** A viewer hitting an admin-only route (typed URL, stale bookmark) gets
 * bounced to the dashboard rather than a bare 403 — the backend still
 * enforces the real gate on every request either way. */
function RequireRole({ role, children }: { role: "admin"; children: React.ReactNode }) {
  const { hasRole } = useAuth();
  if (!hasRole(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AuthenticatedApp() {
  return (
    <LiveFeedProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <ErrorBoundary>
            <AnimatedRoutes />
          </ErrorBoundary>
        </main>
      </div>
      <CommandPalette />
    </LiveFeedProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="aurora-bg" aria-hidden="true">
        <Spotlight fill="#5b6af0" />
        <Spotlight fill="#1db954" className="spotlight-2" />
      </div>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AuthenticatedApp />
            </RequireAuth>
          }
        />
      </Routes>
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </AuthProvider>
  );
}
