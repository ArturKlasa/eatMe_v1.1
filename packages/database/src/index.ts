/**
 * @eatme/database
 *
 * Shared Supabase client factory and generated types for the EatMe monorepo.
 *
 * Each app creates its own client:
 *   Web:    const supabase = getWebClient();
 *   Mobile: const supabase = getMobileClient(AsyncStorage);
 */

// Client factories
export { getWebClient, getMobileClient } from './client';

// Generated database types (from: supabase gen types typescript --project-id <id>)
export type { Database, Json } from './types';

// Generated helper types for ergonomic table access
export type { Tables, TablesInsert, TablesUpdate, Enums } from './types';

// Generated enum constants (runtime values)
export { Constants } from './types';
