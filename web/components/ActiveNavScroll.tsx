'use client';

import { useEffect } from 'react';

/** Keep the current destination visible in horizontally scrolling navigation on small screens. */
export function ActiveNavScroll() {
  useEffect(() => {
    const active = document.querySelector<HTMLElement>(
      '.inner-surface-nav .nav-link[aria-current="page"], .masthead-nav .nav-link[aria-current="page"]',
    );
    const nav = active?.closest<HTMLElement>('nav');
    if (active === null || nav === null || nav === undefined) return;

    const activeLeft = active.offsetLeft;
    const activeRight = activeLeft + active.offsetWidth;
    const visibleLeft = nav.scrollLeft;
    const visibleRight = visibleLeft + nav.clientWidth;
    if (activeLeft >= visibleLeft && activeRight <= visibleRight) return;

    /* Scroll only the nav's inline axis. `scrollIntoView` can also move the document vertically,
       which would pull a URL-focused section back underneath the masthead on page load. */
    nav.scrollLeft = Math.max(0, activeLeft - (nav.clientWidth - active.offsetWidth) / 2);
  }, []);

  return null;
}
