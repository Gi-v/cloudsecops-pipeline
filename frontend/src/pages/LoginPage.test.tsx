import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { endpoints } from "@/api/client";
import { AuthProvider } from "@/context/AuthContext";
import LoginPage from "./LoginPage";

vi.mock("@/api/client", () => ({
  endpoints: { getCurrentUser: vi.fn(), login: vi.fn() },
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  afterEach(() => vi.clearAllMocks());

  it("navigates to the dashboard on a successful login", async () => {
    vi.mocked(endpoints.getCurrentUser)
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({
        data: { id: "1", username: "admin", email: "a@b.c", role: "admin", is_active: true, created_at: "" },
      } as never);
    vi.mocked(endpoints.login).mockResolvedValue({
      data: { access_token: "tok", token_type: "bearer", role: "admin" },
    } as never);

    renderLoginPage();
    await waitFor(() => expect(screen.getByLabelText("Username")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByTestId("dashboard")).toBeInTheDocument());
  });

  it("shows an error message on invalid credentials without navigating away", async () => {
    vi.mocked(endpoints.getCurrentUser).mockRejectedValue({ response: { status: 401 } });
    vi.mocked(endpoints.login).mockRejectedValue({ response: { status: 401 } });

    renderLoginPage();
    await waitFor(() => expect(screen.getByLabelText("Username")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid username or password."),
    );
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });
});
