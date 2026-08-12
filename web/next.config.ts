import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* The kit's packages ship TypeScript source, not build output — there is no build step
     anywhere in demo-kit. Next compiles them along with the app. A package added to a demo's
     workspace has to be added here too, or the first import of it fails at build time with a
     syntax error in someone else's file. The postgres overlay adds `@demo-kit/db`. */
  transpilePackages: ['@demo-kit/data', '@demo-kit/gate', '@demo-kit/llm', '@demo-kit/shell'],

  reactStrictMode: true,

  /* The deck's screenshots are captured from a running server, and the dev-tools indicator is
     pinned to the viewport corner — so it lands on top of the product in a customer-facing
     slide, which is how it once reached a phone shot. Off, a dev capture looks like the
     shipped app, which is the only thing a deck is entitled to show. */
  devIndicators: false,

  /* Tour steps and product views are prefetched links. By default the client router discards
     a prefetched payload for a dynamic route immediately, so the click still costs a request;
     holding it for five minutes is what makes the second and third step open with no network
     at all. Safe here because every page is a pure function of a fixed seed. */
  experimental: {
    staleTimes: { dynamic: 300, static: 300 },
  },

  /* The kit's packages use ESM-correct `./foo.js` specifiers that resolve to `./foo.ts` on
     disk. Node and vitest work that out themselves; webpack has to be told. */
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };

    /* One expected warning, silenced precisely. `@demo-kit/llm`'s lazy loader imports the
       Anthropic SDK through a specifier held in a variable, deliberately: the package must
       not depend on the SDK, and a literal specifier there would be a compile error in a
       package that does not. webpack cannot follow a computed specifier, so it warns and
       leaves the import to run at runtime — which is the intended behaviour, and which this
       demo does not rely on anyway (it injects a client built in lib/anthropic.ts).
       A build that always prints a warning teaches everyone to stop reading warnings, so
       this one is filtered by module AND message rather than left in the log. */
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /packages[\\/]llm[\\/]src[\\/]client\.ts/, message: /Critical dependency/ },
    ];
    return config;
  },

  /* A clean URL for the deck. It lives in public/, which Next still serves through
     middleware, so the passcode gate covers it with no extra wiring. */
  async rewrites() {
    return [{ source: '/deck', destination: '/deck.html' }];
  },
};

export default nextConfig;
