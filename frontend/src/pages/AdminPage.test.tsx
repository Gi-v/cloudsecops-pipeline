import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { endpoints } from "@/api/client";
import AdminPage from "./AdminPage";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/api/client", () => ({
  endpoints: {
    listUsers: vi.fn(),
    createUser: vi.fn(),
    updateUserRole: vi.fn(),
  },
}));

const USERS = [
  { id: "u1", username: "admin", email: "admin@test.local", role: "admin", is_active: true, created_at: "2026-01-01T00:00:00Z" },
  { id: "u2", username: "viewer1", email: "viewer1@test.local", role: "viewer", is_active: true, created_at: "2026-01-02T00:00:00Z" },
];

describe("AdminPage", () => {
  afterEach(() => vi.clearAllMocks());

  it("lists existing users", async () => {
    vi.mocked(endpoints.listUsers).mockResolvedValue({ data: USERS } as never);

    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());
    expect(screen.getByText("viewer1")).toBeInTheDocument();
  });

  it("shows an empty state when there are no users", async () => {
    vi.mocked(endpoints.listUsers).mockResolvedValue({ data: [] } as never);

    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText("No users yet")).toBeInTheDocument());
  });

  it("submits the create-user form and reloads the list", async () => {
    vi.mocked(endpoints.listUsers).mockResolvedValue({ data: USERS } as never);
    vi.mocked(endpoints.createUser).mockResolvedValue({ data: USERS[1] } as never);

    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "newbie" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "newbie@test.local" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "abc12345" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() =>
      expect(endpoints.createUser).toHaveBeenCalledWith({
        username: "newbie",
        email: "newbie@test.local",
        password: "abc12345",
        role: "viewer",
      }),
    );
    expect(endpoints.listUsers).toHaveBeenCalledTimes(2); // initial load + reload after create
  });

  it("changes a user's role via the per-row select", async () => {
    vi.mocked(endpoints.listUsers).mockResolvedValue({ data: USERS } as never);
    vi.mocked(endpoints.updateUserRole).mockResolvedValue({ data: USERS[1] } as never);

    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText("viewer1")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Role for viewer1"), { target: { value: "admin" } });

    await waitFor(() => expect(endpoints.updateUserRole).toHaveBeenCalledWith("u2", "admin"));
  });
});
