import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import {
  LIGHTNESS_COOKIE,
  SCHEME_COOKIE,
  STYLE_COOKIE,
  resolveLightness,
  resolveScheme,
  resolveStyle,
} from '@demo-kit/shell';
import '@demo-kit/shell/themes.css';
import '@demo-kit/shell/cards.css';
import './globals.css';
import '@demo-kit/shell/shell.css';
import { DEMO_DESCRIPTION, DEMO_NAME } from '../lib/demo';

/**
 * The root layout: the fonts, and the one place the treatment is decided.
 *
 * ## Three axes, and the third is why this workbench opens on paper
 *
 *   · scheme    — which brand.
 *   · style     — which design system: the layout grammar, and nothing about colour.
 *   · lightness — which of the scheme's two colours the page is made of.
 *
 * All three are cookies read on the SERVER, so the first painted frame is already right, and all
 * three are stamped on `<html>` rather than on a wrapper — a custom property that reads another
 * resolves it where it is DECLARED, so an axis set below `:root` leaves every token in
 * `globals.css` on the default, and a portalled surface inherits nothing.
 *
 * `DEMO_LIGHTNESS` is set explicitly to `light` on this project even though `light` is also the
 * kit's fallback, and the difference shows on the stale-cookie path: a fallback left to the kit
 * applies only when the cookie is ABSENT, so a reader arriving with a `dark` cookie from another
 * demo would land in the wrong pole with nothing to correct it. A named default holds there too.
 *
 * `light` is a CHANGE for this product. It was dark-first and said so, in `globals.css`, in
 * `:root` — which is the arrangement `themes.css` now names as the damage: a demo that hard-codes
 * a pole in a stylesheet imported after the theme outranks `[data-lightness]` and kills the axis.
 * The near-black workbench is unchanged and one click away; it is a pole this product can be worn
 * in rather than the only thing it can be.
 *
 * ## The stylesheet order is load-bearing
 *
 * `themes.css` first, because it declares the scheme primitives every other stylesheet reads.
 * `cards.css` beside it and BEFORE `globals.css`, so a card rule this demo wants different is
 * overridden here rather than edited in the kit. `shell.css` last, because the shell falls back
 * to its own values only where this demo has defined none.
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
  const jar = await cookies();
  /* `?? 'deeplight'` is this workbench's own palette named, so an absent cookie reproduces
     exactly what it looked like before the scheme layer existed. Both attributes go on
     <html>: a custom property that reads another resolves it where it is DECLARED, so a
     scheme set below `:root` would leave every token in this file on the default brand. */
  const scheme = resolveScheme(jar.get(SCHEME_COOKIE)?.value ?? 'deeplight');
  const style = resolveStyle(jar.get(STYLE_COOKIE)?.value);
  const lightness = resolveLightness(
    jar.get(LIGHTNESS_COOKIE)?.value,
    resolveLightness(process.env.DEMO_LIGHTNESS),
  );
  const fonts = `${display.variable} ${body.variable} ${mono.variable}`;

  return (
    <html
      lang="en-GB"
      className={fonts}
      data-scheme={scheme}
      data-style={style}
      data-lightness={lightness}
    >
      <body>
        <div className="skin">{children}</div>
      </body>
    </html>
  );
}
