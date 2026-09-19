import { motion } from "framer-motion";
import { Lock, LogIn } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import TextGenerateEffect from "@/components/TextGenerateEffect";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname: string } } };

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
      navigate(location.state?.from?.pathname ?? "/", { replace: true });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 401
          ? "Invalid username or password."
          : "Couldn't reach the backend — is it running?"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="glass"
        style={{ width: "100%", maxWidth: 380, padding: "36px 32px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--gradient-brand)",
              boxShadow: "var(--glow-brand)",
              marginBottom: 14,
            }}
          >
            <Lock size={20} color="#fff" />
          </span>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--t1)" }}>
            <TextGenerateEffect text="CloudSecOps" />
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--t3)", margin: "6px 0 0" }}>
            Sign in to the compliance dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11.5, color: "var(--t2)", fontWeight: 600 }}>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              required
              className="login-input"
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11.5, color: "var(--t2)", fontWeight: 600 }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="login-input"
            />
          </label>

          {error && (
            <div
              role="alert"
              style={{
                fontSize: 12,
                color: "var(--danger)",
                background: "rgba(224, 52, 52, 0.08)",
                border: "1px solid rgba(224, 52, 52, 0.3)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 10px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn"
            style={{
              justifyContent: "center",
              height: 38,
              marginTop: 6,
              background: "var(--gradient-brand)",
              border: "none",
              color: "#fff",
              boxShadow: "var(--glow-brand)",
              fontWeight: 600,
            }}
          >
            <LogIn size={14} className={busy ? "spin" : undefined} />
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 20, textAlign: "center" }}>
          Default account: <code>admin</code> / <code>change-me-on-first-login</code>
        </p>
      </motion.div>
    </div>
  );
}
