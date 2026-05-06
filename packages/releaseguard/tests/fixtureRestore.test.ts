import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runReleaseGuard } from "../src/run";

const repoRoot = path.resolve(process.cwd(), "../..");
const routePath = path.join(
  repoRoot,
  "apps/demo-app/src/app/api/discount/apply/route.ts",
);

describe("demo-discount-regression fixture safety", () => {
  it("restores the original route file after the fixture run", async () => {
    const before = await fs.readFile(routePath, "utf8");

    const result = await runReleaseGuard({
      rootDir: repoRoot,
      fixture: "demo-discount-regression",
    });

    const after = await fs.readFile(routePath, "utf8");
    expect(result.decision.decision).toBe("BLOCK");
    expect(after).toBe(before);
    expect(after).toContain("{ status: 400 }");
    expect(after).not.toContain("{ status: 500 }");
  }, 20_000);
});
