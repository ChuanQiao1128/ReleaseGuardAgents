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
  const candidates = [
    path.join(rootDir, "apps/demo-app"),
    rootDir,
  ];
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
        isNextAppRouter: true,
        isTypeScript: await pathExists(path.join(appRoot, "tsconfig.json")),
        appRoot,
        appDir,
      };
    }
  }

  return {
    isNextAppRouter: false,
    isTypeScript: false,
    appRoot: rootDir,
    appDir: path.join(rootDir, "src/app"),
  };
}
