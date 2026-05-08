import { promises as fs } from "node:fs";
import path from "node:path";
import { pathExists } from "./fileUtils";

export type FrameworkKind =
  | "nextjs_app_router"
  | "vite_react_router"
  | "unsupported";

export type FrameworkDetection = {
  kind: FrameworkKind;
  isNextAppRouter: boolean;
  isViteReactRouter: boolean;
  isTypeScript: boolean;
  appRoot: string;
  appDir: string;
};

export async function detectFramework(
  rootDir: string,
): Promise<FrameworkDetection> {
  const candidates = [
    path.join(rootDir, "apps/demo-app"),
    rootDir,
  ];

  // First pass: prefer Next.js App Router when an app/ directory exists.
  for (const appRoot of candidates) {
    const appDir =
      (await pathExists(path.join(appRoot, "src/app")))
        ? path.join(appRoot, "src/app")
        : path.join(appRoot, "app");
    if (
      (await pathExists(path.join(appRoot, "package.json"))) &&
      (await pathExists(appDir))
    ) {
      return {
        kind: "nextjs_app_router",
        isNextAppRouter: true,
        isViteReactRouter: false,
        isTypeScript: await pathExists(path.join(appRoot, "tsconfig.json")),
        appRoot,
        appDir,
      };
    }
  }

  // Second pass: detect Vite + React Router.
  for (const appRoot of candidates) {
    const detected = await detectViteReactRouter(appRoot);
    if (detected) {
      return detected;
    }
  }

  return {
    kind: "unsupported",
    isNextAppRouter: false,
    isViteReactRouter: false,
    isTypeScript: false,
    appRoot: rootDir,
    appDir: path.join(rootDir, "src/app"),
  };
}

async function detectViteReactRouter(
  appRoot: string,
): Promise<FrameworkDetection | undefined> {
  const packageJsonPath = path.join(appRoot, "package.json");
  if (!(await pathExists(packageJsonPath))) {
    return undefined;
  }
  let manifest: PackageManifest | undefined;
  try {
    const raw = await fs.readFile(packageJsonPath, "utf8");
    manifest = JSON.parse(raw) as PackageManifest;
  } catch {
    return undefined;
  }
  if (!manifest) {
    return undefined;
  }
  const allDeps = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
    ...(manifest.peerDependencies ?? {}),
  };
  const hasVite = Boolean(allDeps.vite);
  const hasReactRouter =
    Boolean(allDeps["react-router-dom"]) || Boolean(allDeps["react-router"]);
  const srcDir = path.join(appRoot, "src");
  if (!hasVite || !hasReactRouter) {
    return undefined;
  }
  if (!(await pathExists(srcDir))) {
    return undefined;
  }
  return {
    kind: "vite_react_router",
    isNextAppRouter: false,
    isViteReactRouter: true,
    isTypeScript: await pathExists(path.join(appRoot, "tsconfig.json")),
    appRoot,
    appDir: srcDir,
  };
}

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
