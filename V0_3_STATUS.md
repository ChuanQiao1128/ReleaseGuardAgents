# ReleaseGuard v0.3 Status

Working scope: RAG-informed evidence priority only.

v0.3 may use trusted repo memory to raise evidence requirements. It must not
let RAG directly decide `PASS` / `WARN` / `BLOCK`, lower requirements, change
capability risk, mark evidence as passed, or let current-PR modified docs
influence current-run evidence priority.

## RAG-informed Evidence Priority

Status: Done

Done:
- Added `HistoricalRiskContext` for validated repo-memory context.
- Added historical risk resolver using capability-aware guarded retrieval.
- Accepted context requires trusted decision-context ADR memory plus historical
  incident context.
- Current-PR modified ADRs are rejected for evidence-priority use through the
  existing trust policy and memory citation validator.
- Evidence Planner can add high-priority `browser_smoke` evidence for
  `/checkout` when trusted historical context requires it.
- Decision Engine remains deterministic:
  - selected required evidence failed -> `BLOCK`
  - high-risk missing existing evidence -> `WARN`
  - RAG-elevated missing browser smoke evidence -> `WARN`
  - docs-only -> `PASS`
- Added fixture `demo-rag-elevated-evidence`.
- Updated markdown report with historical risk context and missing browser
  evidence.
- Updated README with the v0.3 demo command and safety boundaries.

Commands run:
- `npm run test --workspace releaseguard -- ragEvidencePriority.test.ts realDiffMode.test.ts missingEvidenceFixture.test.ts decisionReport.test.ts`
- `npm run test --workspace releaseguard`
- `npm run build --workspace releaseguard`
- `npm run releaseguard -- memory index`
- `npm run releaseguard -- memory benchmark`
- `npm run releaseguard -- memory demo-discount-context`
- `npm run releaseguard -- run --fixture demo-discount-regression`
- `npm run releaseguard -- run --fixture demo-missing-evidence`
- `npm run releaseguard -- run --fixture demo-docs-only`
- `npm run releaseguard -- run --fixture demo-rag-elevated-evidence`
- `npm test`
- `npm run build --workspace @releaseguard/demo-app`
- `npm run releaseguard:selfcheck`
- `npm run test --workspace @releaseguard/demo-app`

Demo output:
- `npm run releaseguard -- run --fixture demo-rag-elevated-evidence`
- Decision: `WARN`
- Reason: `trusted repo memory raised evidence requirement, but required browser evidence is missing.`
- Report includes accepted historical risk context for `ADR 0007: Checkout
  Critical Flow` and `2024-08 Discount Validation Crash`.

Limitations:
- v0.3 does not implement a browser smoke executor.
- RAG-elevated missing browser smoke evidence produces `WARN`, not `BLOCK`.
- RAG evidence priority currently targets the demo checkout/discount storyline.
- No pgvector, live GitHub sync, GitHub App/OAuth, PR comments, Playwright
  browser flows, generated tests, OpenAPI diff, reranker, benchmark replay, or
  dashboard features were added.

Next:
- v0.4 can add a real checkout browser smoke executor. Until then, browser
  smoke remains a missing-evidence requirement.

## v0.3.1 Scanner Evaluation Tooling

Status: Done

Done:
- Added `npm run releaseguard -- scanner eval --root <repo_path>`.
- Scanner eval writes:
  - `.releaseguard/scanner_eval/<repo_name>/scanner_eval_report.md`
  - `.releaseguard/scanner_eval/<repo_name>/capability_graph.json` when scanning succeeds
  - `.releaseguard/scanner_eval/<repo_name>/unresolved_report.json`
- Unsupported repositories produce an `unsupported_framework` report instead of
  crashing.
- Added unresolved pattern classification:
  - `endpoint_constant`
  - `template_literal`
  - `axios_wrapper`
  - `trpc_client`
  - `graphql_operation`
  - `generated_client`
  - `dynamic_url`
  - `unknown_client_call`
  - `unsupported_framework`
- Added suggested override snippet generation for likely checkout/discount
  unresolved callsites.
- Updated README with a Scanner evaluation before Playwright section.

Tests run so far:
- `npm run test --workspace releaseguard -- scannerEval.test.ts scanner.test.ts cli.test.ts`
- `npm run build --workspace releaseguard`
- `npm run releaseguard -- scanner eval --root .`
- `npm run releaseguard -- scanner eval --root <unsupported-temp-repo>`
- `npm run test --workspace releaseguard`
- `npm run releaseguard -- memory index`
- `npm run releaseguard -- memory benchmark`
- `npm run releaseguard -- memory demo-discount-context`
- `npm run releaseguard -- run --fixture demo-discount-regression`
- `npm run releaseguard -- run --fixture demo-missing-evidence`
- `npm run releaseguard -- run --fixture demo-docs-only`
- `npm run releaseguard -- run --fixture demo-rag-elevated-evidence`
- `npm test`
- `npm run build --workspace @releaseguard/demo-app`
- `npm run releaseguard:selfcheck`
- `npm run test --workspace @releaseguard/demo-app`

Demo scanner eval output:
- Framework detected: `nextjs_app_router_typescript`
- Routes detected: `1`
- APIs detected: `1`
- Resolved callsites: `1`
- Unresolved callsites: `0`
- Unresolved rate: `0.0%`

Limitations:
- This is evaluation tooling, not broad scanner support for every framework.
- Suggested overrides are report snippets only and are not applied
  automatically.
- No Playwright browser flows, generated tests, GitHub App/OAuth, PR comments,
  OpenAPI diff, dashboard, or PASS/WARN/BLOCK semantic changes were added.

Next:
- Run scanner eval on 3-5 external repos and use unresolved rate plus pattern
  categories to decide whether the next milestone should be scanner expansion
  or browser execution.

## v0.3.2 Real Repo Scanner Evaluation Pack

Status: Done

Done:
- Added scanner eval runbook at `docs/scanner_eval/README.md`.
- Added scanner eval summary at `docs/scanner_eval/summary.md`.
- Added external repo scanner eval reports:
  - `docs/scanner_eval/reports/next-saas-starter-scanner-eval.md`
  - `docs/scanner_eval/reports/nextgram-scanner-eval.md`
  - `docs/scanner_eval/reports/full-stack-fastapi-template-scanner-eval.md`
- Updated README with scanner evaluation results and next-milestone
  recommendation.
- Excluded `docs/scanner_eval/**` from repo-memory indexing so scanner
  evaluation artifacts do not perturb the v0.2 RAG benchmark corpus.

Repositories evaluated:
- `leerob/next-saas-starter` at commit `6e33e58`
  - Framework: `nextjs_app_router_typescript`
  - Supported: yes
  - Routes: 8
  - APIs: 4
  - Resolved callsites: 0
  - Unresolved callsites: 2
  - Unresolved rate: `100.0%`
  - Top unresolved pattern: `dynamic_url`
- `vercel/nextgram` at commit `e74b346`
  - Framework: `nextjs_app_router_typescript`
  - Supported: yes
  - Routes: 3
  - APIs: 0
  - Resolved callsites: 0
  - Unresolved callsites: 0
  - Unresolved rate: `0.0%`
  - Top unresolved pattern: none
- `tiangolo/full-stack-fastapi-template` at commit `13652b5`
  - Framework: `unsupported_framework`
  - Supported: no
  - Routes: 0
  - APIs: 0
  - Resolved callsites: 0
  - Unresolved callsites: 1
  - Unresolved rate: `100.0%`
  - Top unresolved pattern: `unsupported_framework`

Commands run:
- `npm run releaseguard -- scanner eval --root /tmp/releaseguard-scanner-eval/next-saas-starter`
- `npm run releaseguard -- scanner eval --root /tmp/releaseguard-scanner-eval/nextgram`
- `npm run releaseguard -- scanner eval --root /tmp/releaseguard-scanner-eval/full-stack-fastapi-template`
- `npm run test --workspace releaseguard -- memory.test.ts`
- `npm run test --workspace releaseguard`
- `npm run build --workspace releaseguard`
- `npm run releaseguard -- scanner eval --root .`
- `npm run releaseguard -- memory index`
- `npm run releaseguard -- memory benchmark`
- `npm run releaseguard -- memory demo-discount-context`
- `npm run releaseguard -- run --fixture demo-discount-regression`
- `npm run releaseguard -- run --fixture demo-missing-evidence`
- `npm run releaseguard -- run --fixture demo-docs-only`
- `npm run releaseguard -- run --fixture demo-rag-elevated-evidence`
- `npm test`
- `npm run build --workspace @releaseguard/demo-app`
- `npm run releaseguard:selfcheck`
- `npm run test --workspace @releaseguard/demo-app`

Recommendation:
- v0.4 should prioritize scanner coverage expansion and override UX before
  Playwright browser execution.

Reason:
- The first supported real app with API routes had unresolved API dependency
  callsites because calls were hidden behind a shared dynamic fetcher. Browser
  execution would not solve route/API impact mapping.

Limitations:
- This pack uses three external snapshots, not a statistically significant
  benchmark.
- External repos were cloned outside this repository and not vendored.
- No Playwright browser flows, generated tests, GitHub App/OAuth, PR comments,
  OpenAPI diff, dashboard, or PASS/WARN/BLOCK semantic changes were added.
