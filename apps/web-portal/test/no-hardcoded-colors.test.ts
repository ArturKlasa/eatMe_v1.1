/**
 * Step 5 CI guard: fail if hardcoded Tailwind color classes appear
 * in any .tsx file outside components/ui/ (shadcn primitives are exempt).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..');

const BANNED_PATTERNS = [
  /\btext-gray-\d+/,
  /\bbg-gray-\d+/,
  /\bbg-orange-\d+/,
  /\btext-orange-\d+/,
  /\bbg-green-\d+/,
  /\btext-green-\d+/,
  /\bbg-red-\d+/,
  /\btext-red-\d+/,
  /\bbg-blue-\d+/,
  /\btext-blue-\d+/,
];

function getAllTsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      // Skip node_modules, .next, components/ui (shadcn primitives exempt)
      if (['node_modules', '.next', 'ui'].includes(entry)) continue;
      results.push(...getAllTsxFiles(full));
    } else if (entry.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

describe('no hardcoded color classes outside components/ui/', () => {
  const files = getAllTsxFiles(ROOT).filter((f) => {
    const rel = relative(ROOT, f);
    // Exempt shadcn ui primitives
    return !rel.startsWith('components/ui/');
  });

  it('should have tsx files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const violations: string[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const rel = relative(ROOT, file);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comment lines
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;

      for (const pattern of BANNED_PATTERNS) {
        if (pattern.test(line)) {
          const match = line.match(pattern);
          violations.push(`${rel}:${i + 1} — found "${match?.[0]}" — use semantic token instead`);
        }
      }
    }
  }

  it('has zero hardcoded color class violations', () => {
    if (violations.length > 0) {
      console.error('Hardcoded color violations found:\n' + violations.join('\n'));
    }
    expect(violations).toHaveLength(0);
  });
});
