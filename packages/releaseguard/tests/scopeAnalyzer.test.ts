import { describe, expect, it } from "vitest";
import {
  analyzeScope,
  isDocsOnlyPath,
} from "../src/diff/scopeAnalyzer";

describe("ScopeAnalyzer", () => {
  it("classifies README and docs markdown as docs_only", () => {
    expect(analyzeScope(["README.md", "docs/usage.md"])).toMatchObject({
      classification: "docs_only",
    });
    expect(isDocsOnlyPath("SECURITY_NOTES.md")).toBe(true);
    expect(isDocsOnlyPath("DESIGN.md")).toBe(true);
  });

  it("does not classify package.json as docs_only", () => {
    expect(analyzeScope(["package.json"])).toMatchObject({
      classification: "config_or_dependency_change",
    });
  });

  it("does not classify source files as docs_only", () => {
    expect(
      analyzeScope(["apps/demo-app/src/app/api/discount/apply/route.ts"]),
    ).toMatchObject({
      classification: "source_or_test_change",
    });
  });
});

