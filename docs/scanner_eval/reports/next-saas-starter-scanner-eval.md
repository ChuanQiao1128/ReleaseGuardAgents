# Scanner Eval: next-saas-starter

Source: `https://github.com/leerob/next-saas-starter`
Snapshot commit: `6e33e58`

## Result

| Metric | Value |
|---|---:|
| Framework detected | `nextjs_app_router_typescript` |
| Supported | yes |
| Scanned files | 41 |
| Detected routes | 8 |
| Detected APIs | 4 |
| Detected test nodes | 0 |
| Detected frontend-to-API callsites | 2 |
| Resolved callsites | 0 |
| Unresolved callsites | 2 |
| Unresolved rate | 100.0% |

## Detected Routes

- `route_dashboard_activity`: `/dashboard/activity`
- `route_dashboard_general`: `/dashboard/general`
- `route_dashboard`: `/dashboard`
- `route_dashboard_security`: `/dashboard/security`
- `route_root`: `/`
- `route_pricing`: `/pricing`
- `route_sign_in`: `/sign-in`
- `route_sign_up`: `/sign-up`

## Detected APIs

- `api_checkout_stripe`: `GET /api/stripe/checkout`
- `api_webhook_stripe`: `POST /api/stripe/webhook`
- `api_team`: `GET /api/team`
- `api_user`: `GET /api/user`

## Resolved Callsites

- None

## Unresolved Callsites

- `dynamic_url`: `app/(dashboard)/dashboard/general/page.tsx:14`
  - `const fetcher = (url: string) => fetch(url).then((res) => res.json());`
- `dynamic_url`: `app/(dashboard)/dashboard/page.tsx:28`
  - `const fetcher = (url: string) => fetch(url).then((res) => res.json());`

## Top Unresolved Patterns

- `dynamic_url`: 2

## Suggested Overrides

- None generated.

## Notes

The scanner detects App Router routes and route handlers, but does not resolve
shared fetcher wrappers such as `fetcher(url)`. The next scanner improvement
with the highest ROI for this repo is simple wrapper and call-argument tracing
for local fetcher utilities.

