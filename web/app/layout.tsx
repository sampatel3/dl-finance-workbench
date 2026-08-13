import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import { SKIN_COOKIE } from '@demo-kit/shell';
import './globals.css';
import '@demo-kit/shell/shell.css';
import { DEMO_DESCRIPTION, DEMO_NAME } from '../lib/demo';

/**
 * The root layout: the fonts, and the one place the treatment is decided.
 *
 * ## The fonts are self-hosted
 *
 * The brand system specifies them as a Google Fonts `@import`, and this uses `next/font` instead. Three
 * reasons, and the third is the one that would have bitten: an `@import` is render-blocking and adds a
 * third-party round trip to every cold load; it leaks a request to Google from a page shown in a
 * client meeting; and the deck tooling screenshots a locally-served build, so a font fetched at render
 * time is a font that may not have arrived when the shutter falls — producing slides set in the
 * fallback face. Self-hosted, the bytes are on the same origin as the markup.
 *
 * The weights are pinned to the ones actually used. `next/font` subsets what it is asked for, so
 * declaring the full range would ship four unused faces.
 *
 * ## Dark is the product; light is paper
 *
 * The kit's convention is that light is the bare page and dark adds `.skin-dark`, because a stylesheet
 * naming both treatments in every rule states every colour twice. That convention is right and this
 * demo inverts which one is bare: the brand is dark-first, and its light palette is scoped to
 * "documents and print only".
 *
 * So the mapping is done here rather than by `skinClass`, and deliberately not by changing the kit —
 * light-as-default is correct for every other demo. Read the raw cookie rather than `resolveSkin`,
 * because that helper folds "no cookie" and "cookie says light" into the same answer, and those are
 * different here: an unset preference has to mean the product's own treatment, not the paper one.
 *
 * The class goes on `<body>` from the server rather than through the kit's `SkinBody`. That component
 * mirrors the treatment onto the body in a layout effect, which is the right mechanism when the class
 * is `skin-dark` — but the only class it can ever add is `skin-dark`, and this demo's second treatment
 * is `skin-light`. Passing it `light` would add nothing at all, and every surface portalled out of the
 * tree would stay dark while the page around it went to paper. Rendering the class on the server is
 * both simpler and better here: it reaches portals, needs no effect, and cannot flash.
 */

const display = Inter_Tight({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: DEMO_NAME,
  description: DEMO_DESCRIPTION,
  /* The icon is drawn at /icon rather than stored, so it cannot drift from the mark in the header.
     Both sizes come from the same route. */
  icons: { icon: [{ url: '/icon?size=192', sizes: '192x192', type: 'image/png' }] },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const raw = (await cookies()).get(SKIN_COOKIE)?.value;
  /* Only an explicit `light` gets the paper treatment. Anything else — unset, `dark`, or a value
     somebody hand-edited — is the product. */
  const paper = raw === 'light';
  const fonts = `${display.variable} ${body.variable} ${mono.variable}`;

  return (
    <html lang="en-GB" className={fonts}>
      <body className={paper ? 'skin-light' : ''}>
        <div className={`skin${paper ? ' skin-light' : ''}`}>{children}</div>
      </body>
    </html>
  );
}
