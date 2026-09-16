export function Skeleton({ width, height = 14, style }: { width?: string | number; height?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width: width ?? "100%", height, ...style }} />;
}

export function KpiSkeleton() {
  return (
    <div className="glass kpi-card">
      <Skeleton width={80} height={10} style={{ marginBottom: 10 }} />
      <Skeleton width={64} height={24} />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <Skeleton height={12} />
        </td>
      ))}
    </tr>
  );
}

export function ChartSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <Skeleton width={140} height={140} style={{ borderRadius: "50%" }} />
    </div>
  );
}
