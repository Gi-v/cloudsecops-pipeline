import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TopRiskResources from "./TopRiskResources";
import type { TopRiskResource } from "@/types";

const RESOURCES: TopRiskResource[] = [
  {
    resource_id: "r1",
    resource_urn: "arn:aws:s3:::risky-bucket",
    provider: "AWS",
    resource_type: "aws_s3_bucket",
    open_findings: 3,
    risk_score: 17,
    worst_severity: "CRITICAL",
  },
  {
    resource_id: "r2",
    resource_urn: "gcp:compute:instance:vm-1",
    provider: "GCP",
    resource_type: "gcp_compute_instance",
    open_findings: 1,
    risk_score: 2,
    worst_severity: "LOW",
  },
];

describe("TopRiskResources", () => {
  it("shows an empty state when nothing is open", () => {
    render(<TopRiskResources resources={[]} />);
    expect(screen.getByText("No open findings")).toBeInTheDocument();
  });

  it("renders one row per resource, ranked in the order given", () => {
    render(<TopRiskResources resources={RESOURCES} />);
    expect(screen.getByText("arn:aws:s3:::risky-bucket")).toBeInTheDocument();
    expect(screen.getByText("gcp:compute:instance:vm-1")).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
  });

  it("shows each resource's worst severity and open-finding count", () => {
    render(<TopRiskResources resources={RESOURCES} />);
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();
    expect(screen.getByText("3 open")).toBeInTheDocument();
    expect(screen.getByText("1 open")).toBeInTheDocument();
  });
});
