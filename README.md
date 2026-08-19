# dl-finance-workbench

**Deeplight Finance Workbench** — a working demo of a governed measure layer over the systems Finance
already runs. Built with [demo-kit](https://github.com/sampatel3/demo-kit), vendored as a pinned
submodule at `vendor/demo-kit`. The current pin, `cdb750a`, is on Demo Kit's default branch and
includes the canonical Deeplight reference deck, shared product-deck grammar and Free-mode shell.

The company is **Kestrel Industrial Group**: five entities, four currencies, forty-three closed months
to July 2026. It does not exist. Every figure is computed from one seed string — which is why the
period selector, the entity picker, the comparator, the version diff and the scenario controls all
genuinely recompute rather than relabel, and why nothing on any screen is a literal somebody typed.

Nothing here is written to any system of record. The product has no journal-posting capability, by
construction.

## Running it

Needs node 24 (see `.nvmrc`) and pnpm 11.

```
pnpm install
pnpm --filter web dev        # http://localhost:3000 — no passcode locally, so no gate
pnpm -r typecheck && pnpm -r test
```

`DEMO_PASSCODE` sets the gate; with none configured there is no gate, so a fresh checkout just runs.
`ANTHROPIC_API_KEY` makes the commentary headlines and the Ask panel live. Without it the demo is
whole: commentary ships the sentence code wrote, and Ask says plainly that it cannot look anything up
rather than guessing.

The deployed gate passcode is **`qgb9-wyjy-qz97`**. It is written down here on purpose: the repo is
private, and a demo nobody can open is not a demo.

## Deploying it

Releases are deployed manually from the repository root. Run the repository gates first, then use the
pinned kit's deploy command; it builds and ships the memory-tier app and polls `/api/health` until the
live site reports the exact SHA supplied to it. A release that cannot prove its commit is not complete.

Everything runs from the repo **root**, not from `web/`, and `vercel.json` is what points the build
back down at the app. The app is a member of a pnpm workspace whose `node_modules` live at the root,
so a build run inside `web/` traces Next's server files above the deploy root: they never reach the
deployment and the first request dies on a missing `next-server.js`. That is a lesson from the kit's
own first real deploy rather than a precaution.

```sh
pnpm install
pnpm -r typecheck
pnpm -r test
pnpm --filter web build
pnpm --filter web deck:lint
```

Then deploy the verified tree:

```sh
pnpm -C vendor/demo-kit demo deploy --tier memory --dir "$PWD" \
  --sha "$(git rev-parse HEAD)" --url https://dl-finance-workbench.vercel.app/api/health
```

Keep the literal deployed SHA, UTC timestamp and returned health payload in the release transcript;
[`docs/plan/02-verification.md`](docs/plan/02-verification.md) records the non-self-referential
contract those values must satisfy.

## Updating the kit

The shared machinery — the shell, the gate, the model seam and the deck — is vendored as a pinned
submodule. The current parent pointer is `cdb750a3248181f309ad3428d7fbe08641ee03a9`, published on
[`sampatel3/demo-kit`](https://github.com/sampatel3/demo-kit) `main`. That central commit owns the
canonical Deeplight company deck, the shared slide components and the product-deck authoring rules;
`web/public/reference.html` is only a generated mirror.

Verify the pin with:

```sh
git -C vendor/demo-kit rev-parse HEAD
pnpm -C vendor/demo-kit -r typecheck
pnpm -C vendor/demo-kit -r test
```

Future updates should land on Demo Kit `main` first. Run the kit and workbench gates, update this
submodule pointer to the verified central commit, run `pnpm --filter web deck:sync`, and commit the
generated deck assets with the pointer. Never edit the generated reference deck in this repository.

## Layout

```
packages/model      the fact store: grain, basis, dimensions, four functional currencies with IAS 21
                    translation, immutable load vintages, consolidation, and the seeded group
packages/measures   the certified measure catalogue — also the semantic layer the chat reads —
                    computed with its inputs recorded, which is the bottom of the drill spine
packages/analysis   variance and the bridge, the driver graph, forecast and version diff, cash
                    (13-week direct and the indirect bridge), forecast quality, the detectors
web                 the Next 15 app: three front doors — executive, analyst, controller
vendor/demo-kit     the kit, as a submodule: gate, data, llm, shell, deck
docs/review         the review of the client's PRD, and what the product should be
docs/plan           the build plan, the costed decisions, verification, traceability
docs/deck           the product deck as a committed PDF
```

## Read these in order

| Document | What it covers |
| --- | --- |
| [`docs/review/00-source-review.md`](docs/review/00-source-review.md) | What the client's PRD and slides say, what is already right in them, and twelve findings. §7 reviews the revised PRD: what it confirms, the six deltas it adds, three things to push back on |
| [`docs/review/01-product-definition.md`](docs/review/01-product-definition.md) | What the product should be: three front doors on one model, the surfaces, enterprise connectivity platform by platform, the data model, the engines, and the AI's grounding contract and action ladder |
| [`docs/plan/00-build-plan.md`](docs/plan/00-build-plan.md) | What is being built in what order, the group and the twelve conditions planted in it, and the command that proves each wave |
| [`docs/plan/01-decisions.md`](docs/plan/01-decisions.md) | Twenty decisions that could have gone the other way, each with its cost stated alongside its reason |
| [`docs/plan/02-verification.md`](docs/plan/02-verification.md) | The invariants, what no test will catch, and every defect found and fixed |
| [`docs/plan/03-requirements-traceability.md`](docs/plan/03-requirements-traceability.md) | Every `FW-*` requirement and every finding, mapped to where it lives and a way to check it |
