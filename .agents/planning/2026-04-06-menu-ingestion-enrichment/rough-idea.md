# Rough Idea: Menu Ingestion & Enrichment Improvements

## Problem
The current restaurant onboarding, menu/dish ingestion, and dish enrichment flows need review and improvement. They should better support the universal dish patterns defined in the prior planning initiative (2026-04-05-universal-dish-structure).

## Focus Areas

### 1. Restaurant Onboarding & Menu Ingestion (General)
Review the full onboarding wizard (basic-info → menu → review) and identify improvements for dish creation that align with the expanded dish structure (parent-child variants, dish_kind types, option groups, etc.).

### 2. Menu Scan (Primary Focus)
"Upload photos of a restaurant menu — AI extracts the dishes for you to review."

Current state:
- GPT-4o Vision extracts menus from 1–20 uploaded images
- Results are merged across pages, enriched with ingredient matching (alias DB + GPT-4o-mini translation)
- Admin reviews and edits extracted dishes before committing to DB
- Supports: dish_kind detection, parent-child variant detection, dietary hints, spice level, raw ingredient extraction
- Known limitations: token truncation on large menus, no multi-pass extraction, ingredient translation not cached, limited variant detection heuristics

Goals: Improve extraction accuracy, better pattern detection for all dish kinds, handle edge cases (large menus, multi-language), improve the admin review UX.

### 3. Dish Enrichment
Current state:
- Triggered by DB webhook on dish INSERT/UPDATE
- Evaluates completeness (complete/partial/sparse based on ingredient count)
- Calls GPT-4o-mini to infer ingredients + dish type for incomplete dishes
- Builds embedding_input string, generates 1536-dim vector via text-embedding-3-small
- Tracks confidence (high/medium/low) and source (ai/none/manual)
- AI-inferred allergens stored in enrichment_payload but never auto-applied

Goals: Review and improve enrichment quality, consider richer embedding inputs, batch processing, cost optimization, and whether AI-inferred data should be more actively used.

## Context
- Universal dish patterns: standard, customizable, template/matrix, build-your-own, variant, combo/set, experience, small plates, specials/dynamic, group/bulk, add-ons/sides
- Parent-child variant model already implemented in migration 073
- Dish kinds: standard, template, experience, combo
- Option groups support single/multiple/quantity selection types
