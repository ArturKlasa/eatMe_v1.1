#!/usr/bin/env tsx
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const APPROVED_WRAPPERS = new Set([
  'withAuth',
  'withAdminAuth',
  'withPublic',
  'withAuthRoute',
  'withAdminAuthRoute',
  'withPublicRoute',
]);

type Status = 'OK' | 'MISSING' | 'WRONG_TYPE';

interface Row {
  file: string;
  exportName: string;
  wrapper: string | null;
  status: Status;
}

function walkFiles(dir: string, pattern: RegExp, results: string[] = []): string[] {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walkFiles(full, pattern, results);
      else if (pattern.test(full)) results.push(full);
    }
  } catch {}
  return results;
}

function getCalleeName(line: string): string | null {
  const m = line.match(/=\s*([\w]+)\s*\(/);
  return m ? m[1] : null;
}

function analyzeFile(filePath: string): Row[] {
  const content = readFileSync(filePath, 'utf-8');
  const rows: Row[] = [];

  const varExportRegex = /^export\s+const\s+([\w]+)\s*=/gm;
  const fnExportRegex = /^export\s+(?:async\s+)?function\s+([\w]+)/gm;

  let m: RegExpExecArray | null;

  // Check variable exports: export const foo = wrapper(...)
  while ((m = varExportRegex.exec(content)) !== null) {
    const name = m[1];
    const lineStart = m.index;
    const lineEnd = content.indexOf('\n', lineStart);
    const line = content.slice(lineStart, lineEnd > -1 ? lineEnd : undefined);
    const callee = getCalleeName(line);
    const isApproved = callee !== null && APPROVED_WRAPPERS.has(callee);
    rows.push({
      file: filePath,
      exportName: name,
      wrapper: callee,
      status: isApproved ? 'OK' : 'MISSING',
    });
  }

  // Check function exports: export async function POST() — always WRONG_TYPE
  while ((m = fnExportRegex.exec(content)) !== null) {
    const name = m[1];
    rows.push({
      file: filePath,
      exportName: name,
      wrapper: null,
      status: 'WRONG_TYPE',
    });
  }

  return rows;
}

function main() {
  const appRoot = new URL('..', import.meta.url).pathname;
  const isStrict = process.argv.includes('--strict');

  const actionsFiles = walkFiles(join(appRoot, 'src/app'), /\/actions\/[^/]+\.ts$/);
  const routeFiles = walkFiles(join(appRoot, 'src/app'), /\/route\.ts$/);
  const allFiles = [...actionsFiles, ...routeFiles];

  const rows: Row[] = allFiles.flatMap(f => analyzeFile(f));

  if (rows.length === 0) {
    console.log('No action or route files found.\n');
    return;
  }

  console.log('| File | Export | Wrapper | Status |');
  console.log('|------|--------|---------|--------|');
  for (const row of rows) {
    const file = relative(appRoot, row.file);
    console.log(`| ${file} | ${row.exportName} | ${row.wrapper ?? '—'} | ${row.status} |`);
  }

  if (isStrict) {
    const failing = rows.filter(r => r.status !== 'OK');
    if (failing.length > 0) {
      console.error(`\n${failing.length} unwrapped export(s) found.`);
      process.exit(1);
    }
  }
}

main();
