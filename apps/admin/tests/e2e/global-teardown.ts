import { resetAdminDb } from './fixtures/index.js';

export default async function globalTeardown() {
  await resetAdminDb();
}
