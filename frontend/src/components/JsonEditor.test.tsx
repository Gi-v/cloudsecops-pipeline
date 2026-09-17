import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import JsonEditor, { tokenize } from "./JsonEditor";

function classesOf(text: string) {
  return tokenize(text).map((t) => t.className);
}

describe("tokenize", () => {
  it("classifies an object key (string followed by a colon) separately from a string value", () => {
    const nodes = tokenize('{"key": "value"}');
    const key = nodes.find((n) => n.text === '"key"');
    const value = nodes.find((n) => n.text === '"value"');
    expect(key?.className).toBe("jt-key");
    expect(value?.className).toBe("jt-string");
  });

  it("classifies numbers, including negatives and exponents", () => {
    for (const num of ["42", "-3.5", "1e10", "-2E-3"]) {
      const nodes = tokenize(num);
      expect(nodes.find((n) => n.text === num)?.className).toBe("jt-number");
    }
  });

  it("classifies true/false/null distinctly", () => {
    expect(classesOf("true")).toEqual(["jt-bool-true"]);
    expect(classesOf("false")).toEqual(["jt-bool-false"]);
    expect(classesOf("null")).toEqual(["jt-punct"]);
  });

  it("classifies structural punctuation", () => {
    const nodes = tokenize("{}[],:");
    expect(nodes.every((n) => n.className === "jt-punct")).toBe(true);
  });

  it("preserves the original text exactly when every node is joined back together", () => {
    const input = '{\n  "acl": "public-read",\n  "count": -2.5e3\n}';
    const rejoined = tokenize(input)
      .map((n) => n.text)
      .join("");
    expect(rejoined).toBe(input);
  });

  it("does not throw on a partially invalid document mid-edit", () => {
    expect(() => tokenize('{"unterminated": "str')).not.toThrow();
    expect(() => tokenize("{{{[[[")).not.toThrow();
  });
});

describe("JsonEditor", () => {
  it("renders one gutter line number per line", () => {
    const { container } = render(<JsonEditor value={"line1\nline2\nline3"} onChange={() => {}} />);
    expect(container.querySelector(".json-editor-gutter")?.textContent).toBe("1\n2\n3");
  });

  it("calls onChange with the new value when the user types", () => {
    const onChange = vi.fn();
    render(<JsonEditor value="{}" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Resource JSON to evaluate"), {
      target: { value: '{"a": 1}' },
    });
    expect(onChange).toHaveBeenCalledWith('{"a": 1}');
  });
});
