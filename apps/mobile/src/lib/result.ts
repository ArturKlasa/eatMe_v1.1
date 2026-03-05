/**
 * Result<T> — canonical return type for service functions (A9)
 *
 * All new mobile service functions should return Result<T> so callers can
 * handle success/error in a uniform, type-safe way without catching exceptions.
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

/**
 * Convert a legacy `{ data, error }` Supabase response shape to Result<T>.
 *
 * Useful as a migration helper when wrapping existing service calls.
 *
 * @example
 * const { data, error } = await supabase.from('...').select('*').single();
 * return fromSupabase(data, error);
 */
export function fromSupabase<T>(data: T | null, error: { message: string } | null): Result<T> {
  if (error) return err(error.message);
  if (data === null) return err('No data returned');
  return ok(data);
}
