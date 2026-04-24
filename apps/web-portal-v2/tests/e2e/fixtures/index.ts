/**
 * Shared E2E fixtures for web-portal-v2 gold-path suites.
 *
 * - createAuthedBrowser   — authenticated browser context (owner or admin role)
 * - seedRestaurant        — service-role insert tagged with TEST_RUN_ID for cleanup
 * - resetDb               — truncates rows seeded by this run (never touches prod)
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + E2E_SERVICE_ROLE_KEY for DB operations.
 */

import type { Browser, BrowserContext, Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/** Unique per invocation; pass TEST_RUN_ID=<id> to override (CI sets this per shard). */
export const TEST_RUN_ID = process.env.TEST_RUN_ID ?? `run-${Date.now()}`;
export const E2E_TAG = `e2e-${TEST_RUN_ID}`;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.E2E_SERVICE_ROLE_KEY ?? '';
  if (!url || !key)
    throw new Error('E2E_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL are required for fixture ops');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Sign up a new owner and return the signed-in context + page. */
export async function createOwnerBrowser(
  browser: Browser,
  email: string,
  password: string
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel(/confirm/i).fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  return { context, page };
}

/** Sign in as admin and return the signed-in context + page. Requires E2E_ADMIN_EMAIL/PASSWORD. */
export async function createAdminBrowser(
  browser: Browser
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/signin');
  await page.fill('input[type="email"]', process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com');
  await page.fill('input[type="password"]', process.env.E2E_ADMIN_PASSWORD ?? 'password');
  await page.click('button[type="submit"]');
  return { context, page };
}

/** Returns a tag-prefixed email unique per test. */
export function taggedEmail(label: string): string {
  return `test+${E2E_TAG}-${label}-${Math.floor(Math.random() * 9999)}@example.com`;
}

/**
 * Insert a draft restaurant via service-role client.
 * Name is prefixed with E2E_TAG so resetDb() can delete it.
 */
export async function seedRestaurant(opts: { name?: string; ownerId: string }): Promise<string> {
  const client = serviceClient();
  const name = opts.name ?? `${E2E_TAG}-restaurant`;
  const { data, error } = await client
    .from('restaurants')
    .insert({
      name,
      owner_id: opts.ownerId,
      status: 'draft',
      allergens: [],
      dietary_tags: [],
    })
    .select('id')
    .single();
  if (error) throw new Error(`seedRestaurant: ${error.message}`);
  return data.id as string;
}

/**
 * Delete all rows seeded by this run (restaurants whose name starts with E2E_TAG).
 * Safe to call repeatedly; cascades via FK to menus/dishes.
 */
export async function resetDb(): Promise<void> {
  if (!process.env.E2E_SERVICE_ROLE_KEY) return;
  const client = serviceClient();
  await client.from('restaurants').delete().like('name', `${E2E_TAG}%`);
}
