import { describe, expect, it } from "vitest";
import { pooledUrl } from "@/db";

describe("pooledUrl", () => {
  it("routes a direct Neon URL through the pooler host", () => {
    expect(pooledUrl("postgresql://u:p@ep-calm-sea-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require")).toBe(
      "postgresql://u:p@ep-calm-sea-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    );
  });

  it("leaves a pooled URL and non-Neon URLs alone", () => {
    const pooled = "postgresql://u:p@ep-calm-sea-123456-pooler.ap-southeast-1.aws.neon.tech/neondb";
    expect(pooledUrl(pooled)).toBe(pooled);
    expect(pooledUrl("postgresql://u:p@localhost:5432/pathwise")).toBe("postgresql://u:p@localhost:5432/pathwise");
    expect(pooledUrl("not a url")).toBe("not a url");
  });
});
