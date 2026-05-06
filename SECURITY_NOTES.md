# Security Notes

ReleaseGuard v0.1 is a local demo vertical slice, not a deployed production service.

The demo app is pinned to Next.js 14.x to match the v0.1 scanner scope. `npm audit` may report advisories in the Next.js dependency tree. npm's current suggested fix upgrades to a newer Next.js major version, which is outside the v0.1 demo scanner target.

Before production use:

- Validate the scanner against the current supported Next.js major version.
- Reassess framework dependency advisories.
- Keep secrets and `.env` files out of any optional LLM prompts.
- Keep merge decisions deterministic and outside agent output.
