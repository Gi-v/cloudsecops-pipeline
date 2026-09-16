import type { Severity } from "@/types";

/** The one place severity gets a filled chip instead of colored text — a
 * dense data table benefits from a scannable shape per row in a way a
 * feed or KPI number doesn't. See `.severity-chip` in index.css. */
export default function SeverityChip({ severity }: { severity: Severity }) {
  return <span className={`severity-chip severity-chip-${severity}`}>{severity}</span>;
}
