/**
 * Finance-native information architecture.
 *
 * The primary path is the destination a navigation link opens. `activePaths` lets one finance
 * domain own more than one specialist surface without pretending those surfaces are the same page.
 */
export interface Surface {
  readonly path: string;
  readonly activePaths: readonly string[];
  readonly label: string;
  readonly ariaLabel: string;
}

export const SURFACES: readonly Surface[] = [
  { path: '/app', activePaths: ['/app'], label: 'Overview', ariaLabel: 'Overview' },
  {
    path: '/app/performance',
    activePaths: ['/app/performance'],
    label: 'Performance',
    ariaLabel: 'Performance — profitability and variance analysis',
  },
  {
    path: '/app/forecast',
    activePaths: ['/app/forecast'],
    label: 'Forecast',
    ariaLabel: 'Forecast versions and drivers',
  },
  {
    path: '/app/year-to-go',
    activePaths: ['/app/year-to-go'],
    label: 'Year to Go',
    ariaLabel: 'Year to Go — expected full-year landing',
  },
  {
    path: '/app/cash',
    activePaths: ['/app/cash'],
    label: 'Cash & WC',
    ariaLabel: 'Cash and working capital',
  },
  {
    path: '/app/capital',
    activePaths: ['/app/capital'],
    label: 'Capex & Procurement',
    ariaLabel: 'Capital projects and procurement commitments',
  },
  {
    path: '/app/people',
    activePaths: ['/app/people'],
    label: 'People',
    ariaLabel: 'Headcount and people cost',
  },
  {
    path: '/app/kpis',
    activePaths: ['/app/kpis'],
    label: 'KPIs',
    ariaLabel: 'Key performance indicators',
  },
  {
    path: '/app/scenarios',
    activePaths: ['/app/scenarios'],
    label: 'Scenarios',
    ariaLabel: 'Scenarios — governed scenario planning',
  },
  {
    path: '/app/commentary',
    activePaths: ['/app/commentary'],
    label: 'Commentary',
    ariaLabel: 'Commentary — reporting approvals',
  },
  {
    path: '/app/controls',
    activePaths: ['/app/controls', '/app/quality'],
    label: 'Quality & Controls',
    ariaLabel: 'Forecast quality and finance controls',
  },
  {
    path: '/app/explore',
    activePaths: ['/app/explore'],
    label: 'Explore & Ask',
    ariaLabel: 'Explore data and ask grounded questions',
  },
] as const;

export function surfaceFor(path: string): Surface | undefined {
  return SURFACES.find((surface) => surface.activePaths.includes(path));
}
