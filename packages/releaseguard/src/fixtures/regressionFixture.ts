import { promises as fs } from "node:fs";
import path from "node:path";

const ROUTE_RELATIVE_PATH = "apps/demo-app/src/app/api/discount/apply/route.ts";

export type AppliedFixture = {
  restore(): Promise<void>;
};

export async function applyDemoDiscountRegressionFixture(
  rootDir: string,
): Promise<AppliedFixture> {
  const targetPath = path.join(rootDir, ROUTE_RELATIVE_PATH);
  const fixturePath = path.join(
    rootDir,
    "packages/releaseguard/fixtures/demo-discount-regression/route.ts",
  );
  const original = await fs.readFile(targetPath, "utf8");
  const fixture = await fs.readFile(fixturePath, "utf8");
  await fs.writeFile(targetPath, fixture);

  return {
    async restore() {
      await fs.writeFile(targetPath, original);
    },
  };
}

