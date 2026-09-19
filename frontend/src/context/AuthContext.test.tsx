import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { endpoints } from "@/api/client";
import { AuthProvider, useAuth } from "./AuthContext";

vi.mock("@/api/client", () => ({
  endpoints: { getCurrentUser: vi.fn(), login: vi.fn() },
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

const ADMIN_USER = {
  id: "u1",
  username: "admin",
  email: "admin@test.local",
  role: "admin" as const,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

function Probe() {
  const { user, loading, hasRole, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="username">{user?.username ?? "none"}</div>
      <div data-testid="is-admin">{String(hasRole("admin"))}</div>
      <button onClick={() => login("admin", "pw").catch(() => {})}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

describe("AuthProvider", () => {
  afterEach(() => vi.clearAllMocks());

  it("starts in a loading state and resolves to no user when there's no valid token", async () => {
    vi.mocked(endpoints.getCurrentUser).mockRejectedValue({ response: { status: 401 } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("loading").textContent).toBe("true");
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("username").textContent).toBe("none");
  });

  it("resolves to the logged-in user when a valid token already exists", async () => {
    vi.mocked(endpoints.getCurrentUser).mockResolvedValue({ data: ADMIN_USER } as never);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("username").textContent).toBe("admin"));
    expect(screen.getByTestId("is-admin").textContent).toBe("true");
  });

  it("login() stores the token and fetches the profile", async () => {
    vi.mocked(endpoints.getCurrentUser)
      .mockRejectedValueOnce({ response: { status: 401 } }) // initial mount check
      .mockResolvedValueOnce({ data: ADMIN_USER } as never); // post-login fetch
    vi.mocked(endpoints.login).mockResolvedValue({
      data: { access_token: "tok", token_type: "bearer", role: "admin" },
    } as never);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    act(() => screen.getByText("login").click());

    await waitFor(() => expect(screen.getByTestId("username").textContent).toBe("admin"));
  });

  it("logout() clears the user", async () => {
    vi.mocked(endpoints.getCurrentUser).mockResolvedValue({ data: ADMIN_USER } as never);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("username").textContent).toBe("admin"));

    act(() => screen.getByText("logout").click());

    expect(screen.getByTestId("username").textContent).toBe("none");
  });
});
