import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import { noUnwrappedAction } from './no-unwrapped-action.js';

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

describe('no-unwrapped-action', () => {
  it('passes and fails on correct fixtures', () => {
    tester.run('no-unwrapped-action', noUnwrappedAction, {
      valid: [
        // Wrapped with withAuth
        {
          code: `export const saveRestaurant = withAuth(async (ctx, input) => {});`,
        },
        // Wrapped with withAdminAuth
        {
          code: `export const deleteRestaurant = withAdminAuth(async (ctx, id) => {});`,
        },
        // Wrapped with withPublic
        {
          code: `export const signIn = withPublic(async (ctx, input) => {});`,
        },
        // Wrapped with withAuthRoute
        {
          code: `export const GET = withAuthRoute(async (ctx, req) => { return new Response('ok'); });`,
        },
        // Wrapped with withAdminAuthRoute
        {
          code: `export const POST = withAdminAuthRoute(async (ctx, req) => { return new Response('ok'); });`,
        },
        // Wrapped with withPublicRoute
        {
          code: `export const GET = withPublicRoute(async (ctx, req) => { return new Response('ok'); });`,
        },
        // Re-exports from another module are allowed (we can't introspect the source)
        {
          code: `export { savedAction } from './saved';`,
        },
        // Next.js segment config exports are exempt
        { code: `export const runtime = 'edge';` },
        { code: `export const dynamic = 'force-dynamic';` },
        { code: `export const revalidate = 60;` },
        { code: `export const fetchCache = 'force-no-store';` },
        { code: `export const preferredRegion = 'auto';` },
        { code: `export const maxDuration = 30;` },
        { code: `export const config = { runtime: 'edge' };` },
      ],
      invalid: [
        // Bare async function export
        {
          code: `export async function POST(req) { return new Response('ok'); }`,
          errors: [{ messageId: 'notWrapped' }],
        },
        // Arrow function without wrapper
        {
          code: `export const saveRestaurant = async (input) => {};`,
          errors: [{ messageId: 'notWrapped' }],
        },
        // Wrapped with unknown function
        {
          code: `export const saveRestaurant = someOtherWrapper(async (ctx, input) => {});`,
          errors: [{ messageId: 'notWrapped' }],
        },
      ],
    });
  });
});
