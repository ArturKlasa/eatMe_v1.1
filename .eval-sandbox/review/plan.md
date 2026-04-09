# Review Plan: EatMe Monorepo Audit

## Step 1: Primary Pass ✅ (current)
- Scope identification and file tree mapping
- Identify highest-risk security concerns
- Initial findings in `findings.md`

## Step 2: Deep Analysis — Database Schema & RLS Policy Reconciliation ✅
- Read all migration files to reconstruct complete RLS policy map
- Identify tables with RLS enabled but no policies (true deny-all vs intentional)
- Map every trigger and function from migrations
- Cross-reference schema snapshot against actual migrations for completeness
- Produce material for `database-schema.md` documentation
- **Result:** 6 findings (2 CRITICAL, 1 HIGH, 2 MEDIUM, 1 LOW) — see findings.md

## Step 3: Deep Analysis — Web Portal & Mobile App Feature Audit ✅
- Read all web-portal components, routes, services
- Read all mobile screens, stores, services, navigation
- Map implemented vs documented features
- Identify dead code, type gaps, error handling issues

## Step 4: Deep Analysis — Documentation Staleness Audit ✅
- Read every file in `docs/`, `docs/workflows/`, `docs/todos/`
- Cross-reference claims against actual codebase
- Produce material for `docs-audit.md`
- **Task:** task-1775345125-1095 (key: review:step-04:docs-audit)
- **Result:** 23 findings (D-001–D-023): 4 HIGH, 8 MEDIUM, 11 LOW. Also corrected F-002 → RESOLVED (migration 043 already fixed it).

## Final Step: Synthesis & Report Writing (current)
- Read all findings from Steps 1-4 in `findings.md`
- Produce final report at `.agents/review/report.md` grouped by Critical/High/Medium/Low/Informational
- **Task:** task-1775656695-e02e (key: review:step-final:synthesis)
