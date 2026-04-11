/**
 * Step 6 — verify utility layer classes exist in globals.css
 * and that the updated shadcn components use the new utilities.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

function readFile(rel: string) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

describe('Step 6: utility layer in globals.css', () => {
  const globals = readFile('app/globals.css');

  it('defines .focus-ring utility', () => {
    expect(globals).toContain('.focus-ring');
    expect(globals).toContain('focus-visible:ring-ring');
  });

  it('defines .interactive utility', () => {
    expect(globals).toContain('.interactive');
    expect(globals).toContain('disabled:pointer-events-none');
  });

  it('defines .icon-sm and .icon-md utilities', () => {
    expect(globals).toContain('.icon-sm');
    expect(globals).toContain('.icon-md');
  });

  it('defines .animate-enter utility', () => {
    expect(globals).toContain('.animate-enter');
    expect(globals).toContain('data-[state=open]:animate-in');
    expect(globals).toContain('data-[state=closed]:animate-out');
  });

  it('defines surface-* utilities', () => {
    expect(globals).toContain('.surface-muted');
    expect(globals).toContain('.surface-info');
    expect(globals).toContain('.surface-warning');
    expect(globals).toContain('.surface-success');
    expect(globals).toContain('.surface-error');
  });
});

describe('Step 6: shadcn components use animate-enter', () => {
  it('select.tsx SelectContent uses animate-enter', () => {
    const content = readFile('components/ui/select.tsx');
    expect(content).toContain('animate-enter');
    // Ensure the verbose animate classes were removed
    expect(content).not.toContain('data-[state=open]:animate-in data-[state=closed]:animate-out');
  });

  it('dropdown-menu.tsx DropdownMenuContent uses animate-enter', () => {
    const content = readFile('components/ui/dropdown-menu.tsx');
    expect(content).toContain('animate-enter');
    // Ensure the verbose animate classes were removed
    expect(content).not.toContain('data-[state=open]:animate-in data-[state=closed]:animate-out');
  });
});
