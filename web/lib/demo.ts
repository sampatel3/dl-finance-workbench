/**
 * Who this demo is, in one place.
 *
 * This file is the scaffolder's substitution surface: `create-demo` rewrote these values when it
 * copied the template and touched nothing else. Everything below is a plain string constant for
 * exactly that reason — a moustache-style placeholder would have made the template unbuildable,
 * and a template that cannot be built is a template nobody can check before shipping it. It is
 * also why the placeholder gate can be a grep for that syntax: no correct file contains it.
 *
 * Changing the seed changes the world. That is the intended way to reshuffle a demo's
 * figures; nothing else in the app may.
 */

/** The full name: the browser title, the manifest, the gate heading. */
export const DEMO_NAME = 'Deeplight Finance Workbench';

/** What fits under a home-screen icon — about 12 characters. */
export const DEMO_SHORT_NAME = 'Workbench';

/** Two or three characters. A demo's mark is type, not an image file. */
export const DEMO_MARK = 'DL';

/** One line, used by the manifest and the gate. */
export const DEMO_DESCRIPTION =
  'A governed measure layer over the systems Finance already runs. Kestrel Industrial Group is ' +
  'fictional and every figure is computed from a fixed seed — nothing here is written to any ' +
  'system of record.';

/**
 * The seed the whole world is a pure function of.
 *
 * The group, its five entities, forty-three months of facts, the twelve planted conditions and
 * every figure derived from them come out of this string. Change it and the demo is a different
 * business — which also breaks the four headline figures away from the concept deck they were
 * tuned to match, and the freshness test will say so.
 */
export const DEMO_SEED = 'kestrel-industrial-group';

/**
 * The company the demo is about.
 *
 * Held here rather than in `world.ts` because the masthead, the gate, the manifest and the
 * commentary all name it, and a business that is called two things on one screen is a business
 * nobody believes in.
 */
export const GROUP_NAME = 'Kestrel Industrial Group';
export const GROUP_SHORT_NAME = 'Kestrel';

/**
 * The mark's colours.
 *
 * Petrol rather than the kit's navy, and the reason is functional rather than taste: in a finance
 * product green already means favourable and red means unfavourable, so the interactive colour has
 * to stay clear of the one pair that carries meaning. See `globals.css`, where the same value is
 * the accent token and carries the argument in full.
 */
export const DEMO_ICON_BACKGROUND = '#0e5a63';
export const DEMO_BACKGROUND_COLOR = '#f2f5f6';
