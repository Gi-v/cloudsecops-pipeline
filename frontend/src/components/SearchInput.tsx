import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

/** A debounced text search box — calls `onSearch` 350ms after the user
 * stops typing rather than on every keystroke. */
export default function SearchInput({
  value,
  onSearch,
  placeholder = "Search…",
}: {
  value: string;
  onSearch: (query: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== value) onSearch(draft);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <div
      className="glass"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        minWidth: 220,
      }}
    >
      <Search size={14} color="var(--t3)" />
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          background: "none",
          border: "none",
          outline: "none",
          color: "var(--t1)",
          fontSize: 12.5,
          fontFamily: "var(--sans)",
        }}
      />
      {draft && (
        <button
          onClick={() => {
            setDraft("");
            onSearch("");
          }}
          aria-label="Clear search"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex" }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
