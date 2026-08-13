import { describe, expect, it } from 'vitest';
import { tradingEntities } from '@kestrel/model';

import {
  DEFAULT_PERSONA_ID,
  PERSONAS,
  principalById,
  resolveDimensionScope,
  resolvePermissionScope,
  resolvePrincipal,
} from './permissions';
import { scenarioHref } from './scenario';
import {
  contextForEntity,
  contextOf,
  hrefFor,
  hrefForTarget,
  selectableEntities,
  viewOf,
} from './world';

describe('the seeded principals', () => {
  it('have one stable id each and default to the group executive', () => {
    expect(new Set(PERSONAS.map((persona) => persona.id)).size).toBe(PERSONAS.length);
    expect(DEFAULT_PERSONA_ID).toBe('group-executive');
    expect(resolvePrincipal(undefined)).toEqual({
      principal: principalById('group-executive'),
      fellBack: false,
    });
  });

  it('fails closed to the least-privileged seeded persona when an explicit id is unknown', () => {
    const resolved = resolvePrincipal('somebody-else');
    expect(resolved.principal.id).toBe('gulf-controller');
    expect(resolved.fellBack).toBe(true);
  });
});

describe('entity-subtree permissions', () => {
  it('give the group executive every trading entity and allow a narrower entity', () => {
    const executive = principalById('group-executive');
    const group = resolvePermissionScope(executive, 'group');
    const gulf = resolvePermissionScope(executive, 'gulf');

    expect(group.allowed).toBe(true);
    if (group.allowed) {
      expect(group.scope.entityIds).toEqual(tradingEntities().map((entity) => entity.id));
    }
    expect(gulf.allowed).toBe(true);
    if (gulf.allowed) expect(gulf.scope.entityIds).toEqual(['gulf']);
  });

  it('give the Gulf controller only Gulf and refuse the group by name', () => {
    const controller = principalById('gulf-controller');
    const own = resolvePermissionScope(controller);
    const group = resolvePermissionScope(controller, 'group');

    expect(own.allowed).toBe(true);
    if (own.allowed) {
      expect(own.scope.entityRootId).toBe('gulf');
      expect(own.scope.entityIds).toEqual(['gulf']);
      expect(own.scope.dimensionFilters).toEqual({});
      expect(own.scope.canPublish).toBe(false);
    }
    expect(group.allowed).toBe(false);
    if (!group.allowed) {
      expect(group.refusal).toMatch(/Gulf business-unit controller/);
      expect(group.refusal).toMatch(/cannot read group figures/);
    }
  });
});

describe('dimension filters', () => {
  it('carry the principal filter and refuse a conflicting requested slice', () => {
    const base = principalById('group-fpa');
    const restricted = {
      ...base,
      grant: { ...base.grant, dimensionFilters: { segmentId: 'contracts' as const } },
    };
    const permission = resolvePermissionScope(restricted);
    expect(permission.allowed).toBe(true);
    if (!permission.allowed) return;

    const own = resolveDimensionScope(permission.scope, {});
    expect(own).toEqual({ allowed: true, filters: { segmentId: 'contracts' } });

    const other = resolveDimensionScope(permission.scope, { segmentId: 'equipment' });
    expect(other.allowed).toBe(false);
    if (!other.allowed) expect(other.refusal).toMatch(/contracts segment/);
  });
});

describe('the shared URL resolver', () => {
  it('defaults the Gulf controller to Gulf and carries the persona through links', () => {
    const view = viewOf({ as: 'gulf-controller' });

    expect(view.principal.id).toBe('gulf-controller');
    expect(view.entityId).toBe('gulf');
    expect(contextOf(view).entityIds).toEqual(['gulf']);
    expect(selectableEntities(view.principal).map((entry) => entry.id)).toEqual(['gulf']);
    expect(hrefFor('/app/performance', view)).toContain('as=gulf-controller');
  });

  it('clamps a forbidden group URL to Gulf and records the fallback', () => {
    const view = viewOf({ as: 'gulf-controller', entity: 'group' });

    expect(view.entityId).toBe('gulf');
    expect(view.permission.entityIds).toEqual(['gulf']);
    expect(view.deniedEntityId).toBe('group');
    expect(view.fellBack).toBe(true);
  });

  it('resolves every detail-table row through the principal instead of reusing a group context', () => {
    const executive = viewOf({});
    expect(contextForEntity(executive, 'manufacturing').entityIds).toEqual(['manufacturing']);
    expect(contextForEntity(executive, 'gulf').entityIds).toEqual(['gulf']);

    const gulf = viewOf({ as: 'gulf-controller' });
    expect(() => contextForEntity(gulf, 'group')).toThrow(/cannot read group figures/i);
  });

  it('preserves finance scope and demo-kit inner mode in finding and scenario links', () => {
    const view = viewOf({
      as: 'gulf-controller',
      month: '2026-06',
      comparator: 'prior_year',
      lens: 'constant',
      view: 'inner',
    });
    const finding = new URL(
      hrefForTarget(
        '/app/scenarios?focus=section-levers&dsoDays=10&as=group-executive&entity=group&view=full',
        view,
      ),
      'https://demo.invalid',
    );
    const scenario = new URL(
      scenarioHref(view, {}, { volume: '0.9', as: 'group-executive', entity: 'group' }),
      'https://demo.invalid',
    );

    for (const url of [finding, scenario]) {
      expect(url.searchParams.get('as')).toBe('gulf-controller');
      expect(url.searchParams.get('month')).toBe('2026-06');
      expect(url.searchParams.get('comparator')).toBe('prior_year');
      expect(url.searchParams.get('lens')).toBe('constant');
      expect(url.searchParams.get('view')).toBe('inner');
      expect(url.searchParams.get('entity')).toBeNull();
    }
    expect(finding.searchParams.get('focus')).toBe('section-levers');
    expect(finding.searchParams.get('dsoDays')).toBe('10');
    expect(scenario.searchParams.get('volume')).toBe('0.9');
  });

  it('keeps free-mode surface navigation without adding it to guided inner views', () => {
    const free = viewOf({ view: 'inner', shell: 'free' });
    const guided = viewOf({ view: 'inner' });
    expect(free.surfaceNav).toBe(true);
    expect(new URL(hrefFor('/app/cash', free), 'https://demo.invalid').searchParams.get('shell')).toBe(
      'free',
    );
    expect(guided.surfaceNav).toBe(false);
    expect(hrefFor('/app/cash', guided)).not.toContain('shell=');
  });
});
