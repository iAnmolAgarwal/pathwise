import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // The landing reads the agreement report and the mining stats at request time (src/lib/trust.ts);
  // make sure they travel with the server bundle.
  outputFileTracingIncludes: {
    "/": ["./pipeline/evidence/agreement_report.json", "./pipeline/evidence/so_stats.md", "./pipeline/evidence/coursera_stats.md"],
  },
};

export default nextConfig;
