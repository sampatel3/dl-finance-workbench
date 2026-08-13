'use client';

/**
 * Focus a URL-requested section without moving the host demo shell.
 *
 * The demo-kit component deliberately owns the cross-iframe scroll behaviour. This local variant
 * adds the product-specific accessibility contract: the visual destination also becomes the active
 * keyboard and assistive-technology destination.
 */

import { useEffect } from 'react';

const MARK_MS = 2200;

export function FocusOnLoad({ elementId }: { readonly elementId: string | undefined }) {
  useEffect(() => {
    if (elementId === undefined) return;
    const element = document.getElementById(elementId);
    if (element === null) return;

    const margin = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
    const top = element.getBoundingClientRect().top + window.scrollY - margin;
    window.scrollTo({ top, behavior: 'instant' });

    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
    element.focus({ preventScroll: true });
    element.classList.add('focused');

    const timer = window.setTimeout(() => element.classList.remove('focused'), MARK_MS);
    return () => {
      window.clearTimeout(timer);
      element.classList.remove('focused');
    };
  }, [elementId]);

  return null;
}
