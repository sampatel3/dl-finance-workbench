import { healthHandler } from '@demo-kit/shell';
import { isLive } from '../../../lib/anthropic';

/**
 * `/api/health` — the one fact that makes a deploy verifiable: the commit it is running.
 *
 * The commit comes from Vercel's own `VERCEL_GIT_COMMIT_SHA`, set from the git metadata the
 * CLI sends with the deploy, and the deploy step polls here until it matches the commit it
 * shipped. A deploy is not done because a CLI said SUCCESS; it is done when the live site
 * says it is running the commit that was deployed. (A build-time variable cannot do this
 * job: this route reads its environment when a request arrives, and the build's environment
 * is gone by then — see `deployedCommit` in `@demo-kit/shell`.)
 *
 * The route is on the gate's exemption list inside `@demo-kit/gate`, because the verifier
 * that polls it has no cookie — which is the whole reason it can be trusted to answer.
 *
 * The memory tier has nothing to probe, so it passes no `probe`. The postgres overlay
 * replaces this file with one that passes `() => pool.query('SELECT 1')`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = healthHandler({ tier: 'memory', mode: isLive() ? 'live' : 'keyless' });
