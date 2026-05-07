# Scanner Eval: full-stack-fastapi-template

Source: `https://github.com/tiangolo/full-stack-fastapi-template`
Snapshot commit: `13652b5`

## Result

| Metric | Value |
|---|---:|
| Framework detected | `unsupported_framework` |
| Supported | no |
| Scanned files | 0 |
| Detected routes | 0 |
| Detected APIs | 0 |
| Detected test nodes | 0 |
| Detected frontend-to-API callsites | 1 unsupported-framework marker |
| Resolved callsites | 0 |
| Unresolved callsites | 1 |
| Unresolved rate | 100.0% |

## Detected Routes

- None

## Detected APIs

- None

## Resolved Callsites

- None

## Unresolved Callsites

- `unsupported_framework`: repository is a FastAPI/backend template outside the
  current Next.js App Router scanner scope.

## Top Unresolved Patterns

- `unsupported_framework`: 1

## Suggested Overrides

- None generated.

## Notes

The scanner eval command correctly fails safe for unsupported frameworks by
producing an explicit report instead of crashing or pretending the repo is
covered. FastAPI support would require a separate backend scanner rather than
small tweaks to the current Next.js scanner.

