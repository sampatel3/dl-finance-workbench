import type { Skin } from '@demo-kit/shell';

/**
 * Resolve the workbench treatment at both shell and product boundaries.
 *
 * Demo-kit defaults to light, while this product is deliberately dark-first. Keeping the inversion
 * in one helper prevents a fresh shell from labelling the dark product as “Light”. An explicit light
 * cookie remains the paper treatment; unset, dark and invalid values resolve to the product default.
 */
export function resolveWorkbenchSkin(raw: string | undefined): Skin {
  return raw === 'light' ? 'light' : 'dark';
}
