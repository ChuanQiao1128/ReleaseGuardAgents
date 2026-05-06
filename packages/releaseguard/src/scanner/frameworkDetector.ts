import path from "node:path";
import { pathExists } from "./fileUtils";

export type FrameworkDetection = {
  isNextAppRouter: boolean;
  isTypeScript: boolean;
  appRoot: string;
  appDir: string;
};

export async function detectFramework(
  rootDir: string,
): Promise<FrameworkDetection> {
  const appRoot = path.join(rootDir, "apps/demo-app");
  const appDir = path.join(appRoot, "src/app");

  return {
    isNextAppRouter:
      (await pathExists(path.join(appRoot, "package.json"))) &&
      (await pathExists(appDir)),
    isTypeScript: await pathExists(path.join(appRoot, "tsconfig.json")),
    appRoot,
    appDir,
  };
}

