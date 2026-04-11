# AI-Friendliness Assessment

## Scorecard

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Organization | 5/5 | Clear hierarchy, barrel exports, shared packages |
| Naming | 5/5 | Descriptive, no abbreviations, consistent |
| Module Boundaries | 4.5/5 | Service layer excellent; 3 oversized components |
| Type Definitions | 5/5 | Strong typing, minimal `any`, tracked improvement plan |
| AI Guidance | 5/5 | Exceptional `.github/copilot-instructions.md` |
| Code Patterns | 5/5 | Highly consistent across codebase |
| File Sizing | 4/5 | Most well-sized; 3 candidates for refactoring |
| Imports | 5/5 | Path aliases throughout, no traversal mess |

**Verdict:** Already a well-structured, AI-friendly codebase. Key improvements are targeted.

## Existing AI Documentation

`.github/copilot-instructions.md` (333 lines) covers:
- Architecture & data flow
- Development commands
- Project-specific conventions
- Common pitfalls and debugging tips
- File location reference (points to `database_schema.sql` as authoritative source)

## Improvement Opportunities

### Oversized Files to Split

| File | Lines | Recommendation |
|------|-------|----------------|
| `useMenuScanState.ts` | 1,378 | Split into 4-5 smaller hooks |
| `MenuScanReview.tsx` | 1,265 | Extract sub-components |
| `RestaurantDetailScreen.tsx` | 1,003 | Split by feature area |

### Missing

- No `CLAUDE.md` (for Claude Code specifically)
- No `CONTRIBUTING.md` for onboarding
- copilot-instructions.md could be expanded with refactoring conventions

### Already Strong

- Path aliases (`@/`) used consistently in both apps
- Barrel exports in mobile for clean imports
- Service layer separation
- Consistent error handling pattern: `console.error('[ComponentName] message')` + try-catch + toast
- React Hook Form + Zod everywhere for forms
- Zustand stores in mobile (centralized state)
