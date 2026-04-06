# EatMe v1 — Project Documentation

EatMe is a food discovery platform built as a pnpm + Turborepo monorepo. The mobile app (React Native/Expo) enables consumers to discover dishes via map-based browsing, swipe-based preferences, and group dining coordination. The web portal (Next.js) serves restaurant owners managing menus and admins overseeing the platform. The backend runs on Supabase (PostgreSQL + PostGIS + pgvector) with Deno Edge Functions for AI-powered enrichment and feed generation.

## Quick Links

| # | Document | Description |
|---|----------|-------------|
| 1 | [Project Overview](./01-project-overview.md) | Architecture, monorepo structure, key concepts |
| 2 | [Tech Stack](./02-tech-stack.md) | Frameworks, libraries, and services used |
| 3 | [CLI Commands](./03-cli-commands.md) | All dev/build/deploy commands by workspace |
| 4 | [Web Portal](./04-web-portal.md) | Next.js restaurant owner and admin portal |
| 5 | [Mobile App](./05-mobile-app.md) | React Native/Expo consumer app |
| 6 | [Database Schema](./06-database-schema.md) | Tables, RLS policies, RPC functions |
| 7 | [Edge Functions](./07-edge-functions.md) | Deno edge functions (enrichment, feed, etc.) |
| 8 | [Environment Setup](./08-environment-setup.md) | Env vars, API keys, secrets management |
| 9 | [Deployment](./09-deployment.md) | Build and release pipelines |
| 10 | [Contributing](./10-contributing.md) | Code standards, PR workflow, conventions |
| 11 | [Troubleshooting](./11-troubleshooting.md) | Common issues and fixes |

## Workflows

| Workflow | Description |
|----------|-------------|
| [Authentication Flow](./workflows/auth-flow.md) | Email/OAuth sign-in for mobile and web |
| [Restaurant Onboarding](./workflows/restaurant-onboarding.md) | Owner registration, restaurant creation, verification |
| [Dish Creation & Enrichment](./workflows/dish-creation-enrichment.md) | Manual/scanned dish entry and AI enrichment pipeline |
| [Feed & Discovery](./workflows/feed-discovery.md) | Location-based candidate generation and ranking |
| [Eat Together](./workflows/eat-together.md) | Group dining session creation, invites, realtime sync |
| [Menu Management](./workflows/menu-management.md) | CRUD operations on menus and menu items |
| [Preference Learning](./workflows/preference-learning.md) | Swipe actions, preference vector updates |
| [Rating & Review](./workflows/rating-review.md) | Post-meal ratings and review submission |

## Getting Started

Recommended reading order:

1. [Project Overview](./01-project-overview.md) — understand what EatMe does and how it is structured
2. [Tech Stack](./02-tech-stack.md) — familiarize yourself with the tools and services
3. [Environment Setup](./08-environment-setup.md) — configure env vars and obtain API keys
4. [CLI Commands](./03-cli-commands.md) — start the dev servers and run builds
