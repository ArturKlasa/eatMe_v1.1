import { resetDb } from './fixtures/index.js';

export default async function globalTeardown() {
  await resetDb();
}
