import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SKIN_COOKIE, SkinBody, resolveSkin, skinClass } from '@demo-kit/shell';
import './globals.css';
import '@demo-kit/shell/shell.css';
import { DEMO_DESCRIPTION, DEMO_NAME } from '../lib/demo';

/**
 * The root layout, and the one place the treatment is decided.
 *
 * The cookie is read on the SERVER, so the first painted frame is already the right
 * treatment and there is no flash of the other one. `SkinBody` mirrors the class onto
 * `<body>` for anything portalled out of the tree, which is exactly the class of surface a
 * treatment otherwise fails to reach.
 *
 * `globals.css` is imported before the shell's stylesheet: the tokens have to exist before
 * anything reads them, and the shell falls back to its own values only where a demo has
 * defined none.
 */

export const metadata: Metadata = {
  title: DEMO_NAME,
  description: DEMO_DESCRIPTION,
  /* The icon is drawn at /icon rather than stored, so it cannot drift from the mark in the
     header. Both sizes come from the same route. */
  icons: { icon: [{ url: '/icon?size=192', sizes: '192x192', type: 'image/png' }] },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const skin = resolveSkin((await cookies()).get(SKIN_COOKIE)?.value);
  return (
    <html lang="en-GB">
      <body>
        <div className={`skin ${skinClass(skin)}`.trimEnd()}>
          {children}
          <SkinBody skin={skin} />
        </div>
      </body>
    </html>
  );
}
