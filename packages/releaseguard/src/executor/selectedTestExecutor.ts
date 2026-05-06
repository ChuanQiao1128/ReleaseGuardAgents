import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { SelectedEvidence } from "../evidence/types";

export type TestExecutionResult = {
  testFile: string;
  command: string;
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  outcome: "passed" | "failed" | "inconclusive";
};

export type EvidenceExecutionResult = {
  results: TestExecutionResult[];
  artifactPath: string;
  testResultsPath: string;
};

export async function executeSelectedTests(input: {
  rootDir: string;
  artifactDir: string;
  selectedEvidence: SelectedEvidence[];
}): Promise<EvidenceExecutionResult> {
  const uniqueTestFiles = [
    ...new Set(input.selectedEvidence.map((evidence) => evidence.testFile)),
  ];
  const results: TestExecutionResult[] = [];

  for (const testFile of uniqueTestFiles) {
    results.push(await runDemoAppTest(input.rootDir, testFile));
  }

  const artifactPath = path.join(input.artifactDir, "evidence_result.json");
  const testResultsPath = path.join(input.artifactDir, "test_results.json");
  const payload = { results };
  await fs.writeFile(artifactPath, `${JSON.stringify(payload, null, 2)}\n`);
  await fs.writeFile(testResultsPath, `${JSON.stringify(payload, null, 2)}\n`);

  return {
    results,
    artifactPath,
    testResultsPath,
  };
}

async function runDemoAppTest(
  rootDir: string,
  testFile: string,
): Promise<TestExecutionResult> {
  const cwd = path.join(rootDir, "apps/demo-app");
  const args = ["test", "--", testFile];
  const command = `npm ${args.join(" ")}`;
  const started = Date.now();
  const { stdout, stderr, exitCode } = await runCommand("npm", args, cwd);
  const durationMs = Date.now() - started;

  return {
    testFile,
    command,
    cwd,
    exitCode,
    stdout,
    stderr,
    durationMs,
    outcome:
      exitCode === 0 ? "passed" : exitCode === null ? "inconclusive" : "failed",
  };
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: false });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      stderr += error.message;
      resolve({ stdout, stderr, exitCode: null });
    });
    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });
  });
}

