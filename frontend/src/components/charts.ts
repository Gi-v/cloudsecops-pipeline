import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

/** Severity is a functional signal, not a brand statement — colors here
 * are pulled from the same danger/warn/medium/success tokens used
 * elsewhere for those exact meanings, not a separate decorative palette.
 * MEDIUM is neutral grey by design (Monochrome Precision spec) rather than
 * a brand hue — there is no brand hue in this theme. */
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
