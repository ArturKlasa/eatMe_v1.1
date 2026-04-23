## 2026-04-23 — Step 14 complete

Owner app auth pages, sign-in/sign-up, DAL wire-up, /onboard skeleton.

All code was already written in prior iteration (untracked). Issues found and fixed:
- `SignInForm.tsx` lines 112/120: `startTransition` callbacks returned `ActionResult` instead of `void` — wrapped with `async () => { await ... }` to satisfy TypeScript's `VoidOrUndefinedOnly` constraint.
- `src/middleware.ts` (deprecated Next.js 16 convention) caused Turbopack build failure because `config` was re-exported. Replaced with `src/proxy.ts` that defines `proxy` function and `config` inline — no re-exports.

Gates passed: typecheck ✓, vitest 23/23 ✓, `turbo build --filter web-portal-v2` ✓
