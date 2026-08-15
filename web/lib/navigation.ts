/**
 * Finance-native information architecture.
 *
 * The primary path is the destination a navigation link opens. `activePaths` lets one finance
 * domain own more than one specialist surface without pretending those surfaces are the same page.
 *
 * ## Why the sections are grouped, and why by question
 *
 * Twelve destinations is past the point where a reader scans a list — they read the first three and
 * hunt for the rest. Grouping is the fix, and the grouping that matters is the one that matches how
 * somebody actually arrives.
 *
 * The obvious grouping is by data domain: profit-and-loss things together, cash things together,
 * control things together. That is an accountant's filing cabinet, and it is the wrong axis here for
 * a specific reason — it sorts by *where a number comes from*, and nobody opens a workbench
 * wondering where a number comes from. They open it with one of four questions, in a fixed order,
 * every month:
 *
 *   **Position** — where do we stand, and why? Overview, Performance, and the KPIs that lead both.
 *   **Outlook** — where does the year land? Forecast, Year to Go, and the scenarios around them.
 *   **Cash & commitments** — what is exposed, and what have we already promised? The thirteen weeks,
 *   the capital book and the payroll are three ways the business has committed money it still holds.
 *   **Assurance** — what are we signing, and can we? The narrative, and the controls under it.
 *
 * Explore & Ask sits outside the four because it is not a section. It is what a reader reaches for
 * when the answer is not on a page, and filing it under a heading implies it belongs to one.
 *
 * ## Where this departs from the review's slide 3
 *
 * The deck's recommended order is kept, with one move: **Scenarios goes up beside Forecast and Year
 * to Go** rather than sitting after KPIs. A scenario is a question about the outlook, and a reader
 * who has just seen where the year lands is then one click from asking what would change it. The
 * deck's own note is that the order is "broadly right"; this is the part that is not.
 */

export type NavGroupId = 'position' | 'outlook' | 'commitments' | 'assurance' | 'tools';

export interface NavGroup {
  readonly id: NavGroupId;
  /** The rail's eyebrow. Empty where the group holds a tool rather than a section. */
  readonly label: string;
  /** The question the group answers, used as its accessible description. */
  readonly question: string;
}

export const NAV_GROUPS: readonly NavGroup[] = [
  { id: 'position', label: 'Position', question: 'Where do we stand, and why?' },
  { id: 'outlook', label: 'Outlook', question: 'Where does the year land?' },
  {
    id: 'commitments',
    label: 'Cash & commitments',
    question: 'What is exposed, and what have we already promised?',
  },
  { id: 'assurance', label: 'Assurance', question: 'What are we signing, and can we?' },
  { id: 'tools', label: '', question: 'Anything the sections do not answer.' },
];

export interface Surface {
  readonly path: string;
  readonly activePaths: readonly string[];
  readonly label: string;
  readonly ariaLabel: string;
  readonly group: NavGroupId;
}

export const SURFACES: readonly Surface[] = [
  {
    path: '/app',
    activePaths: ['/app'],
    label: 'Overview',
    ariaLabel: 'Overview',
    group: 'position',
  },
  {
    path: '/app/performance',
    activePaths: ['/app/performance'],
    label: 'Performance',
    ariaLabel: 'Performance — profitability and variance analysis',
    group: 'position',
  },
  {
    path: '/app/kpis',
    activePaths: ['/app/kpis'],
    label: 'KPIs',
    ariaLabel: 'Key performance indicators',
    group: 'position',
  },
  {
    path: '/app/forecast',
    activePaths: ['/app/forecast'],
    label: 'Forecast',
    ariaLabel: 'Forecast versions and drivers',
    group: 'outlook',
  },
  {
    path: '/app/year-to-go',
    activePaths: ['/app/year-to-go'],
    label: 'Year to Go',
    ariaLabel: 'Year to Go — expected full-year landing',
    group: 'outlook',
  },
  {
    path: '/app/scenarios',
    activePaths: ['/app/scenarios'],
    label: 'Scenarios',
    ariaLabel: 'Scenarios — governed scenario planning',
    group: 'outlook',
  },
  {
    path: '/app/cash',
    activePaths: ['/app/cash'],
    label: 'Cash & WC',
    ariaLabel: 'Cash and working capital',
    group: 'commitments',
  },
  {
    path: '/app/capital',
    activePaths: ['/app/capital'],
    label: 'Capex & Procurement',
    ariaLabel: 'Capital projects and procurement commitments',
    group: 'commitments',
  },
  {
    path: '/app/people',
    activePaths: ['/app/people'],
    label: 'People',
    ariaLabel: 'Headcount and people cost',
    group: 'commitments',
  },
  {
    path: '/app/commentary',
    activePaths: ['/app/commentary'],
    label: 'Commentary',
    ariaLabel: 'Commentary — reporting approvals',
    group: 'assurance',
  },
  {
    path: '/app/controls',
    activePaths: ['/app/controls', '/app/quality'],
    label: 'Quality & Controls',
    ariaLabel: 'Forecast quality and finance controls',
    group: 'assurance',
  },
  {
    path: '/app/explore',
    activePaths: ['/app/explore'],
    label: 'Explore & Ask',
    ariaLabel: 'Explore data and ask grounded questions',
    group: 'tools',
  },
] as const;

export function surfaceFor(path: string): Surface | undefined {
  return SURFACES.find((surface) => surface.activePaths.includes(path));
}

/** The surfaces in one group, in declared order. */
export function surfacesIn(group: NavGroupId): readonly Surface[] {
  return SURFACES.filter((surface) => surface.group === group);
}

/** The group a path belongs to, so a rail can say which question the reader is inside. */
export function groupFor(path: string): NavGroup | undefined {
  const surface = surfaceFor(path);
  return surface === undefined
    ? undefined
    : NAV_GROUPS.find((group) => group.id === surface.group);
}
