# Scanner Eval Summary

ReleaseGuard v0.3.2 uses scanner eval reports to validate the Capability Graph
assumption before adding browser execution.

## Repositories Evaluated

| Repo | Framework | Supported | Routes | APIs | Resolved callsites | Unresolved callsites | Unresolved rate | Top unresolved patterns |
|---|---|---:|---:|---:|---:|---:|---:|---|
| `leerob/next-saas-starter` | `nextjs_app_router_typescript` | yes | 8 | 4 | 0 | 2 | 100.0% | `dynamic_url` |
| `vercel/nextgram` | `nextjs_app_router_typescript` | yes | 3 | 0 | 0 | 0 | 0.0% | none |
| `tiangolo/full-stack-fastapi-template` | `unsupported_framework` | no | 0 | 0 | 0 | 1 | 100.0% | `unsupported_framework` |

Reports:

- [next-saas-starter](./reports/next-saas-starter-scanner-eval.md)
- [nextgram](./reports/nextgram-scanner-eval.md)
- [full-stack-fastapi-template](./reports/full-stack-fastapi-template-scanner-eval.md)

## What The Scanner Handles Well

- Next.js App Router `page.tsx` route detection works on repos outside the demo
  app.
- Next.js App Router `app/api/**/route.ts` API detection works for exported
  route handlers.
- Unsupported frameworks are reported explicitly instead of crashing.
- Scanner eval produces measurable unresolved rates and top unresolved
  categories.

## What The Scanner Fails On

- Shared fetcher wrappers such as `const fetcher = (url) => fetch(url)` are not
  resolved.
- The current direct literal scanner does not trace API endpoint values through
  SWR or local fetch helper calls.
- Backend-only frameworks such as FastAPI are outside the current scanner
  scope.
- Route-only apps can look clean by unresolved rate while still not exercising
  API dependency coverage.

## Recommendation

v0.4 should prioritize scanner coverage expansion and override UX before a
Playwright browser runner.

Reason: the first supported real app with API routes had `100.0%` unresolved
frontend-to-API callsites because API calls were hidden behind a dynamic fetcher
wrapper. A browser runner would not fix the core question of which route/API
capability changed or which evidence should run.

## Top Scanner Improvements By Expected ROI

1. Resolve simple local fetcher wrappers and SWR-style calls where a string
   endpoint is passed to a known wrapper.
2. Add endpoint-constant tracing for flat string constants used in API calls.
3. Add an evidence/override declaration protocol so users can confirm
   unresolved dependencies without hand-writing a large YAML config.

## Next Milestone Decision

Do not add Playwright yet. Use v0.4 for scanner coverage expansion and override
suggestion UX, then reevaluate whether the unresolved rate for supported Next.js
repos is low enough to justify browser evidence execution.

