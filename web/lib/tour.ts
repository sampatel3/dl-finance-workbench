/**
 * The guided tour: five steps through the product in the window beside it.
 *
 * **Nothing in a tour may promise a capability the app does not have.** It is the one rule
 * the kit imposes on a demo's own words, and it is the rule most likely to be broken by
 * accident — a step describing what the product is *going to* do reads exactly like a step
 * describing what it does. Every claim below is about something on screen right now.
 *
 * The copy is placeholder, like the data. What is not placeholder: the shape of a step, the
 * `focus=` handshake with the product's sections, and the phone step that switches the
 * device rather than asking the reader to find the control.
 */

import { productHref, type SurfaceNote, type Tour } from '@demo-kit/shell';
import { DEMO_NAME } from './demo';
import { LATEST_MONTH } from './world';

const inner = (focus: string): string => productHref({ view: 'inner', focus });

export const TOUR: Tour = {
  title: DEMO_NAME,
  intro: 'Five steps. The product runs in the window beside this column, and every control in it works.',
  steps: [
    {
      short: 'The month',
      heading: 'Where the month stands',
      whatItIs: `Four figures for ${LATEST_MONTH.label}: volume and cost across the network, and the same two for the site that moved most.`,
      whyItMatters:
        'It is the first screen of an operations tool, and its job is to be readable without being explained.',
      lookAt: 'The four figures across the top.',
      href: inner('section-summary'),
    },
    {
      short: 'The series',
      heading: 'Twelve months, four sites',
      whatItIs:
        'One line per site, drawn from the same seeded figures the cards above are read from. The chart is hand-written SVG; there is no charting library in this demo.',
      whyItMatters:
        'A demo that redraws itself differently on every reload cannot be screenshotted, and cannot be walked through twice the same way.',
      lookAt: 'East, the line that turns down in the spring.',
      href: inner('section-series'),
    },
    {
      short: 'The finding',
      heading: 'What the demo found on its own',
      whatItIs:
        'A detector reads the series and reports sites that fell three months running. The sentence under the heading was written by a model at build time, from the numbers the detector produced — and every numeral in it was checked against them before it was allowed to ship.',
      whyItMatters:
        'Code decides what is true; the model only phrases it. That division is what makes generated prose safe to put in front of a reader.',
      lookAt: 'The brief, and the three months named under it.',
      href: inner('section-brief'),
    },
    {
      short: 'On a phone',
      /* A step that is ABOUT a device switches the window to it. It does not become the
         reader's choice, so it does not follow them into step five. */
      device: 'iphone',
      heading: 'The same build on a phone',
      whatItIs: 'Not a mobile skin — the same pages, rendered at a phone’s true viewport and scaled to fit the window.',
      whyItMatters: 'A layout claim that has only ever been seen on a laptop is a claim nobody has checked.',
      lookAt: 'The figures stacked into one column, and the chart holding its shape.',
      href: inner('section-summary'),
    },
    {
      short: 'Asking',
      heading: 'Asking it a question',
      whatItIs:
        'Questions are answered by a model that can only read the demo’s own figures through two tools. It cannot produce a number; it can only ask for one. Without an API key configured it says so plainly rather than guessing.',
      whyItMatters:
        'A wrong figure delivered confidently costs more than no answer, so there is no fallback engine behind this one.',
      lookAt: 'The suggested questions under the box.',
      href: inner('section-ask'),
    },
  ],
};

/**
 * Free view hands the window to the reader, and without these the notes column would go
 * blank the moment they wander off the script. One note per surface, matched by path.
 */
export const SURFACE_NOTES: readonly SurfaceNote[] = [
  {
    path: '/app',
    eyebrow: 'The product',
    title: 'Everything here is generated',
    points: [
      'Four sites, twelve closed months, two measures — all derived from one seed string.',
      'The months are written down rather than counted back from today, so the figures do not drift.',
      'Reload as often as you like: the same seed builds the same world in every process.',
    ],
  },
];
