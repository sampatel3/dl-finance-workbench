/**
 * `@kestrel/measures` — the certified measure catalogue, and the drill spine.
 *
 * The middle layer. It reads the model and knows nothing about the app: no React, no routes, no
 * formatting decisions beyond the one place formatting happens. What it adds to the model is the
 * three things a governed figure needs and a fact does not have — a definition, a comparative, and a
 * record of what it was computed from.
 *
 * The catalogue is also the semantic layer the chat reads, which is the point of building one: a
 * question about gross margin is answered from the definition Finance approved rather than from
 * whatever the model believes gross margin is.
 */

export * from './units.ts';
export * from './catalogue.ts';
export * from './compute.ts';
export * from './comparator.ts';
export * from './materiality.ts';
