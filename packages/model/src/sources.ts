/**
 * Governed source and load projections.
 *
 * Source definitions and vintages already live in `VintageRegister`; this file does not seed a
 * second inventory. It joins those records into the shape a Controls surface needs while preserving
 * the register's own ordering and validation outcome. A configured source with no modelled load is
 * retained explicitly — silently dropping it would make "not loaded" look like "not required".
 */

import type {
  LoadStatus,
  SourceSystem,
  Vintage,
  VintageRegister,
} from './vintages.ts';

export type LoadValidation = 'passed' | 'exceptions' | 'rejected';

export interface SourceLoad {
  readonly source: SourceSystem;
  readonly vintage: Vintage;
  readonly validation: LoadValidation;
}

export type SourceLoadStatus = LoadStatus | 'not_loaded';

export interface SourceStatus {
  readonly source: SourceSystem;
  readonly loads: readonly SourceLoad[];
  readonly latestStatus: SourceLoadStatus;
  readonly latestLoad?: SourceLoad;
  readonly exceptionCount: number;
  readonly restatementCount: number;
}

function validationOf(status: LoadStatus): LoadValidation {
  switch (status) {
    case 'accepted':
      return 'passed';
    case 'accepted_with_exceptions':
      return 'exceptions';
    case 'rejected':
      return 'rejected';
  }
}

/** Every load, joined to the source that owns it, in the register's deterministic load order. */
export function sourceLoads(register: VintageRegister): SourceLoad[] {
  return register.vintages().map((vintage) => ({
    source: register.source(vintage.sourceId),
    vintage,
    validation: validationOf(vintage.status),
  }));
}

/** Every configured source and the complete load history registered against it. */
export function sourceStatuses(register: VintageRegister): SourceStatus[] {
  const loads = sourceLoads(register);
  return register.sources().map((source) => {
    const forSource = loads.filter((load) => load.source.id === source.id);
    const latestLoad = forSource.at(-1);
    return {
      source,
      loads: forSource,
      latestStatus: latestLoad?.vintage.status ?? 'not_loaded',
      ...(latestLoad === undefined ? {} : { latestLoad }),
      exceptionCount: forSource.filter((load) => load.validation !== 'passed').length,
      restatementCount: forSource.filter(
        (load) => load.vintage.restatesVintageId !== undefined,
      ).length,
    };
  });
}
