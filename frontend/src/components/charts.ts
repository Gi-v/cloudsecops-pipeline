import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";

Chart.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
);

/** Severity is a functional signal, not a brand statement — colors here
 * are pulled from the same danger/warn/medium/success tokens used
 * elsewhere for those exact meanings, not a separate decorative palette.
 * MEDIUM stays neutral grey rather than a brand hue — brand color is
 * reserved for the periwinkle/violet accent, never repurposed to mean a
 * severity. */
export const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#EF4444",
  HIGH: "#F59E0B",
  MEDIUM: "#6B7280",
  LOW: "#22C55E",
  INFO: "#808080",
};

/** Shared green/amber/red thresholds for "a compliance percentage" —
 * used by both the CIS Benchmark panel and the Framework Coverage ranked
 * list so the same number reads the same color everywhere on the
 * dashboard, instead of each panel picking its own cutoffs. */
export function complianceColor(pct: number): string {
  if (pct >= 80) return "var(--success)";
  if (pct >= 65) return "var(--warn)";
  return "var(--danger)";
}

/** Reads the live --t2 CSS custom property so charts pick up the current
 * theme (dark/light) instead of hardcoding one palette — chart.js doesn't
 * re-render on its own when a CSS variable changes, so this is called at
 * render time in each chart component rather than cached at module load. */
export function chartTextColor(): string {
  if (typeof document === "undefined") return "#9498A3";
  return getComputedStyle(document.documentElement).getPropertyValue("--t2").trim() || "#9498A3";
}

/** `complianceColor`/`SEVERITY_COLORS`-style helpers return `"var(--x)"`
 * strings, which the DOM resolves automatically in a React `style` prop —
 * but Canvas 2D's `fillStyle`/`strokeStyle` don't resolve CSS custom
 * properties at all, so handing Chart.js a raw `var(--danger)` silently
 * renders as black instead of red. This resolves it to the actual
 * computed color first, the same way `chartTextColor` already does for
 * `--t2`, so a color token works in both a styled `<span>` and a canvas. */
export function resolveThemeColor(cssVarExpr: string): string {
  const match = /var\((--[\w-]+)\)/.exec(cssVarExpr);
  if (!match) return cssVarExpr;
  if (typeof document === "undefined") return "#9498A3";
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || "#9498A3";
}
