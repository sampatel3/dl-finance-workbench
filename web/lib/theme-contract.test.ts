import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('the product canvas', () => {
  it('stays flat instead of reintroducing a style-owned page wash', async () => {
    const css = await readFile(resolve(process.cwd(), 'app/globals.css'), 'utf8');
    const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, '');

    expect(uncommented).not.toMatch(/--ground\s*:/);
    expect(uncommented).not.toMatch(/background-image\s*:\s*var\(--ground/);
  });
});
