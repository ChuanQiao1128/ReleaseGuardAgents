import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli";

describe("parseCliArgs", () => {
  it("parses base and head run arguments", () => {
    expect(parseCliArgs(["run", "--base", "main", "--head", "feature"])).toEqual({
      command: "run",
      base: "main",
      head: "feature",
    });
  });

  it("parses fixture run arguments", () => {
    expect(
      parseCliArgs(["run", "--fixture", "demo-discount-regression"]),
    ).toEqual({
      command: "run",
      fixture: "demo-discount-regression",
    });
  });

  it("rejects run without diff or fixture arguments", () => {
    expect(() => parseCliArgs(["run"])).toThrow(
      "run requires --base/--head or --fixture.",
    );
  });
});

