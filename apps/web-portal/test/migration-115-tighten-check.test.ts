import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Static validation for migration 115.
//
// The migration cannot be smoke-run here (requires a live Supabase instance),
// so these tests validate the structural guarantees:
//   1. The DO $$ guard is present and queries the right field.
//   2. The RAISE EXCEPTION fires when legacy rows exist (guard condition correct).
//   3. The ADD CONSTRAINT targets exactly the 5 canonical kind values.
//   4. The file has the mandatory "Do NOT run before" header comment.
//
// Complement these with a manual `supabase db reset` + seed-and-run smoke test
// when a local Supabase instance is available (see plan.md Step 6 demo criteria).
// ---------------------------------------------------------------------------

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../infra/supabase/migrations/115_tighten_dish_kind_check.sql'
);

function sql(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

const CANONICAL_KINDS = ['standard', 'bundle', 'configurable', 'course_menu', 'buffet'] as const;
const LEGACY_KINDS = ['template', 'experience', 'combo'] as const;

describe('migration 115 — tighten dish_kind CHECK', () => {
  it('file exists', () => {
    expect(() => sql()).not.toThrow();
  });

  it('includes the operational gating header comment', () => {
    const content = sql();
    expect(content).toContain('Do NOT run before');
    expect(content).toContain('triage');
  });

  it('contains DO $$ guard block', () => {
    const content = sql();
    expect(content).toContain('DO $$');
    expect(content).toMatch(/RAISE EXCEPTION.*legacy kinds/);
  });

  it('guard queries dish_kind NOT IN the 5 canonical values', () => {
    const content = sql();
    // The guard must check for rows outside the canonical set
    for (const kind of CANONICAL_KINDS) {
      expect(content).toContain(`'${kind}'`);
    }
    expect(content).toContain('NOT IN');
  });

  it('guard raises when n > 0 (condition present)', () => {
    const content = sql();
    expect(content).toContain('IF n > 0');
    expect(content).toContain('RAISE EXCEPTION');
  });

  it('drops the old relaxed constraint before adding the tightened one', () => {
    const content = sql();
    const dropIdx = content.indexOf('DROP CONSTRAINT IF EXISTS dishes_dish_kind_check');
    const addIdx = content.indexOf('ADD CONSTRAINT dishes_dish_kind_check');
    expect(dropIdx).toBeGreaterThan(-1);
    expect(addIdx).toBeGreaterThan(-1);
    // DROP must come before ADD
    expect(dropIdx).toBeLessThan(addIdx);
  });

  it('ADD CONSTRAINT includes all 5 canonical kind values', () => {
    const content = sql();
    // Find the ADD CONSTRAINT block
    const addStart = content.indexOf('ADD CONSTRAINT dishes_dish_kind_check');
    expect(addStart).toBeGreaterThan(-1);
    const constraintBlock = content.slice(addStart, content.indexOf(';', addStart) + 1);
    for (const kind of CANONICAL_KINDS) {
      expect(constraintBlock).toContain(`'${kind}'`);
    }
  });

  it('ADD CONSTRAINT does NOT include legacy kind values', () => {
    const content = sql();
    const addStart = content.indexOf('ADD CONSTRAINT dishes_dish_kind_check');
    const constraintBlock = content.slice(addStart, content.indexOf(';', addStart) + 1);
    for (const kind of LEGACY_KINDS) {
      expect(constraintBlock).not.toContain(`'${kind}'`);
    }
  });

  it('is wrapped in a transaction (BEGIN / COMMIT)', () => {
    const content = sql();
    expect(content).toContain('BEGIN;');
    expect(content).toContain('COMMIT;');
  });

  it('guard DO block is inside the transaction (before COMMIT)', () => {
    const content = sql();
    const beginIdx = content.indexOf('BEGIN;');
    const guardIdx = content.indexOf('DO $$');
    const commitIdx = content.lastIndexOf('COMMIT;');
    expect(guardIdx).toBeGreaterThan(beginIdx);
    expect(guardIdx).toBeLessThan(commitIdx);
  });
});
