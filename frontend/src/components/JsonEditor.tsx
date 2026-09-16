import { useRef } from "react";

/** Tokenizes a JSON string into colored spans — keys, string values,
 * numbers, booleans, punctuation — without a full JSON parse (a partially
 * invalid document while the user is mid-edit should still highlight, not
 * blank out). Regex-based, in token order, so nesting/formatting is
 * preserved exactly as typed. */
export function tokenize(text: string) {
  const pattern = /("(?:\\.|[^"\\])*")(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:]/g;
  const nodes: { text: string; className?: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push({ text: text.slice(lastIndex, match.index) });
    }
    const [full, quoted, colon] = match;
    if (quoted) {
      nodes.push({ text: quoted, className: colon ? "jt-key" : "jt-string" });
      if (colon) nodes.push({ text: colon });
    } else if (full === "true") {
      nodes.push({ text: full, className: "jt-bool-true" });
    } else if (full === "false") {
      nodes.push({ text: full, className: "jt-bool-false" });
    } else if (full === "null") {
      nodes.push({ text: full, className: "jt-punct" });
    } else if (/^[{}[\],:]$/.test(full)) {
      nodes.push({ text: full, className: "jt-punct" });
    } else {
      nodes.push({ text: full, className: "jt-number" });
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) nodes.push({ text: text.slice(lastIndex) });
  return nodes;
}

export default function JsonEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const highlightRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineCount = value.split("\n").length;

  function syncScroll() {
    if (highlightRef.current && textareaRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }

  return (
    <div className="json-editor">
      <div className="json-editor-gutter">
        {Array.from({ length: lineCount }, (_, i) => i + 1).join("\n")}
      </div>
      <div className="json-editor-body">
        <div ref={highlightRef} className="json-editor-highlight" aria-hidden="true">
          {tokenize(value).map((t, i) => (
            <span key={i} className={t.className}>
              {t.text}
            </span>
          ))}
          {/* trailing newline keeps the highlight div the same height as the textarea */}
          {"\n"}
        </div>
        <textarea
          ref={textareaRef}
          className="json-editor-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>
    </div>
  );
}
