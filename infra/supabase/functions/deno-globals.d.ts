// deno-globals.d.ts
// Minimal type shims so VS Code (Node tsserver) doesn't flag Deno Edge Function
// files as errors. These types are only for IDE purposes — the actual runtime
// is Supabase's Deno environment which has full Deno types.

declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
  }
  const env: Env;
}

// Supabase Edge Functions use URL-based imports. Declare them as module stubs
// so VS Code doesn't report "Cannot find module" errors.

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function createClient(url: string, key: string, options?: any): any;
}

declare module 'https://esm.sh/@upstash/redis@latest' {
  export class Redis {
    constructor(opts: { url: string; token: string });
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
    del(key: string): Promise<unknown>;
  }
}
