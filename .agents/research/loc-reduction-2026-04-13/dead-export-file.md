# LOC-01: dead-export-file — Remove entirely unused `lib/export.ts`

## Current state

`apps/web-portal/lib/export.ts:1-157` exports three functions:
- `exportAsJSON` (line 18)
- `exportAsCSV` (line 75)
- `downloadCSVTemplate` (line 124)

Plus a private helper `escapeCSV` (line 114).

The file's own header comment (line 1-10) explicitly states these are "NOT YET wired to any UI button" and are "intended for a future Export feature."

## Proposed reduction

Delete the entire file `apps/web-portal/lib/export.ts` (157 lines).

No replacements needed — nothing imports from this file.

## Estimated LOC savings

157

## Risk assessment

**Functionality is preserved because nothing uses this code.**

Call-site search results:
- `grep -rn 'exportAsJSON\|exportAsCSV\|downloadCSVTemplate'` across all `*.ts,*.tsx,*.js,*.jsx` files: only matches are declarations and comments within `export.ts` itself.
- `grep -rn "from.*lib/export"` across all files: zero matches outside the file.
- No barrel file re-exports this module.

The file header explicitly documents this as pre-built code for a future feature that was never wired up. Removing it has zero runtime or compile-time impact.

If the export feature is needed later, it can be recreated or recovered from git history.

## Decision: apply

Safe to implement. Zero side effects — the file is completely unreferenced dead code.
