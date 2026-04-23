import { describe, it, expect } from 'vitest';
import { createBrowserClient, createServerClient, createServerActionClient } from '../web';

const FAKE_URL = 'https://test.supabase.co';
const FAKE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.test';

const fakeCookieStore = {
  getAll: () => [] as { name: string; value: string }[],
  setAll: (_cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => {},
};

describe('createBrowserClient', () => {
  it('returns a client with required methods', () => {
    const client = createBrowserClient(FAKE_URL, FAKE_KEY);
    expect(typeof client.auth).toBe('object');
    expect(typeof client.from).toBe('function');
    expect(typeof client.rpc).toBe('function');
    expect(typeof client.storage).toBe('object');
    expect(typeof client.channel).toBe('function');
  });
});

describe('createServerClient', () => {
  it('returns a client with required methods', () => {
    const client = createServerClient(FAKE_URL, FAKE_KEY, fakeCookieStore);
    expect(typeof client.auth).toBe('object');
    expect(typeof client.from).toBe('function');
    expect(typeof client.rpc).toBe('function');
    expect(typeof client.storage).toBe('object');
    expect(typeof client.channel).toBe('function');
  });
});

describe('createServerActionClient', () => {
  it('returns a client with required methods', () => {
    const client = createServerActionClient(FAKE_URL, FAKE_KEY, fakeCookieStore);
    expect(typeof client.auth).toBe('object');
    expect(typeof client.from).toBe('function');
    expect(typeof client.rpc).toBe('function');
    expect(typeof client.storage).toBe('object');
    expect(typeof client.channel).toBe('function');
  });
});
