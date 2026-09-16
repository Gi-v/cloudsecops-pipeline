import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, ServerCog } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { endpoints } from "@/api/client";
import EmptyState from "@/components/EmptyState";
import EvidenceDrawer from "@/components/EvidenceDrawer";
import ProviderBadge from "@/components/ProviderBadge";
import ScanButton from "@/components/ScanButton";
import SearchInput from "@/components/SearchInput";
import { TableRowSkeleton } from "@/components/Skeleton";
import TextGenerateEffect from "@/components/TextGenerateEffect";
import { useAsync } from "@/hooks/useAsync";
import type { CloudProvider, Resource } from "@/types";

const PROVIDERS: CloudProvider[] = ["AWS", "GCP", "AZURE"];
const PAGE_SIZE = 100;
const ACTIVE_CLASS: Record<CloudProvider, string> = { AWS: "active-aws", GCP: "active-gcp", AZURE: "active-azure" };

function formatScanned(iso: string) {
  const d = new Date(iso);
  const date = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${date}, ${time}`;
}

export default function ResourcesPage() {
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get("search");

  const [provider, setProvider] = useState<CloudProvider | "ALL">("ALL");
  const [search, setSearch] = useState(urlSearch ?? "");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Same-route navigations (e.g. the command palette linking to
  // /resources?search=...) don't remount this component, so the useState
  // initializer alone would miss a search param set after first mount.
  useEffect(() => {
    if (urlSearch !== null) setSearch(urlSearch);
  }, [urlSearch]);

  // Reset to page 0 whenever the filter changes, same two-effect pattern
  // useFindingsQuery uses — otherwise a filter change while on page 3 would
  // silently request an out-of-range offset.
  useEffect(() => {
    setPage(0);
  }, [provider, search]);

  const fetchResources = useCallback(
    () =>
      endpoints
        .listResources({
          provider: provider === "ALL" ? undefined : provider,
          search: search || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        })
        .then((r) => {
          const totalHeader = r.headers["x-total-count"];
          setTotal(totalHeader ? parseInt(totalHeader, 10) : r.data.length);
          return r.data;
        }),
    [provider, search, page],
  );
  const { data: resources = [], loading, reload } = useAsync<Resource[]>(fetchResources, [provider, search, page], {
    errorMessage: "Couldn't load resources — is the backend running?",
  });
  const [drawerUrn, setDrawerUrn] = useState<string | null>(null);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-row">
          <span className="page-title-icon">
            <ServerCog size={18} />
          </span>
          <div>
            <h1 className="page-title">
              <TextGenerateEffect text="Resources" />
            </h1>
            <p className="page-sub">Every cloud resource discovered by the collectors.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <SearchInput value={search} onSearch={setSearch} placeholder="Search resource URN…" />
          <ScanButton onDone={reload} />
        </div>
      </div>

      <div className="filter-bar">
        <button
          className={`filter-btn${provider === "ALL" ? " active active-accent" : ""}`}
          onClick={() => setProvider("ALL")}
        >
          All Clouds
        </button>
        {PROVIDERS.map((p) => (
          <button
            key={p}
            className={`filter-btn${provider === p ? ` active ${ACTIVE_CLASS[p]}` : ""}`}
            onClick={() => setProvider(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="glass table-wrap" style={{ padding: 16 }}>
        {loading ? (
          <table>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={7} />
              ))}
            </tbody>
          </table>
        ) : resources.length === 0 ? (
          <EmptyState
            icon={ServerCog}
            title="No resources yet"
            subtitle="Run a scan to populate the cloud inventory, or clear the search/filter."
            variant="resources"
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>URN</th>
                <th>Provider</th>
                <th>Type</th>
                <th>Region</th>
                <th>Account</th>
                <th>Last Scanned</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resources.map((r, i) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
                >
                  <td
                    style={{
                      maxWidth: 260,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--t1)",
                    }}
                  >
                    {r.resource_urn}
                  </td>
                  <td>
                    <ProviderBadge provider={r.provider} />
                  </td>
                  <td style={{ color: "var(--t2)" }}>{r.resource_type}</td>
                  <td style={{ color: "var(--t3)" }}>{r.region}</td>
                  <td style={{ color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.account_id}
                  </td>
                  <td style={{ fontSize: 10, color: "var(--t3)" }}>{formatScanned(r.last_scanned_at)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      onClick={() => setDrawerUrn(r.resource_urn)}
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        color: "var(--brand)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Evidence <ArrowRight size={11} />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16, alignItems: "center" }}>
          <button className="icon-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: 12, color: "var(--t2)", fontFamily: "var(--mono)" }}>
            Page {page + 1} of {Math.ceil(total / PAGE_SIZE)} · {total} resources
          </span>
          <button
            className="icon-btn"
            disabled={(page + 1) * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {drawerUrn && <EvidenceDrawer urn={drawerUrn} onClose={() => setDrawerUrn(null)} />}
    </div>
  );
}
