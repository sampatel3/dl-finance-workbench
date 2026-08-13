/** CSV export for the Explore surface, resolved from the same URL contract as the page. */

import { entity } from '@kestrel/model';

import { exploreCsv, exploreState } from '../../../../lib/explore';
import { viewOf } from '../../../../lib/world';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const view = viewOf(params);
  if (view.deniedEntityId !== undefined) {
    return Response.json(
      {
        error:
          `Access refused for ${view.principal.label}: ` +
          `${entity(view.deniedEntityId).name} is outside this persona's entity scope.`,
        principal: view.principal.id,
        requestedEntity: view.deniedEntityId,
      },
      { status: 403 },
    );
  }
  const state = exploreState(params);
  if (state.dimensionRefusal !== undefined) {
    return Response.json(
      { error: state.dimensionRefusal, principal: state.view.principal.id },
      { status: 403 },
    );
  }
  const filename = `kestrel-explore-${state.view.through}.csv`;

  return new Response(exploreCsv(state), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
