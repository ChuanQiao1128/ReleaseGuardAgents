import { promises as fs } from "node:fs";
import path from "node:path";
import {
  addEdge,
  addFileNode,
  addNode,
  makeEdge,
  toRepoRelativePath,
} from "../graph/capabilityGraph";
import { CapabilityGraph, CapabilityNode, TestCaseTag } from "../graph/types";
import { lineForIndex, lineQuote, listFiles } from "./fileUtils";

export async function scanTests(
  rootDir: string,
  appRoot: string,
  graph: CapabilityGraph,
): Promise<void> {
  const testFiles = await listFiles(appRoot, (filePath) =>
    filePath.endsWith(".test.ts"),
  );

  for (const testFile of testFiles) {
    const relativePath = toRepoRelativePath(rootDir, testFile);
    const source = await fs.readFile(testFile, "utf8");
    const fileNode = addFileNode(graph, rootDir, testFile, "test_file_scanned");

    if (isDiscountApiTest(source, relativePath)) {
      const tags = extractInvalidDiscountTags(source);
      const invalidLine =
        lineForIndex(source, source.indexOf("returns 400 for an invalid discount")) ||
        1;
      const testNode: CapabilityNode = {
        id: "test_api_discount_invalid",
        type: "test",
        name: "invalid discount API test",
        target: "invalid_discount returns 400",
        filePath: relativePath,
        risk: "low",
        confidence: "high",
        confidenceBasis: "direct_test_import",
        evidenceRefs: [
          {
            filePath: relativePath,
            lineStart: invalidLine,
            lineEnd: invalidLine,
            quote: lineQuote(source, invalidLine),
            reason:
              "Test imports the discount API handler and asserts invalid discount behavior.",
          },
        ],
        metadata: {
          caseTags: tags,
          targetCapability: "api_apply_discount",
          testFile: path.posix.relative("apps/demo-app", relativePath),
        },
      };
      addNode(graph, testNode);
      addEdge(
        graph,
        makeEdge(
          fileNode.id,
          "defines",
          testNode.id,
          "high",
          "test_file_defines_test_case",
          testNode.evidenceRefs,
        ),
      );
      addEdge(
        graph,
        makeEdge(
          "api_apply_discount",
          "tested_by",
          testNode.id,
          "high",
          "direct_test_import",
          testNode.evidenceRefs,
          { caseTags: tags, coverageDepth: "direct" },
        ),
      );
    }
  }
}

function isDiscountApiTest(source: string, relativePath: string): boolean {
  return (
    relativePath.endsWith("apps/demo-app/tests/api/discount.test.ts") &&
    source.includes("src/app/api/discount/apply/route") &&
    source.includes("returns 400 for an invalid discount")
  );
}

function extractInvalidDiscountTags(source: string): TestCaseTag[] {
  const tags = new Set<TestCaseTag>();
  if (source.includes("invalid discount") || source.includes("NOPE")) {
    tags.add("invalid_discount");
    tags.add("error_status");
  }
  if (source.includes("toBe(400)")) {
    tags.add("400");
  }
  if (source.includes("toBe(500)")) {
    tags.add("500");
  }
  return [...tags];
}
