/**
 * Seeded principals and the row-level scope each one is allowed to resolve.
 *
 * A role answers what somebody may do; it does not answer which rows they may read. The binding
 * control for this group is the entity subtree, with optional dimension filters carried beside it.
 * Pages and Ask both consume the same resolved scope so chat cannot become a second, wider read path.
 */

import type { CostCentreCode, SegmentCode } from '@kestrel/model';
import { entity, subtree } from '@kestrel/model';

export const PERSONA_IDS = [
  'group-executive',
  'group-fpa',
  'group-controller',
  'gulf-controller',
] as const;

export type PersonaId = (typeof PERSONA_IDS)[number];
export type PersonaRole = 'executive' | 'analyst' | 'controller';

/** Exact filters the measure context must add to every query for this principal. */
export interface DimensionFilters {
  readonly segmentId?: SegmentCode;
  readonly costCentreId?: CostCentreCode;
}

export interface Principal {
  readonly id: PersonaId;
  readonly label: string;
  readonly role: PersonaRole;
  readonly grant: {
    /** The legal-entity node whose trading descendants this principal may read. */
    readonly entityRootId: string;
    readonly dimensionFilters: DimensionFilters;
    readonly canPublish: boolean;
  };
}

export const PERSONAS: readonly Principal[] = [
  {
    id: 'group-executive',
    label: 'Group CFO',
    role: 'executive',
    grant: { entityRootId: 'group', dimensionFilters: {}, canPublish: true },
  },
  {
    id: 'group-fpa',
    label: 'Group FP&A lead',
    role: 'analyst',
    grant: { entityRootId: 'group', dimensionFilters: {}, canPublish: false },
  },
  {
    id: 'group-controller',
    label: 'Group financial controller',
    role: 'controller',
    grant: { entityRootId: 'group', dimensionFilters: {}, canPublish: true },
  },
  {
    id: 'gulf-controller',
    // The persona names the job, while the grant below names where that job may read. Keeping Gulf
    // out of the role label prevents organisational scope from masquerading as a permission role.
    label: 'Business-unit controller',
    role: 'controller',
    grant: { entityRootId: 'gulf', dimensionFilters: {}, canPublish: false },
  },
];

export const DEFAULT_PERSONA_ID: PersonaId = 'group-executive';
/** The smallest seeded grant used when somebody supplies an explicit persona id we do not know. */
export const FAIL_CLOSED_PERSONA_ID: PersonaId = 'gulf-controller';

export function principalById(id: PersonaId): Principal {
  const found = PERSONAS.find((persona) => persona.id === id);
  if (found === undefined) throw new Error(`Unknown persona: ${id}`);
  return found;
}

/** Human-readable row-level access, kept separate from the role and selected reporting scope. */
export function organisationalAccessLabel(principal: Principal): string {
  if (principal.grant.entityRootId === 'group') {
    return `Group-wide (${subtree('group').length} legal entities)`;
  }
  return `${entity(principal.grant.entityRootId).name} only`;
}

export function resolvePrincipal(raw: string | undefined): {
  readonly principal: Principal;
  readonly fellBack: boolean;
} {
  const found = PERSONAS.find((persona) => persona.id === raw);
  if (found !== undefined) return { principal: found, fellBack: false };
  return {
    /* Absence means the documented opening persona. An explicit, unrecognised identity must not turn
       into the broadest grant merely because the demo has no authentication service behind it. */
    principal: principalById(raw === undefined ? DEFAULT_PERSONA_ID : FAIL_CLOSED_PERSONA_ID),
    fellBack: raw !== undefined,
  };
}

export interface PermissionScope {
  readonly principal: Principal;
  /** The requested node after it has passed the principal's grant. */
  readonly entityRootId: string;
  readonly entityIds: readonly string[];
  readonly dimensionFilters: DimensionFilters;
  readonly canPublish: boolean;
}

export type PermissionResolution =
  | { readonly allowed: true; readonly scope: PermissionScope }
  | {
      readonly allowed: false;
      readonly requestedEntityId: string;
      readonly refusal: string;
    };

export type DimensionResolution =
  | { readonly allowed: true; readonly filters: DimensionFilters }
  | { readonly allowed: false; readonly refusal: string };

/** Apply an optional requested slice without letting it replace a principal's mandatory filter. */
export function resolveDimensionScope(
  scope: PermissionScope,
  requested: DimensionFilters,
): DimensionResolution {
  const granted = scope.dimensionFilters;
  if (
    granted.segmentId !== undefined &&
    requested.segmentId !== undefined &&
    requested.segmentId !== granted.segmentId
  ) {
    return {
      allowed: false,
      refusal:
        `Access refused for ${scope.principal.label}: this persona is restricted to the ` +
        `${granted.segmentId} segment and cannot read the ${requested.segmentId} segment.`,
    };
  }
  if (
    granted.costCentreId !== undefined &&
    requested.costCentreId !== undefined &&
    requested.costCentreId !== granted.costCentreId
  ) {
    return {
      allowed: false,
      refusal:
        `Access refused for ${scope.principal.label}: this persona is restricted to cost centre ` +
        `${granted.costCentreId} and cannot read cost centre ${requested.costCentreId}.`,
    };
  }

  return { allowed: true, filters: { ...requested, ...granted } };
}

/** Resolve one requested entity subtree without ever widening the principal's own grant. */
export function resolvePermissionScope(
  principal: Principal,
  requestedEntityId = principal.grant.entityRootId,
): PermissionResolution {
  let requestedIds: readonly string[];
  try {
    requestedIds = subtree(requestedEntityId);
  } catch {
    return {
      allowed: false,
      requestedEntityId,
      refusal: `Access refused for ${principal.label}: there is no entity called "${requestedEntityId}".`,
    };
  }

  const granted = new Set(subtree(principal.grant.entityRootId));
  if (!requestedIds.every((id) => granted.has(id))) {
    const requested = entity(requestedEntityId);
    const object = requestedEntityId === 'group' ? 'group figures' : `${requested.name} figures`;
    return {
      allowed: false,
      requestedEntityId,
      refusal:
        `Access refused for ${principal.label}: this persona is scoped to ` +
        `${entity(principal.grant.entityRootId).name} and cannot read ${object}.`,
    };
  }

  return {
    allowed: true,
    scope: {
      principal,
      entityRootId: requestedEntityId,
      entityIds: requestedIds,
      dimensionFilters: principal.grant.dimensionFilters,
      canPublish: principal.grant.canPublish,
    },
  };
}
