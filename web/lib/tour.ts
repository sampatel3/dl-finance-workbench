/**
 * The guided tour: five steps through the product in the window beside it.
 *
 * **Nothing in a tour may promise a capability the app does not have.** It is the one rule the kit
 * imposes on a demo's own words, and the one most likely to be broken by accident — a step describing
 * what the product is *going to* do reads exactly like a step describing what it does. Every claim
 * below is about something on screen right now.
 *
 * Wave 7 owns the tour properly. It is written now rather than left describing the template's four
 * sites, because a tour that describes a different product is worse than no tour: a reader who follows
 * it and finds something else stops trusting the notes, and then stops trusting the figures.
 */

import { productHref, type SurfaceNote, type Tour } from '@demo-kit/shell';
import { DEMO_NAME } from './demo';
import { LATEST_MONTH, monthLabel } from './world';

const inner = (focus: string): string => productHref({ view: 'inner', focus });

export const TOUR: Tour = {
  title: DEMO_NAME,
  intro:
    'Five steps. The product runs in the window beside this column, and every control in it works — the ' +
    'period, the entity, the comparator and the currency lens are all real.',
  steps: [
    {
      short: 'The boards',
      heading: 'What needs a decision',
      whatItIs:
        'Twelve rules run over the measure layer, and each one that fires declares a direction — adverse or ' +
        'favourable — and a horizon: has it happened, or is it going to. The four boards are the 2×2 of those ' +
        'two, so every finding lands on exactly one of them by construction rather than by judgement.',
      whyItMatters:
        'A single ranked list of findings is always topped by history, because the biggest thing is usually ' +
        'something that already happened, and the forward items — the ones where a decision is still ' +
        'available — sit below the fold. Splitting on horizon means they cannot be crowded out.',
      lookAt:
        'Opportunities, bottom right. A demo where every finding is bad news reads as a scold.',
      href: inner('section-boards'),
    },
    {
      short: 'The figures',
      heading: `${monthLabel(LATEST_MONTH)}, and what it is compared against`,
      whatItIs:
        'Four measures, each computed through a catalogue that names its formula, its owner and whether the ' +
        'definition is approved. The line under each figure says what it is being compared against, in words.',
      whyItMatters:
        'A movement with no stated basis is a movement a reader has to guess at, and the guess is usually ' +
        '"last year". Change the comparator in the header and every figure and every board re-partitions, ' +
        'because the comparator is part of a finding’s identity rather than a sort order.',
      lookAt: 'The "vs" line under each figure, then switch the comparator to Prior year.',
      href: inner('section-headline'),
    },
    {
      short: 'Not final',
      heading: 'A number that is right and not finished',
      whatItIs:
        'One of the five ledgers has submitted July and not closed it. The group figures are not wrong; they ' +
        'are not final, and nothing in a figure itself can say so.',
      whyItMatters:
        'Every real group reporting pack has this state and almost none of them show it — the controller ' +
        'annotates it by hand in the covering email. Completeness is counted by entity rather than weighted ' +
        'by value, because "97% closed" is precisely the figure that stops a question being asked.',
      lookAt: 'The banner above the figures, before you read the figures.',
      href: inner('section-headline'),
    },
    {
      short: 'On a phone',
      /* A step that is ABOUT a device switches the window to it. It does not become the reader's choice, so
         it does not follow them into step five. */
      device: 'iphone',
      heading: 'The same build on a phone',
      whatItIs:
        'Not a mobile skin — the same pages, rendered at a phone’s true viewport and scaled to fit the window.',
      whyItMatters:
        'A layout claim that has only ever been seen on a laptop is a claim nobody has checked.',
      lookAt: 'The four boards stacking into one column, and the charts holding their shape.',
      href: inner('section-boards'),
    },
    {
      short: 'Asking',
      heading: 'Asking it a question',
      whatItIs:
        'Questions are answered by a model that can only read the figures through five tools. It cannot ' +
        'produce a number; it can only ask for one — and the arithmetic lives in a tool too, because a ' +
        'difference the model worked out itself is a figure no tool returned.',
      whyItMatters:
        'A wrong figure delivered confidently costs more than no answer, so there is no fallback engine ' +
        'behind this one. Ask it to forecast something and it says it can explain a forecast the product ' +
        'holds and cannot make one.',
      lookAt: 'The suggested questions under the box — every one of them resolves.',
      href: inner('section-ask'),
    },
  ],
};

/**
 * Free view hands the window to the reader, and without these the notes column would go blank the
 * moment they wander off the script. One note per surface, matched by path.
 */
export const SURFACE_NOTES: readonly SurfaceNote[] = [
  {
    path: '/app',
    eyebrow: 'Overview',
    title: 'Findings above figures',
    points: [
      'Five entities in four currencies, forty-three months, all derived from one seed string.',
      'The months are written down rather than counted back from today, so the figures do not drift.',
      'Every selector is a link, so the address bar and the screen can never disagree.',
    ],
  },
  {
    path: '/app/performance',
    eyebrow: 'Performance',
    title: 'A variance decomposed',
    points: [
      'Currency is separated first, then price, volume and mix — and the bars sum to the total exactly.',
      'The residual is drawn even at zero: a decomposition that hides one has explained less than it claims.',
      'Mix is weighted by quantity share rather than revenue share, which is the convention most tools invert.',
    ],
  },
];
