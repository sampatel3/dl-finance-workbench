/**
 * The finance context: a readable summary, with its URL-backed selectors in a native disclosure.
 *
 * Every choice remains a **link**, not component state. The href *is* the view, so copying a URL, using
 * the browser's back button, and opening a guided tour step all reproduce the same finance context. The
 * disclosure changes only how much control furniture a reader meets before the figures.
 *
 * ## It lives in the rail
 *
 * It used to be a horizontal band above every page — five facts and an Edit button, taking a full strip
 * of vertical space at the top of a surface whose job is to show figures. In the rail it is read the
 * same way and costs the content column nothing, and it sits directly under the sections, which is
 * right: the sections are where you are and the context is what you are looking at, and both are
 * navigation in the sense that matters — they change what is on the page.
 *
 * The tour's frame has no rail, so there the band is what renders. {@link ContextPanel} is the same
 * markup either way and the container decides the axis.
 */

import React from 'react';

import { PRESENTATION, entity, type CurrencyLens } from '@kestrel/model';
import type { ComparatorId } from '@kestrel/measures';

import { PERSONAS, organisationalAccessLabel } from '../lib/permissions';
import type { PeriodKind, View } from '../lib/world';
import {
  PERIOD_KINDS,
  PERIOD_LABELS,
  SELECTABLE_MONTHS,
  hrefFor,
  monthLabel,
  scopeLabel,
  selectableEntities,
} from '../lib/world';

function Group({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <fieldset className="sel-row">
      <legend className="sel-label">{label}</legend>
      <div className="sel-chips">{children}</div>
    </fieldset>
  );
}

function Chip({
  href,
  active,
  children,
  title,
}: {
  readonly href: string;
  readonly active: boolean;
  readonly children: React.ReactNode;
  readonly title?: string;
}) {
  return (
    <a
      className={`chip-link${active ? ' is-active' : ''}`}
      href={href}
      {...(active ? { 'aria-current': 'true' as const } : {})}
      {...(title === undefined ? {} : { title })}
    >
      {children}
    </a>
  );
}

const COMPARATOR_LABELS: Readonly<Record<ComparatorId, string>> = {
  prior_period: 'Prior period',
  prior_year: 'Prior year',
  budget: 'Budget',
  forecast: 'Forecast',
  trend: 'Trend',
};

const LENS_LABELS: Readonly<Record<CurrencyLens, string>> = {
  reported: `${PRESENTATION} presentation currency`,
  constant: `${PRESENTATION} presentation currency · constant rates`,
  functional: 'Functional currency',
};

const REPORT_LENSES = ['reported', 'constant'] as const satisfies readonly CurrencyLens[];

/**
 * The access-refusal banner.
 *
 * Stays in the content column rather than moving to the rail with the rest of the context: it is not a
 * setting, it is the product telling a reader that what they asked for was refused and what they are
 * looking at instead. That belongs above the figures it is describing.
 */
export function Selectors({ view }: { readonly path?: string; readonly view: View }) {
  if (view.deniedEntityId === undefined) return null;
  return (
    <p className="banner banner-warn" role="status">
      Access refused for {view.principal.label}: {entity(view.deniedEntityId).name} is outside this
      persona&rsquo;s entity scope. Showing {entity(view.entityId).name} instead.
    </p>
  );
}

export function ContextPanel({ path, view }: { readonly path: string; readonly view: View }) {
  /* `SELECTABLE_MONTHS` is newest-first, so "older" is the next index and "newer" the previous one.
     Undefined at either end, which is what the stepper renders as a dead arrow. */
  const at = SELECTABLE_MONTHS.indexOf(view.through);
  const older = at === -1 ? undefined : SELECTABLE_MONTHS[at + 1];
  const newer = at <= 0 ? undefined : SELECTABLE_MONTHS[at - 1];
  const comparator =
    view.comparator.id === 'forecast'
      ? view.version.label
      : COMPARATOR_LABELS[view.comparator.id];

  return (
    <section className="context-shell" aria-label="Finance context">
      <div className="context-bar">
        <p className="context-current">
          <span className="context-value">
            Role: {' '}
            {view.principal.label}
          </span>
          <span className="context-separator" aria-hidden>
            ·
          </span>
          <span className="context-value">
            Period: {' '}
            {scopeLabel(view.periodKind, view.scope)}
          </span>
          <span className="context-separator" aria-hidden>
            ·
          </span>
          <span className="context-value">
            Organisational scope: {' '}
            {entity(view.entityId).name}
          </span>
          <span className="context-separator" aria-hidden>
            ·
          </span>
          <span className="context-value">
            Comparator: vs {comparator}
          </span>
          <span className="context-separator" aria-hidden>
            ·
          </span>
          <span className="context-value">
            Currency: {' '}
            {LENS_LABELS[view.lens]}
          </span>
        </p>

        <details className="context-editor">
          <summary className="context-edit-trigger">Edit context</summary>
          <div className="selectors context-editor-body">
            <Group label="Role">
              {PERSONAS.map((persona) => (
                <Chip
                  key={persona.id}
                  href={hrefFor(path, view, { persona: persona.id })}
                  active={view.principal.id === persona.id}
                  title={`${persona.role}; access: ${organisationalAccessLabel(persona)}`}
                >
                  {persona.label}
                </Chip>
              ))}
            </Group>

            <Group label="Role access">
              <span className="step-now">{organisationalAccessLabel(view.principal)}</span>
            </Group>

            <Group label="Period">
              {PERIOD_KINDS.map((kind: PeriodKind) => (
                <Chip
                  key={kind}
                  href={hrefFor(path, view, { period: kind })}
                  active={view.periodKind === kind}
                >
                  {PERIOD_LABELS[kind]}
                </Chip>
              ))}
            </Group>

            {/* A stepper, not twelve chips. The ends are plain text rather than disabled links, because
                a link that cannot be followed is a control that has to explain itself. */}
            <fieldset className="sel-row">
              <legend className="sel-label">Through</legend>
              <div className="sel-step">
                {older === undefined ? (
                  <span className="step-end" aria-hidden>
                    ←
                  </span>
                ) : (
                  <a
                    className="step-link"
                    href={hrefFor(path, view, { month: older })}
                    aria-label={`Back to ${monthLabel(older)}`}
                  >
                    ←
                  </a>
                )}
                <span className="step-now">{scopeLabel(view.periodKind, view.scope)}</span>
                {newer === undefined ? (
                  <span className="step-end" aria-hidden>
                    →
                  </span>
                ) : (
                  <a
                    className="step-link"
                    href={hrefFor(path, view, { month: newer })}
                    aria-label={`Forward to ${monthLabel(newer)}`}
                  >
                    →
                  </a>
                )}
              </div>
            </fieldset>

            <Group label="Organisational scope">
              {selectableEntities(view.principal).map((e) => (
                <Chip
                  key={e.id}
                  href={hrefFor(path, view, { entity: e.id })}
                  active={view.entityId === e.id}
                >
                  {e.name}
                </Chip>
              ))}
            </Group>

            <Group label="Against">
              {(Object.keys(COMPARATOR_LABELS) as ComparatorId[]).map((id) => (
                <Chip
                  key={id}
                  href={hrefFor(path, view, { comparator: id })}
                  active={view.comparator.id === id}
                  /* The trend's limitation lives on the control that selects it, before a reader can
                     draw a conclusion from a fitted expectation. */
                  title={
                    id === 'trend'
                      ? 'A fitted expectation, not a plan anybody committed to — so nothing is measured as material against it and it cannot raise a board item.'
                      : undefined
                  }
                >
                  {COMPARATOR_LABELS[id]}
                  {id === 'trend' ? <span className="chip-mark">fit</span> : null}
                </Chip>
              ))}
            </Group>

            <Group label="Currency basis">
              {REPORT_LENSES.map((lens) => (
                <Chip
                  key={lens}
                  href={hrefFor(path, view, { lens })}
                  active={view.lens === lens}
                  title={
                    lens === 'constant'
                      ? `Group presentation in ${PRESENTATION}, with this period’s trading translated at like-for-like prior-year rates so the movement excludes FX.`
                      : `Group presentation in ${PRESENTATION}; foreign entities are translated from their functional currencies at the governed rates for this period.`
                  }
                >
                  {LENS_LABELS[lens]}
                </Chip>
              ))}
            </Group>
          </div>
        </details>
      </div>
    </section>
  );
}
