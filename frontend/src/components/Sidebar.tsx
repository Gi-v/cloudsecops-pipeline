import {
  BarChart3,
  Bell,
  ExternalLink,
  FileSearch,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  ServerCog,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLiveFeedContext } from "@/context/LiveFeedContext";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/findings", label: "Findings", icon: ShieldCheck },
  { to: "/resources", label: "Resources", icon: ServerCog },
  { to: "/policies", label: "Policy Simulator", icon: FileSearch },
  { to: "/evidence", label: "Evidence Chain", icon: FileSearch },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

/** Hexagon + dot brand mark — hex is a common security-iconography motif.
 * Drawn as a plain outline (no fill) so it reads as a mark, not a filled
 * icon tile. */
function LogoMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polygon
        points="8,1 14.2,4.5 14.2,11.5 8,15 1.8,11.5 1.8,4.5"
        stroke="var(--t1)"
        strokeWidth="1.5"
      />
      <circle cx="8" cy="8" r="2" fill="var(--t1)" />
    </svg>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { connected, alertCounts, clearAlertCounts } = useLiveFeedContext();
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const totalAlerts = alertCounts.critical + alertCounts.high;
  const navItems = hasRole("admin")
    ? [...NAV_ITEMS, { to: "/admin", label: "Admin", icon: Users }]
    : NAV_ITEMS;
  const grafanaUrl = import.meta.env.VITE_GRAFANA_URL;

  function handleLogout() {
    // No explicit navigate() here: clearing `user` makes App.tsx's
    // RequireAuth redirect to /login on its own next render. A second,
    // separate navigate("/login") call here used to race that redirect —
    // whichever one's `location.state.from` won determined where the next
    // login landed, nondeterministically.
    logout();
    setMobileOpen(false);
  }

  function openAlerts() {
    clearAlertCounts();
    // Prefer surfacing CRITICAL if any are open; fall back to HIGH so a
    // HIGH-only spike (no criticals) still routes somewhere meaningful
    // instead of always defaulting to a severity with nothing to show.
    const severity = alertCounts.critical > 0 ? "CRITICAL" : "HIGH";
    navigate(`/findings?severity=${severity}`);
    setMobileOpen(false);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-mark">
          <LogoMark />
        </span>
        <span className="sidebar-logo-text">CloudSecOps</span>
        <button
          className="icon-btn"
          onClick={openAlerts}
          aria-label={`${totalAlerts} alerts (${alertCounts.critical} critical, ${alertCounts.high} high)`}
          title={`${alertCounts.critical} critical, ${alertCounts.high} high`}
          style={{ position: "relative", width: 28, height: 28 }}
        >
          <Bell size={14} />
          {totalAlerts > 0 && (
            <span
              className="notif-badge"
              style={{ animation: "cs-badge-pop 300ms cubic-bezier(0.34,1.56,0.64,1) forwards" }}
            >
              {totalAlerts > 9 ? "9+" : totalAlerts}
            </span>
          )}
        </button>
        <button
          className="icon-btn sidebar-ham"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      <div className="sidebar-live-strip">
        <span className={`sidebar-live-dot${connected ? " connected" : ""}`} />
        <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--t3)" }}>
          {connected ? "Live" : "Offline"}
        </span>
      </div>

      <nav className={`sidebar-nav${mobileOpen ? " open" : ""}`}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
          >
            <item.icon size={14} strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        {grafanaUrl && (
          <a
            href={grafanaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-link"
            onClick={() => setMobileOpen(false)}
          >
            <Gauge size={14} strokeWidth={2} />
            <span>Grafana</span>
            <ExternalLink size={11} style={{ marginLeft: "auto", opacity: 0.55 }} />
          </a>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="sidebar-user-avatar">
            {(user?.username ?? "?").slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="sidebar-user-name">{user?.username}</div>
            <div className="sidebar-user-role">{user?.role === "admin" ? "Administrator" : "Viewer"}</div>
          </div>
        </div>
        <button
          className="icon-btn"
          onClick={handleLogout}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}
