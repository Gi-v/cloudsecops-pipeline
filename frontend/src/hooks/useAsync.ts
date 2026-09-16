import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface UseAsyncOptions {
  /** Shown via toast.error on failure. Ignored if onError is provided. */
  errorMessage?: string;
  /** Custom failure handler — takes over from the default toast entirely. */
  onError?: (err: unknown) => void;
}

interface UseAsyncResult<T> {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  /** Re-runs the fetcher with the same deps, e.g. after a mutating action
   * completes (a scan finishes, a bulk update succeeds). */
  reload: () => void;
}

/** The loading/error/toast/try-catch boilerplate every page in this app
 * hand-rolled independently (see ResourcesPage.tsx and EvidencePage.tsx
 * pre-extraction) — one implementation instead of five near-identical ones.
 * Re-fetches whenever `deps` changes, same semantics as useEffect's own
 * dependency array. Guards against out-of-order resolution: if `deps`
 * changes again before an in-flight fetch resolves, that stale result is
 * discarded instead of overwriting newer data. */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  options?: UseAsyncOptions,
): UseAsyncResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const requestId = useRef(0);

  const load = useCallback(() => {
    const thisRequest = ++requestId.current;
    setLoading(true);
    setError(null);

    fetcherRef
      .current()
      .then((result) => {
        if (requestId.current !== thisRequest) return; // superseded by a newer call
        setData(result);
      })
      .catch((err: unknown) => {
        if (requestId.current !== thisRequest) return;
        setError(err);
        const opts = optionsRef.current;
        if (opts?.onError) {
          opts.onError(err);
        } else {
          toast.error(opts?.errorMessage ?? "Something went wrong — is the backend running?");
        }
      })
      .finally(() => {
        if (requestId.current !== thisRequest) return;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
    // `deps` is the caller's own dependency array by design (mirrors
    // useEffect's contract) — eslint can't verify an intentionally dynamic
    // array here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: load };
}
