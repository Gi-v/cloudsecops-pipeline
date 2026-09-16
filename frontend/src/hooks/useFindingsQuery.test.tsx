import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { endpoints } from "@/api/client";
import { useFindingsQuery } from "./useFindingsQuery";

vi.mock("@/api/client", () => ({
  endpoints: {
    listFindings: vi.fn(),
    bulkUpdateFindingStatus: vi.fn(),
    updateFindingStatus: vi.fn(),
  },
}));

function mockResponse(findings: unknown[], total?: number) {
  return {
    data: findings,
    headers: total !== undefined ? { "x-total-count": String(total) } : {},
  };
}

function renderAt(url: string) {
  return renderHook(() => useFindingsQuery(), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
  });
}

describe("useFindingsQuery", () => {
  afterEach(() => vi.clearAllMocks());

  it("seeds the severity filter from the URL", async () => {
    vi.mocked(endpoints.listFindings).mockResolvedValue(mockResponse([], 0) as never);
    const { result } = renderAt("/findings?severity=CRITICAL");

    expect(result.current.severity).toBe("CRITICAL");
    await waitFor(() => expect(endpoints.listFindings).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "CRITICAL" }),
    ));
  });

  it("ignores an invalid severity value in the URL", () => {
    vi.mocked(endpoints.listFindings).mockResolvedValue(mockResponse([], 0) as never);
    const { result } = renderAt("/findings?severity=NOT_REAL");
    expect(result.current.severity).toBe("ALL");
  });

  it("seeds the search filter from the URL", async () => {
    vi.mocked(endpoints.listFindings).mockResolvedValue(mockResponse([], 0) as never);
    const { result } = renderAt("/findings?search=s3-bucket");

    expect(result.current.search).toBe("s3-bucket");
    await waitFor(() => expect(endpoints.listFindings).toHaveBeenCalledWith(
      expect.objectContaining({ search: "s3-bucket" }),
    ));
  });

  it("resets to page 0 when the severity filter changes", async () => {
    vi.mocked(endpoints.listFindings).mockResolvedValue(mockResponse([{ id: "1" }], 100) as never);
    const { result } = renderAt("/findings");
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setPage(3));
    await waitFor(() => expect(endpoints.listFindings).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 75 }),
    ));

    act(() => result.current.setSeverity("HIGH"));

    await waitFor(() => expect(endpoints.listFindings).toHaveBeenLastCalledWith(
      expect.objectContaining({ severity: "HIGH", offset: 0 }),
    ));
    expect(result.current.page).toBe(0);
  });

  it("reload() re-fetches the current page with the current filters", async () => {
    vi.mocked(endpoints.listFindings).mockResolvedValue(mockResponse([], 5) as never);
    const { result } = renderAt("/findings?severity=HIGH");
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(endpoints.listFindings).mockClear();

    await act(async () => result.current.reload());

    expect(endpoints.listFindings).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "HIGH", offset: 0 }),
    );
  });

  it("applyBulkStatus reloads findings on success", async () => {
    vi.mocked(endpoints.listFindings).mockResolvedValue(
      mockResponse([{ id: "a" }, { id: "b" }], 2) as never,
    );
    vi.mocked(endpoints.bulkUpdateFindingStatus).mockResolvedValue({
      data: { updated: 2, not_found: [] },
    } as never);
    const { result } = renderAt("/findings");
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleSelected("a"));
    act(() => result.current.toggleSelected("b"));
    expect(result.current.selected.size).toBe(2);

    const callsBefore = vi.mocked(endpoints.listFindings).mock.calls.length;
    await act(async () => result.current.applyBulkStatus("RESOLVED"));

    expect(endpoints.bulkUpdateFindingStatus).toHaveBeenCalledWith(
      expect.arrayContaining(["a", "b"]),
      "RESOLVED",
    );
    expect(vi.mocked(endpoints.listFindings).mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("applyBulkStatus does not reload on failure", async () => {
    vi.mocked(endpoints.listFindings).mockResolvedValue(mockResponse([{ id: "a" }], 1) as never);
    vi.mocked(endpoints.bulkUpdateFindingStatus).mockRejectedValue(new Error("server error"));
    const { result } = renderAt("/findings");
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleSelected("a"));
    const callsBefore = vi.mocked(endpoints.listFindings).mock.calls.length;
    await act(async () => result.current.applyBulkStatus("RESOLVED"));

    expect(vi.mocked(endpoints.listFindings).mock.calls.length).toBe(callsBefore);
  });

  it("toggleSelectAll selects everything then clears on a second call", async () => {
    vi.mocked(endpoints.listFindings).mockResolvedValue(
      mockResponse([{ id: "a" }, { id: "b" }, { id: "c" }], 3) as never,
    );
    const { result } = renderAt("/findings");
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleSelectAll());
    expect(result.current.selected.size).toBe(3);

    act(() => result.current.toggleSelectAll());
    expect(result.current.selected.size).toBe(0);
  });
});
