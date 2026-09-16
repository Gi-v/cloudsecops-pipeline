import type { CloudProvider } from "@/types";

export default function ProviderBadge({ provider }: { provider: CloudProvider }) {
  return <span className={`provider-badge provider-badge-${provider}`}>{provider}</span>;
}
