# Industry Best Practices Research (April 2026)

## 1. AI-Friendly Codebase Conventions

### Code Health as a Prerequisite
Per [CodeScene's research](https://codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality), AI agents perform best on **healthy code** — target Code Health of 9.5+/10. Unhealthy code (large functions, deep nesting, high complexity) causes agents to fail tasks or waste tokens. The recommended workflow: **review → plan → refactor → re-measure**.

> "Speed amplifies both good design and bad decisions."

### Make Tacit Knowledge Explicit
Per [Stack Overflow](https://stackoverflow.blog/2026/03/26/coding-guidelines-for-ai-agents-and-people-too/), AI agents can't absorb context implicitly like human engineers. You must document:
- **Naming conventions** — consistent patterns (camelCase vs underscore), prevent redundant names
- **Exception/logging strategies** — where and how to handle errors
- **Configuration vs code separation**
- **The "why" behind every guideline** — not just rules, but reasoning

### Concrete Examples Over Abstract Rules
- Include both correct AND incorrect implementations in guidelines
- Create a **"gold standard" reference file** showing code following all conventions
- Test whether examples work better standalone or with a reference file

### AGENTS.md / CLAUDE.md as Central Hub
Create a checked-in documentation file that:
- Encodes intended sequencing and decision logic
- Transforms individual safeguards into coherent workflows
- Stays open for team dialogue and updates

## 2. CLAUDE.md Best Practices

### Structure ([Dometrain](https://dometrain.com/blog/creating-the-perfect-claudemd-for-claude-code/), [HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md))

**Recommended sections:**
1. **Project Overview** — what the project does, its purpose
2. **Tech Stack** — frameworks, languages, key dependencies
3. **Terminal Commands** — build, test, lint, deploy commands with flags
4. **Workflows** — step-by-step procedures for common tasks (e.g., adding an API endpoint)
5. **Coding Standards** — naming, indentation, commit message format
6. **Architecture** — file organization, design patterns, where things go
7. **Terminology** — domain-specific jargon and business terms
8. **MCP Instructions** — how to use configured MCP servers

### Key Principles
- **Target under 200 lines** (HumanLayer's own is <60 lines)
- **Less is more** — frontier LLMs can follow ~150-200 instructions consistently; Claude Code's system prompt already uses ~50
- **Never send an LLM to do a linter's job** — use ESLint/Prettier for code style, not CLAUDE.md
- **Prefer pointers to copies** — reference `file:line` instead of pasting code snippets
- **Progressive disclosure** — create `agent_docs/` with separate files for building, testing, conventions, schema; reference from CLAUDE.md

### Anti-Patterns
- Auto-generating without review
- Including secrets or connection strings
- Duplicating instructions that exist elsewhere
- Task-specific details (only universally applicable content)
- Overly verbose explanations

## 3. Refactoring Best Practices

### Incremental Over Big-Bang ([FreeCodeCamp](https://www.freecodecamp.org/news/how-to-refactor-complex-codebases), [Graphite](https://graphite.dev/guides/refactoring-code-best-practices))
- Refactor continuously as part of regular development
- Small, incremental changes reduce bug risk
- Use feature time reduction as the productivity metric
- **Developers spend up to 42% of time on technical debt** without regular refactoring

### Quality Gates for AI-Generated Code ([CodeScene](https://codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality))
Three-level safeguarding:
1. **Continuous review** during generation
2. **Pre-commit safeguards** on uncommitted files
3. **Pre-flight checks** before PRs

### Code Coverage as Behavioral Guardrail
- Strict coverage gates on PRs prevent weakening behavioral checks
- Unit tests validate local behavior; **end-to-end tests** validate full systems
- Coverage thresholds should stay high as a regression signal

## 4. Addy Osmani's LLM Workflow ([Blog](https://addyosmani.com/blog/ai-coding-workflow/))

### Spec-First Development
1. Create `spec.md` with requirements, architecture, data models, testing strategy
2. Create a project plan breaking work into bite-sized milestones
3. Maintain CLAUDE.md with process rules, style prefs, conventions

### Context Management
- Provide extensive context upfront: code sections, API docs, constraints, pitfalls
- Selectively include only task-relevant portions (respect token limits)
- Break work into small iterative chunks — avoid monolithic requests

### Commit Discipline
- Commit frequently after small tasks
- Use branches/worktrees to isolate AI experiments
- Treat commits as save points

## 5. TypeScript Monorepo Specifics

### Shared Package Best Practices
- **Explicit return types** on shared package functions — don't make consumers guess
- **Named types/interfaces** for complex types — promote reuse and clarity
- Export cleanly with clear boundaries
- Use workspace protocol for internal dependencies

### Linting & CI
- TypeScript-ESLint safety rules: `no-unsafe-*`, `no-floating-promises`
- Run lint and typecheck in CI with `--noEmit`
- Use `eslint-plugin-jsdoc` for documentation enforcement

### JSDoc in TypeScript
- Document all exported functions with `@param`, `@returns`, `@throws`
- Document non-obvious internal functions
- Focus on **branches and conditions** for coverage, not just lines
- JSDoc doubles as IDE tooltips and generated API docs

## 6. Summary: What eatMe Should Adopt

### Already Strong (Keep)
- Strict TypeScript, path aliases, consistent patterns
- `.github/copilot-instructions.md` (exceptional)
- Service layer separation, Zustand stores
- Prettier + ESLint in CI

### Should Add
1. **CLAUDE.md** — concise (<200 lines), referencing agent_docs/ for details
2. **Quality gates** — pre-commit hooks checking Code Health metrics
3. **JSDoc enforcement** — `eslint-plugin-jsdoc` on all exports
4. **Shared packages** — extract constants, types, validation to `@eatme/constants`
5. **End-to-end tests** — at least for critical paths
6. **Gold standard files** — example files showing ideal patterns for each app
7. **Domain terminology** — document business terms (dish categories, rating system, etc.)

### Should Change
1. **Split oversized files** — expand AI-ready surface area
2. **Remove dead code** — console.logs, unused deps, commented blocks
3. **Centralize validation** — single source of truth for Zod schemas
4. **Add mobile tests** — currently zero test coverage
