# Idea Honing: Project Documentation

Requirements clarification Q&A for the comprehensive EatMe v1 documentation project.

---

## Q1: Who is the primary audience for this documentation?

For example:
- **Developers** joining the team who need to understand the codebase and get productive quickly
- **Stakeholders/investors** who need to understand the product vision and technical capabilities
- **Both** — developer-focused but with a high-level overview accessible to non-technical readers
- **Other** — please describe

**A1:** Developers — the documentation targets developers joining the team who need to understand the codebase and become productive quickly.

---

## Q2: Where should the documentation files live?

Some options:
- **`/docs/`** — the existing docs directory at the project root
- **`/docs/project/`** — a dedicated subdirectory within docs
- **A new top-level directory** like `/documentation/`
- **Other** — please specify

**A2:** `/docs/project/` — a dedicated subdirectory within the existing docs folder.

---

## Q3: For the workflow diagrams, should we document only the current implemented workflows, or also planned/future workflows?

From what I can see, the app has workflows like:
- User authentication (email + OAuth)
- Restaurant onboarding (web portal)
- Dish creation & enrichment (AI-powered)
- Feed/discovery (swipe-based preference learning)
- "Eat Together" group recommendation sessions
- Menu management
- User preference vector updates

Should the documentation:
- **Current only** — document what's implemented today
- **Current + planned** — include future features (e.g., reviews, social sharing, notifications) marked as planned
- **Other** — please specify

**A3:** Current only — document what's actually implemented today. No planned/future features.

---

## Q4: Should there be a root index file (e.g., `README.md`) in `/docs/project/` that links to all the individual documentation files and provides a quick navigation overview?

**A4:** Yes — include a `README.md` index file with links to all documentation files.

---

## Q5: For the database schema documentation, how deep should we go?

Options:
- **High-level** — tables, their purpose, and relationships (ER diagram)
- **Detailed** — tables, all columns with types, constraints, indexes, RLS policies, RPC functions, and triggers
- **Something in between** — tables with key columns, relationships, and RLS policies, but skip minor details like every index

**A5:** As detailed as possible based on what's available in the codebase, but leave clearly marked placeholders (e.g., `<!-- TODO: ... -->` or a "Missing Information" section) for anything that can't be derived from the current code. This applies across all documentation files, not just the database schema.

---

## Q6: For the edge functions documentation, should we include example request/response payloads, or just describe the function's purpose, parameters, and algorithm?

**A6:** Yes — include example request/response payloads alongside the function's purpose, parameters, and algorithm description.

---

## Q7: What format do you prefer for the Mermaid diagrams in workflow documentation?

Options:
- **Flowcharts** (`graph TD`) — boxes and arrows showing step-by-step flows
- **Sequence diagrams** (`sequenceDiagram`) — showing interactions between actors/systems over time
- **Mix** — use whichever diagram type best fits each workflow (e.g., sequence diagrams for API interactions, flowcharts for user journeys)
- **Other** — please specify

**A7:** Sequence diagrams (`sequenceDiagram`) — showing interactions between actors and systems over time.

---

## Q8: Should the documentation files use any specific naming convention?

For example:
- **Descriptive numbered kebab-case** — `01-project-overview.md`, `02-tech-stack.md`, etc. (numbered for reading order)
- **Simple kebab-case** — `project-overview.md`, `tech-stack.md`, `cli-commands.md` (no numbering, the README index provides navigation)
- **Other preference**

**A8:** Numbered kebab-case for clear reading order: `01-project-overview.md`, `02-tech-stack.md`, `03-cli-commands.md`, `04-web-portal.md`, `05-mobile-app.md`, `06-database-schema.md`, `07-edge-functions.md`, `08-workflows.md`. The README index will also link them all.

---

## Q9: Do you want the workflows documentation to be a single file covering all workflows, or should it be split into separate files (e.g., `workflows/auth-flow.md`, `workflows/feed-discovery.md`, `workflows/eat-together.md`)?

**A9:** Split into separate files — one file per workflow, organized in a `workflows/` subdirectory within `/docs/project/`.

---

## Q10: Is there anything else you'd like included in the documentation that we haven't covered?

For example:
- Environment variables & secrets setup guide
- Deployment instructions (EAS builds, Supabase deployment)
- Contributing guidelines
- Troubleshooting / known issues
- Or anything else?

**A10:** Yes — include all of the above:
- Environment variables & secrets setup guide
- Deployment instructions (EAS builds, Supabase deployment)
- Contributing guidelines
- Troubleshooting / known issues

These will be additional documentation files in the same `/docs/project/` directory.
