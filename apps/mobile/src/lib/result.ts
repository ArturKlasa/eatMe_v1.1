/**
 * Result<T> — discriminated success/error return type for service functions.
 *
 * Used where a service returns Result<T> so callers handle success/error in a
 * type-safe way without catching exceptions. Opt-in per service, not universal
 * (currently userPreferencesService + favoritesService).
 *
 * Usage:
 *   async function getUser(id: string): Promise<Result<User>> {
 *     const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
 *     if (error) return err(error.message);
 *     return ok(data);
 *   }
 *
 *   // Caller:
 *   const result = await getUser(id);
 *   if (!result.ok) { toast.error(result.error); return; }
 *   console.log(result.data); // typed as User
 */

/** Success variant */
export type Ok<T> = { ok: true; data: T };

/** Error variant */
export type Err = { ok: false; error: string };

/** Discriminated union — check `result.ok` to narrow the type */
export type Result<T> = Ok<T> | Err;

/** Construct a success Result */
export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

/** Construct an error Result */
export function err(error: string | Error): Err {
  return { ok: false, error: typeof error === 'string' ? error : error.message };
}
