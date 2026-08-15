/**
 * `@kestrel/model` — the fact store and the world in it.
 *
 * The bottom layer. It knows what is true and nothing about how it is shown: no formatting, no
 * measure definitions, no analysis, no React. Everything above it — measures, analysis, the app —
 * reads through this barrel, which is what keeps the layering `model → measures → analysis → web`
 * checkable by reading five package manifests.
 *
 * Two properties this package guarantees and everything above it assumes:
 *
 *   **The world is a pure function of its seed.** No randomness, no wall clock. The same seed
 *   builds the same group in every process on every machine, which is what makes screenshots,
 *   committed narration, the deck and every test possible.
 *
 *   **The arithmetic reconciles.** Assets equal liabilities plus equity for every entity in every
 *   month, children sum exactly to their parents, and the group balances after translation and
 *   elimination. Where it deliberately does not — one planted intercompany mismatch — the
 *   difference is reported as a named figure rather than hidden in a plug.
 */

export * from './period.ts';
export * from './taxonomy.ts';
export * from './entities.ts';
export * from './currency.ts';
export * from './vintages.ts';
export * from './sources.ts';
export * from './mappings.ts';
export * from './gl-codes.ts';
export * from './facts.ts';
export * from './consolidate.ts';
export * from './seed.ts';
export * from './checks.ts';
export * from './approvals.ts';
export * from './ai-log.ts';
