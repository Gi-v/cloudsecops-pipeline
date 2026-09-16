import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchInput from "./SearchInput";

describe("SearchInput", () => {
  it("does not call onSearch immediately on keystroke", () => {
    const onSearch = vi.fn();
    render(<SearchInput value="" onSearch={onSearch} />);
    fireEvent.change(screen.getByPlaceholderText("Search…"), { target: { value: "s3" } });
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("calls onSearch with the typed value after the debounce delay", async () => {
    const onSearch = vi.fn();
    render(<SearchInput value="" onSearch={onSearch} />);
    fireEvent.change(screen.getByPlaceholderText("Search…"), { target: { value: "s3" } });
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith("s3"), { timeout: 1000 });
  });

  it("only fires once for rapid successive keystrokes", async () => {
    const onSearch = vi.fn();
    render(<SearchInput value="" onSearch={onSearch} />);
    const input = screen.getByPlaceholderText("Search…");
    fireEvent.change(input, { target: { value: "s" } });
    fireEvent.change(input, { target: { value: "s3" } });
    fireEvent.change(input, { target: { value: "s3-b" } });
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith("s3-b"), { timeout: 1000 });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("shows a clear button once there is text, and clears on click", async () => {
    const onSearch = vi.fn();
    render(<SearchInput value="s3" onSearch={onSearch} />);
    const clearBtn = screen.getByLabelText("Clear search");
    fireEvent.click(clearBtn);
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("renders no clear button when the value is empty", () => {
    render(<SearchInput value="" onSearch={vi.fn()} />);
    expect(screen.queryByLabelText("Clear search")).toBeNull();
  });
});
