import { promises as fs } from "node:fs";
import path from "node:path";

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listFiles(
  rootDir: string,
  predicate: (filePath: string) => boolean,
): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") {
          continue;
        }
        await walk(absolute);
      } else if (entry.isFile() && predicate(absolute)) {
        results.push(absolute);
      }
    }
  }

  await walk(rootDir);
  return results.sort();
}

export function lineForIndex(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}

export function lineQuote(content: string, line: number): string {
  return content.split(/\r?\n/)[line - 1]?.trim() ?? "";
}

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

