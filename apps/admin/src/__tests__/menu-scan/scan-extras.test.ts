import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', async importActual => {
  const actual = await importActual<typeof import('react')>();
  return { ...actual, cache: (fn: unknown) => fn };
});
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerActionClient: vi.fn(),
  createAdminServiceClient: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { createServerActionClient } from '@/lib/supabase/server';
import { adminScanModifierExtras } from '@/app/(admin)/menu-scan/actions/scanExtras';

const ADMIN_USER = {
  id: 'admin-uuid-123',
  email: 'admin@example.com',
  app_metadata: { role: 'admin' },
};

function makeAuthClient(user: unknown = ADMIN_USER) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
}

const VALID_EXTRACTION = {
  modifier_groups: [
    {
      name: 'Elige tu proteína',
      selection_type: 'single',
      min_selections: 1,
      max_selections: 1,
      display_in_card: true,
      options: [
        {
          name: 'Pollo',
          price_delta: 0,
          price_override: null,
          primary_protein: 'chicken',
          serves_delta: 0,
          is_default: true,
        },
        {
          name: 'Arrachera',
          price_delta: 30,
          price_override: null,
          primary_protein: 'beef',
          serves_delta: 0,
          is_default: false,
        },
      ],
    },
  ],
  bundled_items: [{ name: 'Papas', note: null }],
};

function openAiResponse(content: unknown, finishReason = 'stop') {
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          finish_reason: finishReason,
          message: {
            content: typeof content === 'string' ? content : JSON.stringify(content),
          },
        },
      ],
    }),
  };
}

const INPUT = { imageBase64: 'a'.repeat(200), currencyCode: 'MXN' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');
  vi.mocked(createServerActionClient).mockResolvedValue(makeAuthClient() as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('adminScanModifierExtras — auth & validation', () => {
  it('rejects unauthenticated users', async () => {
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('nope') }),
      },
    } as never);

    const result = await adminScanModifierExtras(INPUT);
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects non-admin users', async () => {
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeAuthClient({ ...ADMIN_USER, app_metadata: { role: 'owner' } }) as never
    );
    const result = await adminScanModifierExtras(INPUT);
    expect(result).toEqual({ ok: false, formError: 'FORBIDDEN' });
  });

  it('rejects an empty image payload', async () => {
    const result = await adminScanModifierExtras({ imageBase64: '', currencyCode: 'MXN' });
    expect(result).toEqual({ ok: false, formError: 'VALIDATION' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fails with NO_API_KEY when the env var is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const result = await adminScanModifierExtras(INPUT);
    expect(result).toEqual({ ok: false, formError: 'NO_API_KEY' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('adminScanModifierExtras — extraction', () => {
  it('returns parsed groups + items on a clean response', async () => {
    mockFetch.mockResolvedValue(openAiResponse(VALID_EXTRACTION));

    const result = await adminScanModifierExtras(INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.data.modifier_groups).toHaveLength(1);
    expect(result.data.modifier_groups[0].options[1].price_delta).toBe(30);
    expect(result.data.bundled_items).toEqual([{ name: 'Papas', note: null }]);

    // Request sanity: model + strict schema + image present
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.model).toBe('gpt-5.4-mini');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.messages[0].content[1].image_url.url).toContain('base64');
  });

  it('strips a data-URL prefix before sending', async () => {
    mockFetch.mockResolvedValue(openAiResponse(VALID_EXTRACTION));
    await adminScanModifierExtras({
      imageBase64: `data:image/jpeg;base64,${'b'.repeat(200)}`,
      currencyCode: 'MXN',
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    const url = body.messages[0].content[1].image_url.url as string;
    expect(url).toBe(`data:image/jpeg;base64,${'b'.repeat(200)}`);
    expect(url.match(/base64,/g)).toHaveLength(1);
  });

  it('clamps out-of-range selection bounds instead of failing', async () => {
    const wonky = {
      ...VALID_EXTRACTION,
      modifier_groups: [
        {
          ...VALID_EXTRACTION.modifier_groups[0],
          selection_type: 'multiple',
          min_selections: -2,
          max_selections: 0,
        },
      ],
    };
    mockFetch.mockResolvedValue(openAiResponse(wonky));

    const result = await adminScanModifierExtras(INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.data.modifier_groups[0].min_selections).toBe(0);
    expect(result.data.modifier_groups[0].max_selections).toBe(1);
  });

  it('collapses a zero price_override to null (model emits 0 where null was meant)', async () => {
    const zeroed = {
      ...VALID_EXTRACTION,
      modifier_groups: [
        {
          ...VALID_EXTRACTION.modifier_groups[0],
          options: [
            { ...VALID_EXTRACTION.modifier_groups[0].options[0], price_override: 0 },
            { ...VALID_EXTRACTION.modifier_groups[0].options[1], price_override: 165 },
          ],
        },
      ],
    };
    mockFetch.mockResolvedValue(openAiResponse(zeroed));

    const result = await adminScanModifierExtras(INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const options = result.data.modifier_groups[0].options;
    expect(options[0].price_override).toBeNull(); // bogus 0 collapsed
    expect(options[1].price_override).toBe(165); // real replacing price kept
  });

  it('fails with OPENAI_ERROR on a non-OK response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' });
    const result = await adminScanModifierExtras(INPUT);
    expect(result).toEqual({ ok: false, formError: 'OPENAI_ERROR' });
  });

  it('fails with TRUNCATED when the output hit the token ceiling', async () => {
    mockFetch.mockResolvedValue(openAiResponse(VALID_EXTRACTION, 'length'));
    const result = await adminScanModifierExtras(INPUT);
    expect(result).toEqual({ ok: false, formError: 'TRUNCATED' });
  });

  it('fails with PARSE_FAILED on non-JSON content', async () => {
    mockFetch.mockResolvedValue(openAiResponse('not json {'));
    const result = await adminScanModifierExtras(INPUT);
    expect(result).toEqual({ ok: false, formError: 'PARSE_FAILED' });
  });

  it('fails with PARSE_FAILED when the JSON does not match the schema', async () => {
    mockFetch.mockResolvedValue(openAiResponse({ modifier_groups: [{ name: 1 }] }));
    const result = await adminScanModifierExtras(INPUT);
    expect(result).toEqual({ ok: false, formError: 'PARSE_FAILED' });
  });
});
