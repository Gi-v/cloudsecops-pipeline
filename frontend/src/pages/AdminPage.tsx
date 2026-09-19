import { motion } from "framer-motion";
import { Plus, Users } from "lucide-react";
import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { toast } from "sonner";
import { endpoints } from "@/api/client";
import EmptyState from "@/components/EmptyState";
import { TableRowSkeleton } from "@/components/Skeleton";
import TextGenerateEffect from "@/components/TextGenerateEffect";
import { useAsync } from "@/hooks/useAsync";
import type { User, UserRole } from "@/types";

/** Admin-only (see App.tsx's RequireRole and the backend's matching
 * require_role("admin") gate on every /auth/users endpoint) — user
 * management for the JWT login system introduced alongside this page. */
export default function AdminPage() {
  const { data: users, loading, reload } = useAsync<User[]>(
    () => endpoints.listUsers().then((r) => r.data),
    [],
  );

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await endpoints.createUser({ username, email, password, role });
      toast.success(`User "${username}" created`);
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("viewer");
      reload();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(status === 409 ? "That username is already taken." : "Couldn't create the user.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    try {
      await endpoints.updateUserRole(userId, newRole);
      toast.success("Role updated");
      reload();
    } catch {
      toast.error("Couldn't update role.");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title-row">
          <span className="page-title-icon" style={{ "--page-accent": "var(--brand)" } as CSSProperties}>
            <Users size={18} />
          </span>
          <div>
            <h1 className="page-title">
              <TextGenerateEffect text="Admin" />
            </h1>
            <p className="page-sub">Manage who can sign in and what they can do.</p>
          </div>
        </div>
      </div>

      <div className="glass" style={{ padding: 20, marginBottom: 20 }}>
        <div className="chart-label">Create user</div>
        <form
          onSubmit={handleCreate}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 10 }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--t2)" }}>Username</span>
            <input
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--t2)" }}>Email</span>
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--t2)" }}>Password</span>
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--t2)" }}>Role</span>
            <select
              className="status-select"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              aria-label="New user role"
            >
              <option value="viewer">viewer</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <button type="submit" className="btn" disabled={creating} style={{ height: 36 }}>
            <Plus size={14} /> {creating ? "Creating…" : "Create"}
          </button>
        </form>
      </div>

      <div className="glass table-wrap" style={{ padding: 16 }}>
        {loading ? (
          <table>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={4} />
              ))}
            </tbody>
          </table>
        ) : !users || users.length === 0 ? (
          <EmptyState icon={Users} title="No users yet" subtitle="Create the first account above." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td style={{ color: "var(--t1)" }}>{u.username}</td>
                  <td style={{ color: "var(--t3)" }}>{u.email}</td>
                  <td>
                    <select
                      className="status-select"
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      aria-label={`Role for ${u.username}`}
                    >
                      <option value="viewer">viewer</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td style={{ color: "var(--t3)", fontSize: 12 }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
