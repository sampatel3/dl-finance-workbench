import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import {
  SCHEME_COOKIE,
  STYLE_COOKIE,
  resolveScheme,
  resolveStyle,
} from '@demo-kit/shell';
import '@demo-kit/shell/themes.css';
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
  const fonts = `${display.variable} ${body.variable} ${mono.variable}`;

  return (
    <html lang="en-GB" className={fonts} data-scheme={scheme} data-style={style}>
      <body>
        <div className="skin">{children}</div>
      </body>
    </html>
  );
}
