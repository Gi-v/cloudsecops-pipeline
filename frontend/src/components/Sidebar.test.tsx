import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { endpoints } from "@/api/client";
import { MockWebSocket } from "@/test/mockWebSocket";
import { AuthProvider } from "@/context/AuthContext";
import { LiveFeedProvider } from "@/context/LiveFeedContext";
import Sidebar from "./Sidebar";

vi.stubGlobal("WebSocket", MockWebSocket);

vi.mock("@/api/client", () => ({
  endpoints: { getCurrentUser: vi.fn() },
  setToken: vi.fn(),
  clearToken: vi.fn(),
  getWebSocketUrl: () => "ws://localhost/ws/live",
}));

function makeFindingMessage(violations: Array<{ severity: string; title: string }>) {
  return {
    type: "finding.enriched",
    data: {
      correlation_id: "c1",
      resource_urn: "arn:aws:s3:::test-bucket",
      resource_type: "aws_s3_bucket",
      provider: "AWS",
      violations,
      passed_controls: [],
      findings: [],
      evaluated_at: new Date().toISOString(),
    },
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <LiveFeedProvider>
        <Sidebar />
      </LiveFeedProvider>
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Sidebar", () => {
  beforeEach(() => {
    MockWebSocket.reset();
  });

  it("renders every nav item with its visible label", () => {
    renderSidebar();
    for (const label of ["Dashboard", "Findings", "Resources", "Policy Simulator", "Evidence Chain"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("shows Offline before the socket connects, then Live once it does", () => {
    renderSidebar();
    expect(screen.getByText("Offline")).toBeInTheDocument();

    act(() => MockWebSocket.latest().__simulateOpen());

    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("routes to the CRITICAL filter when a critical alert is open, and clears the badge", () => {
    renderSidebar();
    act(() => MockWebSocket.latest().__simulateOpen());
    act(() =>
      MockWebSocket.latest().__simulateMessage(
        makeFindingMessage([{ severity: "CRITICAL", title: "Public bucket" }]),
      ),
    );
    expect(screen.getByText("1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /alerts/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/findings?severity=CRITICAL");
  });

  it("falls back to the HIGH filter when there are no criticals open", () => {
    renderSidebar();
    act(() => MockWebSocket.latest().__simulateOpen());
    act(() =>
      MockWebSocket.latest().__simulateMessage(
        makeFindingMessage([{ severity: "HIGH", title: "Old access key" }]),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: /alerts/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/findings?severity=HIGH");
  });
});

function renderSidebarWithAuth(role: "admin" | "viewer") {
  vi.mocked(endpoints.getCurrentUser).mockResolvedValue({
    data: {
      id: "u1",
      username: role === "admin" ? "admin" : "someviewer",
      email: "x@test.local",
      role,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  } as never);

  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <LiveFeedProvider>
          <Sidebar />
        </LiveFeedProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Sidebar with a logged-in user", () => {
  beforeEach(() => {
    MockWebSocket.reset();
    vi.clearAllMocks();
  });

  it("shows the real logged-in username instead of the old placeholder", async () => {
    renderSidebarWithAuth("admin");
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());
    expect(screen.getByText("Administrator")).toBeInTheDocument();
  });

  it("shows the Admin nav item for an admin", async () => {
    renderSidebarWithAuth("admin");
    await waitFor(() => expect(screen.getByText("Admin")).toBeInTheDocument());
  });

  it("hides the Admin nav item for a viewer", async () => {
    renderSidebarWithAuth("viewer");
    await waitFor(() => expect(screen.getByText("someviewer")).toBeInTheDocument());
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.getByText("Viewer")).toBeInTheDocument();
  });
});
