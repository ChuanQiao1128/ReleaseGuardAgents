# Scanner Eval Summary

ReleaseGuard v0.3.2 uses scanner eval reports to validate the Capability Graph
assumption before adding browser execution.

v0.5 adds universal file/module/package fallback resolution. Unsupported
frameworks are still unsupported at route/API precision, but they now produce
file role counts and resolution level distributions instead of only an
unsupported marker.

## Repositories Evaluated

| Repo | Framework | Supported | Routes | APIs | Resolved callsites | Unresolved callsites | Unresolved rate | Top unresolved patterns |
|---|---|---:|---:|---:|---:|---:|---:|---|
| `leerob/next-saas-starter` | `nextjs_app_router_typescript` | yes | 8 | 4 | 4 | 0 | 0.0% | none |
| `vercel/nextgram` | `nextjs_app_router_typescript` | yes | 3 | 0 | 0 | 0 | 0.0% | none |
| `tiangolo/full-stack-fastapi-template` | `unsupported_framework` | no | 0 | 0 | 0 | 1 | 100.0% | `unsupported_framework` |

## Universal Impact Snapshot

| Repo | File roles detected | Module nodes | Package nodes | Universal fallback nodes | Framework capability nodes |
|---|---:|---:|---:|---:|---:|
| `leerob/next-saas-starter` | yes | 4 | 1 | 60 | 12 |
| `vercel/nextgram` | yes | 2 | 1 | 16 | 3 |
| `tiangolo/full-stack-fastapi-template` | yes | 9 | 4 | 246 | 0 |

## Resolution Level Snapshot

| Repo | L0 File | L1 Module/Package | L3 Framework | L4 Test | L5 Declared |
|---|---:|---:|---:|---:|---:|
| `leerob/next-saas-starter` | 55 | 1 | 12 | 0 | 0 |
| `vercel/nextgram` | 13 | 1 | 3 | 0 | 0 |
| `tiangolo/full-stack-fastapi-template` | 233 | 4 | 0 | 0 | 0 |

Reports:

- [next-saas-starter](./reports/next-saas-starter-scanner-eval.md)
- [nextgram](./reports/nextgram-scanner-eval.md)
- [full-stack-fastapi-template](./reports/full-stack-fastapi-template-scanner-eval.md)

## What The Scanner Handles Well

- Next.js App Router `page.tsx` route detection works on repos outside the demo
  app.
- Next.js App Router `app/api/**/route.ts` API detection works for exported
  route handlers.
- v0.4 resolves simple local fetcher wrappers and SWR literals such as
  `useSWR<T>("/api/user", fetcher)`.
- v0.4 resolves flat endpoint constants used directly in `fetch(...)` or
  simple local fetcher calls.
- Unsupported frameworks are reported explicitly instead of crashing.
- Scanner eval produces measurable unresolved rates and top unresolved
  categories.

## What The Scanner Fails On

- Complex fetcher wrappers, imported API clients, and multi-hop endpoint
  factories remain out of scope.
- Axios wrappers, tRPC, GraphQL operations, generated clients, OpenAPI clients,
  and dynamic URL construction remain unresolved.
- Backend-only frameworks such as FastAPI are outside the current scanner
  scope.
- v0.5 maps unsupported repos to file/module/package-level context, but it does
  not infer FastAPI route decorators yet.
- Route-only apps can look clean by unresolved rate while still not exercising
  API dependency coverage.

## Recommendation

v0.4 has addressed the highest-ROI issue from the first supported real app:
simple local fetcher/SWR route-to-API dependency resolution.

v0.5 changed unsupported repo behavior from a binary unsupported marker to a
file/module/package impact report. The FastAPI template still has no route/API
precision, but it now exposes 111 source files, 30 test files, 9 module nodes,
and 4 package nodes that can support fail-safe impact reporting.

The next milestone should prioritize coverage ingestion before Playwright.
Coverage is more language-agnostic than browser execution and can answer
whether tests touched changed files even when route/API adapters are missing.
Playwright should remain scoped to supported Next.js repos after scanner eval
shows route/API mapping is explainable.

## Top Scanner Improvements By Expected ROI

1. Add coverage for imported API client wrappers and common axios helper
   patterns.
2. Add endpoint-constant tracing across imports for flat exported constants.
3. Expand evidence/override declaration protocols so users can confirm
   unresolved dependencies without hand-writing a large YAML config.

## Next Milestone Decision

Use v0.6 for coverage ingestion providers such as LCOV and Cobertura. Defer a
Playwright/browser smoke pilot until scanner eval plus coverage can explain
which route/API or file/module impact needs browser evidence.
