import { resolveView } from '@demo-kit/shell';
import { closePositionsFor } from '@kestrel/model';
import { formatValue } from '@kestrel/measures';

import { Masthead } from '../../components/Chrome';
import { AccountingStatusBanner } from '../../components/Figures';
import { FocusOnLoad } from '../../components/FocusOnLoad';
import { Selectors } from '../../components/Selectors';
import { accountingStatus } from '../../lib/close';
import { directionClass, movement } from '../../lib/format';
import { buildPeople } from '../../lib/people';
import type { Params } from '../../lib/world';
import { viewOf, world } from '../../lib/world';

/**
 * Headcount and people cost.
 *
 * The section the review adds, and the one whose numbers form a loop rather than a list: pressure
 * raises attrition, attrition opens vacancies, vacancies are covered with bought-in labour, and the
 * bought-in labour is what compressed the margin. Every figure is seeded from the same driver as the
 * financial result, so a reader following the loop finds it holds in the data.
 *
 * The cost table separates headcount from cost per head deliberately. A staff cost 6% over plan means
 * one thing at flat headcount and a completely different thing at 6% more people, and a page reporting
 * only the cost movement has told a reader that something happened without telling them what.
 */

export const dynamic = 'force-dynamic';

export default async function People({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;
  const view = viewOf(params);
  const people = buildPeople(view);
  const status = accountingStatus(
    closePositionsFor(world().closePositions, view.scope.endMonth).filter((position) =>
      view.permission.entityIds.includes(position.entityId),
    ),
  );

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      <Masthead path="/people" view={view} />
      <Selectors path="/people" view={view} />
      <AccountingStatusBanner status={status} />

      <section className="section focusable" id="section-people-story" aria-label="People summary">
        <div className="section-head">
          <h2 className="section-title">Payroll, and what is moving it</h2>
          <span className="section-note">
            Written by code from the figures below, because the causes on this page are the whole
            point and a plausible-sounding one nobody could evidence would be worse than none.
          </span>
        </div>
        <p className="narration">{people.story}</p>
      </section>

      <section className="section focusable" id="section-people-cost" aria-label="People cost">
        <div className="section-head">
          <h2 className="section-title">Cost of the workforce</h2>
          <span className="section-note">
            Headcount and cost per head are held apart on purpose: staff cost over plan means one
            thing at flat headcount and another at more people, and only the two together say which.
            Cost per FTE is annualised on the window&rsquo;s real days and excludes subcontract
            labour, which is bought by the hour rather than employed — the contractor share below is
            where that cost shows.
          </span>
        </div>
        <div className="pane pane-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="num">
                  This period
                </th>
                <th scope="col" className="num">
                  Prior month
                </th>
                <th scope="col" className="num">
                  {people.lines[0]?.comparatorLabel ?? 'Comparator'}
                </th>
                <th scope="col" className="num">
                  Movement
                </th>
              </tr>
            </thead>
            <tbody>
              {people.lines.map((line) => (
                <tr key={line.measureId}>
                  <th scope="row">
                    {line.label}
                    {line.status === 'draft' ? <span className="chip-draft">Draft</span> : null}
                    {line.note === undefined ? null : (
                      <span className="row-note">{line.note}</span>
                    )}
                  </th>
                  <td className="num">
                    <strong>{formatValue(line.value, line.unit)}</strong>
                  </td>
                  <td className="num muted-cell">{formatValue(line.priorMonth, line.unit)}</td>
                  <td className="num muted-cell">{formatValue(line.comparative, line.unit)}</td>
                  <td className={`num ${directionClass(line.favourable)}`}>
                    {movement(line.movement, line.movementUnit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="section focusable"
        id="section-departments"
        aria-label="Headcount by department"
      >
        <div className="section-head">
          <h2 className="section-title">By department</h2>
          <span className="section-note">
            By cost centre, which is what a department is in a ledger — so the headcount and the
            payroll behind it come from the same rows rather than from two systems that disagree. The
            share is against the group this session may read, not against the whole business: a
            percentage of something a reader cannot see is a leak wearing a percent sign.
          </span>
        </div>
        <div className="pane pane-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Department</th>
                <th scope="col">Owner</th>
                <th scope="col" className="num">
                  Headcount
                </th>
                <th scope="col" className="num">
                  Share
                </th>
                <th scope="col" className="num">
                  Staff cost
                </th>
                <th scope="col" className="num">
                  Cost per FTE
                </th>
                <th scope="col" className="num">
                  Open roles
                </th>
              </tr>
            </thead>
            <tbody>
              {people.departments.map((row) => (
                <tr key={row.code}>
                  <th scope="row">{row.label}</th>
                  <td>{row.owner}</td>
                  <td className="num">{formatValue(row.headcount, 'count')}</td>
                  <td className="num muted-cell">{formatValue(row.share, 'percent')}</td>
                  <td className="num">{formatValue(row.staffCost, 'currency')}</td>
                  <td className="num">{formatValue(row.costPerFte, 'currency')}</td>
                  <td className="num">{formatValue(row.openRoles, 'count')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="chart-note">
            Departments do not sum to the group total on cost per FTE, because a rate is not summed —
            it is recomputed at every level from the payroll and the heads at that level.
          </p>
        </div>
      </section>

      {people.entities.length < 2 ? null : (
        <section className="section focusable" id="section-people-entities" aria-label="By entity">
          <div className="section-head">
            <h2 className="section-title">By entity</h2>
            <span className="section-note">
              Where the contractor mix and the turnover actually sit. The two move together, and the
              entity where they are highest is the one whose margin moved.
            </span>
          </div>
          <div className="pane pane-scroll">
            <table className="grid">
              <thead>
                <tr>
                  <th scope="col">Entity</th>
                  <th scope="col" className="num">
                    Headcount
                  </th>
                  <th scope="col" className="num">
                    Contractor share
                  </th>
                  <th scope="col" className="num">
                    Staff cost
                  </th>
                  <th scope="col" className="num">
                    Turnover (YTD)
                  </th>
                  <th scope="col" className="num">
                    Open roles
                  </th>
                </tr>
              </thead>
              <tbody>
                {people.entities.map((row) => (
                  <tr key={row.entityId}>
                    <th scope="row">{row.name}</th>
                    <td className="num">{formatValue(row.headcount, 'count')}</td>
                    <td className="num">{formatValue(row.contractorShare, 'percent')}</td>
                    <td className="num">{formatValue(row.staffCost, 'currency')}</td>
                    <td className="num">{formatValue(row.turnover, 'percent')}</td>
                    <td className="num">{formatValue(row.openRoles, 'count')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="section focusable" id="section-workforce" aria-label="Workforce health">
        <div className="section-head">
          <h2 className="section-title">Workforce health</h2>
          <span className="section-note">
            The non-financial half, and the leading half. Every one of these moves before the cost
            line does — which is the review&rsquo;s argument for the section and the reason they are
            on the same page as the payroll rather than in an appendix. Measured over{' '}
            <strong>{people.workforceWindow.toLowerCase()}</strong> rather than over the selected
            month: one month&rsquo;s attrition at a 31-person entity is a single rounded leaver, and
            the first cut of this table put the smallest entity top of the group on that basis alone.
          </span>
        </div>
        <div className="pane pane-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="num">
                  Year to date
                </th>
                <th scope="col" className="num">
                  A month earlier
                </th>
                <th scope="col" className="num">
                  Movement
                </th>
                <th scope="col">Owner</th>
              </tr>
            </thead>
            <tbody>
              {people.workforce.map((line) => (
                <tr key={line.measureId}>
                  <th scope="row">
                    {line.label}
                    {line.status === 'draft' ? <span className="chip-draft">Draft</span> : null}
                    {line.note === undefined ? null : (
                      <span className="row-note">{line.note}</span>
                    )}
                  </th>
                  <td className="num">
                    <strong>{formatValue(line.value, line.unit)}</strong>
                  </td>
                  <td className="num muted-cell">{formatValue(line.priorMonth, line.unit)}</td>
                  <td className={`num ${directionClass(line.favourable)}`}>
                    {movement(line.movement, line.movementUnit)}
                  </td>
                  <td>{line.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="chart-note">
            <strong>What is deliberately not here.</strong> The review names diversity and inclusion
            metrics where appropriate. There is no defensible way to seed them: fabricating
            demographic data about fictional employees and rendering it as though a system had
            measured it is not a demonstration of a capability. The same reasoning, at lower stakes,
            keeps the hiring pipeline out — a pipeline of named candidates lives in an applicant
            system. Open roles is the half a finance system genuinely holds, and it is the half that
            costs money.
          </p>
        </div>
      </section>
    </main>
  );
}
