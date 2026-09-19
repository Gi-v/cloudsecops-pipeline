import { createContext, useContext, useEffect, useState } from "react";
import { clearToken, endpoints, setToken } from "@/api/client";
import type { User, UserRole } from "@/types";

interface AuthContextValue {
  user: User | null;
  /** True only while the initial "is there already a valid token" check is
   * in flight on first load — lets RequireAuth avoid a flash-redirect to
   * /login before that check has had a chance to resolve. */
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  hasRole: () => false,
});

/** Owns the logged-in user's profile, mirroring LiveFeedContext's pattern of
 * one provider at the app root instead of every consumer re-deriving auth
 * state. The JWT itself lives in localStorage (see api/client.ts); this
 * context is what turns "a token exists" into "here's who's logged in." */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    endpoints
      .getCurrentUser()
      .then((res) => setUser(res.data))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const res = await endpoints.login(username, password);
    setToken(res.data.access_token);
    const me = await endpoints.getCurrentUser();
    setUser(me.data);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  function hasRole(...roles: UserRole[]) {
    return user !== null && roles.includes(user.role);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
