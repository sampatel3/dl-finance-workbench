import { describe, expect, it } from 'vitest';

import { resolveWorkbenchSkin } from './skin';

describe('workbench skin', () => {
  it('uses the dark product treatment for a fresh or invalid cookie', () => {
    expect(resolveWorkbenchSkin(undefined)).toBe('dark');
    expect(resolveWorkbenchSkin('unexpected')).toBe('dark');
  });

  it('preserves either explicit treatment', () => {
    expect(resolveWorkbenchSkin('dark')).toBe('dark');
    expect(resolveWorkbenchSkin('light')).toBe('light');
  });
});
