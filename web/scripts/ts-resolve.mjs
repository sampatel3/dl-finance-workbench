/**
 * Node resolution hook for the build-time scripts.
 *
 * The kit's packages ship TypeScript source and import each other with ESM-correct
 * `./foo.js` specifiers that resolve to `./foo.ts` on disk. Next is told about that in
 * next.config.ts; plain Node has to be told here. Node 24 strips the types itself, so this
 * hook is the only thing standing between `node scripts/narrate.ts` and the same modules
 * the app renders from — which is the point: the narration is generated from the demo's
 * real data, not from a second copy of it.
 */

import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) throw err;
      const candidates = specifier.endsWith('.js')
        ? [`${specifier.slice(0, -3)}.ts`, `${specifier.slice(0, -3)}.tsx`]
        : [`${specifier}.ts`, `${specifier}.tsx`, `${specifier}/index.ts`];
      for (const candidate of candidates) {
        try {
          return nextResolve(candidate, context);
        } catch {
          /* try the next one */
        }
      }
      throw err;
    }
  },
});
