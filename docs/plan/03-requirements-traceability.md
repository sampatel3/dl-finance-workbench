# Requirements traceability

One row per thing the demo claims, and where that claim is kept. The point is the empty
cells: a requirement with no code is unbuilt, and a requirement with no test is unproven.

| # | Requirement | Where it lives | What proves it |
|---|---|---|---|
| 1 | The demo is gated and says it is a demonstration | `web/middleware.ts`, `web/app/gate/page.tsx` | `packages/gate` tests; `e2e/gate.spec.ts` (postgres tier) |
| 2 | The same seed produces the same world | `web/lib/world.ts` | `web/lib/world.test.ts` |
| 3 | The detectors stay quiet on a healthy book | `web/lib/findings.ts` | `web/lib/findings.test.ts` |
| 4 | The cached brief matches the data it was written from | `web/lib/narration.generated.ts` | `web/lib/narration.test.ts` |
| 5 | No figure in an answer is invented | `web/lib/tools.ts` | `web/lib/tools.test.ts`; the grounding check in `@demo-kit/llm` |
| 6 | The deployed commit is reported and verified | `web/app/api/health/route.ts` | the verify step in `.github/workflows/deploy.yml` |
| 7 | <this demo's own claim> | | |

Rows drift. The last wave's documentation pass re-reads every one of them against the code
and corrects what moved.
