/**
 * `/api/v1/measures` — the JSON behind the page.
 *
 * It exists so the demo can answer the question a technical buyer always asks in the second half of a
 * meeting: *is there an API, or is this a screen?* Showing the response beside the surface that renders it
 * is a shorter answer than a slide claiming one.
 *
 * Two things it deliberately does:
 *
 *   **It returns the same objects the page renders**, computed by the same catalogue through the same
 *   context resolver. A second read path is a second set of numbers, and the demo would then have two
 *   answers to every question with no way to tell which is on screen.
 *
 *   **Every figure carries its unit, its formula, its owner and its basis.** A JSON body of bare numbers
 *   is exactly the artefact the measure layer exists to replace: `{"revenue": 1239322000}` is unusable
 *   without knowing that it is minor units, consolidated, in sterling, for a window, against a comparator.
 *
 * `?pretty` for a readable body, because this response's job is to be looked at.
 */

import { NextResponse } from 'next/server';
import { entity } from '@kestrel/model';
import { formatValue } from '@kestrel/measures';

import { headlinesFor } from '../../../../lib/headline';
import { boardsFor, contextOf, scopeLabel, viewOf } from '../../../../lib/world';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const view = viewOf(params);
  const ctx = contextOf(view);
  const headlines = headlinesFor(ctx, view.comparator);
  const boards = boardsFor(view);

  const body = {
    /* The request as the resolver understood it, not as it was sent. A caller that mistyped a parameter
       gets told which view answered rather than being left to assume the one they asked for. */
    view: {
      period: view.periodKind,
      window: { from: view.scope.startMonth, to: view.scope.endMonth },
      label: scopeLabel(view.periodKind, view.scope),
      entity: { id: view.entityId, name: entity(view.entityId).name },
      lens: view.lens,
      comparator: { id: view.comparator.id, basis: boards.comparator.basis },
      forecastVersion: {
        id: view.version.id,
        label: view.version.label,
        status: view.version.status,
      },
      parametersFellBackToDefaults: view.fellBack,
    },
    measures: headlines.map((h) => ({
      id: h.measureId,
      label: h.label,
      value: h.value,
      /* Both, always. The raw value is what a caller computes with; the formatted one is what the page
         shows, and shipping only the first invites a caller to format it differently from the product. */
      formatted: formatValue(h.value, h.unit),
      unit: h.unit,
      comparative: h.comparativeValue,
      movement: h.movement,
      movementUnit: h.movementUnit,
      favourable: h.favourable,
      material: h.material,
      materiality: h.materialityReason,
      priority: h.priority,
      formula: h.formula,
      owner: h.owner,
      status: h.draft ? 'draft' : 'approved',
    })),
    boards: boards.boards.map((board) => ({
      id: board.id,
      title: board.title,
      question: board.question,
      direction: board.direction,
      horizon: board.horizon,
      findings: board.findings.map((f) => ({
        detector: f.detectorId,
        title: f.title,
        statement: f.statement,
        priority: f.priority,
        plantedCondition: f.plantedCondition,
        fingerprint: f.fingerprint,
        figures: f.figures.map((figure) => ({
          label: figure.label,
          value: figure.value,
          formatted: formatValue(figure.value, figure.unit),
          unit: figure.unit,
        })),
        action: f.action,
        ...(f.caveat === undefined ? {} : { caveat: f.caveat }),
        ...(f.materiality === undefined ? {} : { materiality: f.materiality }),
      })),
    })),
    /* Said in the body rather than left to a reader to infer from the figures. */
    notes: {
      currency:
        'Presentation currency is GBP. Monetary values are integers in minor units (pence).',
      absent: 'A null value is a genuine absence, never a zero.',
      detectorErrors: boards.errors,
    },
  };

  const pretty = url.searchParams.has('pretty');
  return new NextResponse(JSON.stringify(body, null, pretty ? 2 : 0), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
