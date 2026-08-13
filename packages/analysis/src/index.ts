/**
 * `@kestrel/analysis` — the engines that turn measures into findings.
 *
 * The top of the deterministic stack. Everything here is code deciding what is true; nothing here
 * phrases anything, and no model is involved. That division is the product's spine: code finds, the
 * model writes it down, and the model can only use figures code produced.
 */

export * from './bridge.ts';
export * from './drivers.ts';
export * from './forecast.ts';
export * from './cash.ts';
export * from './quality.ts';
export * from './detectors.ts';
export * from './priority.ts';
export * from './pivot.ts';
