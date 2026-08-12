import { GateForm } from '@demo-kit/gate';
import { DEMO_MARK, DEMO_NAME } from '../../lib/demo';

/**
 * The gate page. The form is server-rendered and posts plain HTML, so the gate works with no
 * client JavaScript and cannot break on a hydration error — which matters more here than
 * anywhere else in the demo, because everything is behind it.
 */

export const dynamic = 'force-dynamic';

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; retry?: string }>;
}) {
  const { next, error, retry } = await searchParams;
  return (
    <GateForm
      title={DEMO_NAME}
      subtitle="A demonstration build. Every figure inside belongs to a fictional business."
      mark={DEMO_MARK}
      next={next}
      error={error === 'blocked' ? 'blocked' : error ? 'wrong' : undefined}
      retryAfterSeconds={retry === undefined ? undefined : Number(retry)}
    />
  );
}
