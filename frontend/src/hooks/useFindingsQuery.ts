import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { endpoints } from "@/api/client";
import type { Finding, FindingStatus, Severity } from "@/types";

export const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
export const PAGE_SIZE = 25;

function isSeverity(value: string | null): value is Severity {
  return !!value && SEVERITIES.includes(value as Severity);
}

/** All the filter/pagination/selection/mutation state and logic behind the
 * Findings table — previously inline in FindingsPage.tsx with two
 * `eslint-disable-next-line react-hooks/exhaustive-deps` covering effects
 * whose real dependency (`load`) changed identity every render.
 *
 * Fixed here properly rather than suppressed: `load` reads `severity`/
 * `search` from refs instead of closing over component state, so its
 * identity never changes — both effects below can list it as a dependency
 * truthfully (satisfying the lint rule for real) without risking the
 * double-fetch race that naively adding `load` to the *original* closure-
 * based effects would have caused (an identity change from severity/search
 * would have retriggered the page-effect too, mid-transition, fetching the
 * old page with the new filter).
 */
export function useFindingsQuery() {
  const [searchParams] = useSearchParams();
  const urlSeverity = searchParams.get("severity");
  const urlSearch = searchParams.get("search");

  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [severity, setSeverity] = useState<Severity | "ALL">(
    isSeverity(urlSeverity) ? urlSeverity : "ALL",
  );
  const [search, setSearch] = useState(urlSearch ?? "");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Re-derive filters from the URL on every navigation to this route, not
  // just on first mount — react-router doesn't remount the component for a
  // same-route query-string-only navigation (e.g. the sidebar bell linking
  // to /findings?severity=CRITICAL, or the command palette linking to
  // /findings?search=... while already on /findings), so a useState
  // initializer alone would silently miss that update.
  useEffect(() => {
    setSeverity(isSeverity(urlSeverity) ? urlSeverity : "ALL");
  }, [urlSeverity]);
  useEffect(() => {
    if (urlSearch !== null) setSearch(urlSearch);
  }, [urlSearch]);

  const severityRef = useRef(severity);
  severityRef.current = severity;
  const searchRef = useRef(search);
  searchRef.current = search;

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const resp = await endpoints.listFindings({
        severity: severityRef.current === "ALL" ? undefined : severityRef.current,
        search: searchRef.current || undefined,
        limit: PAGE_SIZE,
        offset: targetPage * PAGE_SIZE,
      });
      setFindings(resp.data);
      setSelected(new Set());
      const totalHeader = resp.headers["x-total-count"];
      setTotal(totalHeader ? parseInt(totalHeader, 10) : resp.data.length);
    } catch {
      setFindings([]);
      toast.error("Couldn't load findings — is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []); // stable forever — reads current filters via refs, not closure

  useEffect(() => {
    if (page === 0) {
      load(0);
    } else {
      setPage(0);
    }
    // `page` is read but deliberately not a dependency: this effect should
    // only run again when the *filters* change, not when `page` itself
    // changes (that's the next effect's job). Listing it would make the
    // else-branch fire on every non-zero page change too, calling
    // setPage(0) right after the user navigated forward and undoing it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity, search, load]);

  useEffect(() => {
    load(page);
  }, [page, load]);

  async function changeStatus(id: string, status: FindingStatus) {
    const prev = findings;
    setFindings((f) => f.map((x) => (x.id === id ? { ...x, status } : x)));
    try {
      await endpoints.updateFindingStatus(id, status);
      toast.success(`Marked as ${status.replace("_", " ").toLowerCase()}`);
    } catch {
      setFindings(prev);
      toast.error("Failed to update status.");
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === findings.length ? new Set() : new Set(findings.map((f) => f.id))));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function applyBulkStatus(status: FindingStatus) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const { data } = await endpoints.bulkUpdateFindingStatus([...selected], status);
      toast.success(`Updated ${data.updated} finding${data.updated !== 1 ? "s" : ""}`);
      await load(page);
    } catch {
      toast.error("Bulk update failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  return {
    findings,
    total,
    loading,
    page,
    setPage,
    severity,
    setSeverity,
    search,
    setSearch,
    selected,
    toggleSelected,
    toggleSelectAll,
    clearSelection,
    bulkBusy,
    applyBulkStatus,
    changeStatus,
    reload: () => load(page),
  };
}
