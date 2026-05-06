import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { analyzeScope, ScopeAnalysis } from "./scopeAnalyzer";

const execFileAsync = promisify(execFile);

export type ChangeScope =
  | {
      mode: "fixture";
      fixture: "demo-discount-regression" | "demo-missing-evidence";
      changedFiles: string[];
      scope: ScopeAnalysis;
      docsOnly: false;
    }
  | {
      mode: "fixture";
      fixture: "demo-docs-only";
      changedFiles: string[];
      scope: ScopeAnalysis;
      docsOnly: true;
    }
  | {
      mode: "git";
      base: string;
      head: string;
      changedFiles: string[];
      scope: ScopeAnalysis;
      docsOnly: boolean;
    };

export async function resolveChangeScope(args: {
  rootDir: string;
  base?: string;
  head?: string;
  fixture?: string;
}): Promise<ChangeScope> {
  if (args.fixture) {
    if (
      args.fixture !== "demo-discount-regression" &&
      args.fixture !== "demo-missing-evidence" &&
      args.fixture !== "demo-docs-only"
    ) {
      throw new Error(`Unknown fixture: ${args.fixture}`);
    }
    const changedFiles =
      args.fixture === "demo-docs-only"
        ? ["README.md"]
        : ["apps/demo-app/src/app/api/discount/apply/route.ts"];
    const scope = analyzeScope(changedFiles);
    if (args.fixture === "demo-docs-only") {
      return {
        mode: "fixture",
        fixture: "demo-docs-only",
        changedFiles,
        scope,
        docsOnly: true,
      };
    }

    return {
      mode: "fixture",
      fixture: args.fixture,
      changedFiles,
      scope,
      docsOnly: false,
    };
  }

  if (!args.base || !args.head) {
    throw new Error("releaseguard run requires --base/--head or --fixture.");
  }

  const { stdout } = await execFileAsync(
    "git",
    ["diff", "--name-only", `${args.base}..${args.head}`],
    { cwd: args.rootDir },
  );
  const changedFiles = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const scope = analyzeScope(changedFiles);
  return {
    mode: "git",
    base: args.base,
    head: args.head,
    changedFiles,
    scope,
    docsOnly: scope.classification === "docs_only",
  };
}
