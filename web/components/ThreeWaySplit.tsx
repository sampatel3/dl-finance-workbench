import type {
  ActualThreeWaySlice,
  RemainingForecastSlice,
  ThreeWaySplit as ThreeWaySplitObject,
  ThreeWayVariance,
} from '@kestrel/analysis';
import { formatMonthLong } from '@kestrel/model';
import { formatValue } from '@kestrel/measures';

import { directionClass, movement } from '../lib/format';

function VarianceLine({
  label,
  comparison,
}: {
  readonly label: string;
  readonly comparison: ThreeWayVariance;
}) {
  const showRelative = comparison.movementUnit !== comparison.varianceUnit;
  return (
    <div className="three-way-variance" title={comparison.basis}>
      <dt>{label}</dt>
      <dd className={directionClass(comparison.favourable)}>
        {movement(comparison.variance, comparison.varianceUnit)}
        {showRelative ? (
          <span className="three-way-relative">
            {' '}
            · {movement(comparison.movement, comparison.movementUnit)}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function ActualHorizon({
  slice,
  budgetLabel,
  forecastLabel,
}: {
  readonly slice: ActualThreeWaySlice;
  readonly budgetLabel: string;
  readonly forecastLabel: string;
}) {
  return (
    <article className="three-way-horizon" data-horizon={slice.kind}>
      <div className="three-way-horizon-head">
        <h4>{slice.label}</h4>
        <span>{slice.scope.label}</span>
      </div>
      <strong className="three-way-value">
        {formatValue(slice.value.value, slice.value.unit)}
      </strong>
      <span className="three-way-subject">{slice.subjectLabel}</span>
      <dl className="three-way-variances">
        <VarianceLine label={`vs ${budgetLabel}`} comparison={slice.vsBudget} />
        <VarianceLine
          label={`vs ${forecastLabel}`}
          comparison={slice.vsApprovedForecast}
        />
      </dl>
    </article>
  );
}

function RemainingHorizon({
  slice,
  budgetLabel,
  unit,
}: {
  readonly slice: RemainingForecastSlice;
  readonly budgetLabel: string;
  readonly unit: ThreeWaySplitObject['unit'];
}) {
  return (
    <article className="three-way-horizon" data-horizon={slice.kind}>
      <div className="three-way-horizon-head">
        <h4>{slice.label}</h4>
        <span>{slice.scope?.label ?? 'No projection in selected window'}</span>
      </div>
      <strong className="three-way-value">
        {formatValue(slice.value?.value ?? null, slice.value?.unit ?? unit)}
      </strong>
      <span className="three-way-subject">{slice.subjectLabel}</span>
      {slice.vsBudget === null ? (
        <p className="three-way-empty">{slice.emptyReason}</p>
      ) : (
        <dl className="three-way-variances">
          <VarianceLine label={`vs ${budgetLabel}`} comparison={slice.vsBudget} />
        </dl>
      )}
    </article>
  );
}

/**
 * The compact companion to the Performance waterfall.
 *
 * It renders the analysis object rather than recomputing a figure, which keeps the cut-off, version
 * status and selected through-month identical in the chart, the table and the evidence tests.
 */
export function ThreeWaySplit({ split }: { readonly split: ThreeWaySplitObject }) {
  const [inMonth, yearToDate, remaining] = split.slices;
  return (
    <aside
      className="pane three-way-panel"
      aria-label={`${split.measureLabel}: in month, year to date and remaining approved forecast`}
    >
      <div className="three-way-head">
        <h3>Three horizons</h3>
        <p>Read together to distinguish timing from a change in run rate.</p>
      </div>
      <div className="three-way-list">
        <ActualHorizon
          slice={inMonth}
          budgetLabel={split.budget.label}
          forecastLabel={split.approvedForecast.label}
        />
        <ActualHorizon
          slice={yearToDate}
          budgetLabel={split.budget.label}
          forecastLabel={split.approvedForecast.label}
        />
        <RemainingHorizon slice={remaining} budgetLabel={split.budget.label} unit={split.unit} />
      </div>
      <p className="three-way-basis">
        <strong>Approved basis:</strong> {split.approvedForecast.label} ({split.approvedForecast.id}),
        actuals through {formatMonthLong(split.actualsCutoff)} and projection from{' '}
        {formatMonthLong(split.projectionStarts)}. Budget: {split.budget.label} ({split.budget.id}).
      </p>
    </aside>
  );
}
