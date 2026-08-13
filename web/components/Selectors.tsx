/**
 * The header selectors: period, month, entity, comparator, currency lens.
 *
 * Every one of them is a **link**, not a control. That is the load-bearing decision in this file and it
 * follows from the view living in the URL: a `<select>` needs client JavaScript to navigate, and the
 * moment a selection lives in component state the address bar and the screen can disagree. Links cannot
 * disagree — the href *is* the view, so a reader can copy it, a deck slide can carry it, and a tour step
 * can land on it.
 *
 * It also means the whole header works with JavaScript off, and that every selection is a real
 * navigation the browser's back button understands. A dropdown that changes the page without changing
 * history is the control readers complain about without being able to say why.
 *
 * The cost is honest: five rows of chips takes more width than five dropdowns. On this surface that is
 * affordable, and it makes the current view visible at a glance rather than collapsed behind a label.
 */

import { entity, type CurrencyLens } from '@kestrel/model';
import type { ComparatorId } from '@kestrel/measures';

import { PERSONAS } from '../lib/permissions';
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

function Row({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="sel-row">
      <span className="sel-label">{label}</span>
      <div className="sel-chips">{children}</div>
    </div>
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
  reported: 'Reported',
  constant: 'Constant currency',
  functional: 'Functional',
};

export function Selectors({ path, view }: { readonly path: string; readonly view: View }) {
  /* `SELECTABLE_MONTHS` is newest-first, so "older" is the next index and "newer" the previous one.
     Undefined at either end, which is what the stepper renders as a dead arrow. */
  const at = SELECTABLE_MONTHS.indexOf(view.through);
  const older = at === -1 ? undefined : SELECTABLE_MONTHS[at + 1];
  const newer = at <= 0 ? undefined : SELECTABLE_MONTHS[at - 1];

  return (
    <div className="selectors">
      {view.deniedEntityId === undefined ? null : (
        <p className="banner banner-warn" role="status">
          Access refused for {view.principal.label}: {entity(view.deniedEntityId).name} is outside
          this persona&rsquo;s entity scope. Showing {entity(view.entityId).name} instead.
        </p>
      )}

      <Row label="View as">
        {PERSONAS.map((persona) => (
          <Chip
            key={persona.id}
            href={hrefFor(path, view, { persona: persona.id })}
            active={view.principal.id === persona.id}
            title={`${persona.role}; ${entity(persona.grant.entityRootId).name}`}
          >
            {persona.label}
          </Chip>
        ))}
      </Row>

      <Row label="Period">
        {PERIOD_KINDS.map((kind: PeriodKind) => (
          <Chip
            key={kind}
            href={hrefFor(path, view, { period: kind })}
            active={view.periodKind === kind}
          >
            {PERIOD_LABELS[kind]}
          </Chip>
        ))}
      </Row>

      {/* A stepper, not twelve chips.

          Twelve month chips is the single widest thing on the page, and it pushed the whole control
          block to four stacked rows — the controls were louder than the content they controlled, and a
          reader met a wall of dates before a figure. A stepper is two links and a label, and it is also
          how somebody actually moves through months: one at a time, in order.

          The ends are rendered as plain text rather than disabled links, because a link that cannot be
          followed is a control that has to explain itself. */}
      <div className="sel-row">
        <span className="sel-label">Through</span>
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
      </div>

      <Row label="Entity">
        {selectableEntities(view.principal).map((e) => (
          <Chip
            key={e.id}
            href={hrefFor(path, view, { entity: e.id })}
            active={view.entityId === e.id}
          >
            {e.name}
          </Chip>
        ))}
      </Row>

      <Row label="Against">
        {(Object.keys(COMPARATOR_LABELS) as ComparatorId[]).map((id) => (
          <Chip
            key={id}
            href={hrefFor(path, view, { comparator: id })}
            active={view.comparator.id === id}
            /* The trend's own limitation, on the control that selects it rather than in a footnote a
               reader meets after they have already drawn a conclusion from it. */
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
      </Row>

      <Row label="Currency">
        {(Object.keys(LENS_LABELS) as CurrencyLens[]).map((lens) => (
          <Chip
            key={lens}
            href={hrefFor(path, view, { lens })}
            active={view.lens === lens}
            title={
              lens === 'constant'
                ? 'This period’s trading translated at the comparative period’s rates, so the movement excludes currency.'
                : lens === 'functional'
                  ? 'Each entity in its own currency, unconsolidated.'
                  : undefined
            }
          >
            {LENS_LABELS[lens]}
          </Chip>
        ))}
      </Row>
    </div>
  );
}
