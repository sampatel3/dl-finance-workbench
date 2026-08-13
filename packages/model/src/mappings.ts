/**
 * Mapping-set controls derived from the effective-dated sets in the world.
 *
 * The amount at stake is summed from `MappingSet.unmapped`; it is never repeated as a dashboard
 * literal. That makes the £212k panel and the `unmapped_opex` reconciling line two readings of the
 * same exception rather than two claims that happen to agree today.
 */

import { entity } from './entities.ts';
import type { FiscalMonth } from './period.ts';
import type { MappingSet, UnmappedAccount } from './vintages.ts';
import { mappingSetFor } from './vintages.ts';

export interface GovernedUnmappedAccount extends UnmappedAccount {
  readonly entityName: string;
}

export interface MappingControl {
  readonly mappingSet: MappingSet;
  readonly totalCodes: number;
  /** A rate from zero to one, based on source-code count rather than value. */
  readonly coverage: number;
  readonly unmappedCount: number;
  readonly amountAtStakeMinor: number;
  readonly unmapped: readonly GovernedUnmappedAccount[];
}

function projectMappingSet(mappingSet: MappingSet): MappingControl {
  const unmapped = mappingSet.unmapped.map((row) => ({
    ...row,
    entityName: entity(row.entityId).name,
  }));
  const totalCodes = mappingSet.mappedCodes + unmapped.length;
  return {
    mappingSet,
    totalCodes,
    coverage: totalCodes === 0 ? 1 : mappingSet.mappedCodes / totalCodes,
    unmappedCount: unmapped.length,
    amountAtStakeMinor: unmapped.reduce((sum, row) => sum + row.amountMinor, 0),
    unmapped,
  };
}

/** The approved mapping control in force for a fiscal month. */
export function mappingControlFor(
  mappingSets: readonly MappingSet[],
  month: FiscalMonth,
): MappingControl | undefined {
  const mappingSet = mappingSetFor(mappingSets, month);
  return mappingSet === undefined ? undefined : projectMappingSet(mappingSet);
}

/** Full version history, including drafts and superseded sets. */
export function mappingControls(mappingSets: readonly MappingSet[]): MappingControl[] {
  return [...mappingSets]
    .sort((a, b) => a.version - b.version)
    .map(projectMappingSet);
}
