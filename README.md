# dl-finance-workbench

**Deeplight Finance Workbench** — a working demo of a governed measure layer over the systems Finance
already runs. Built with [demo-kit](https://github.com/sampatel3/demo-kit), which is vendored as a
submodule at `vendor/demo-kit` and pinned to one commit, so framework fixes reach this demo through
`demo update` rather than by hand.

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

## Layout

```
packages/model      the fact store: grain, basis, dimensions, three currencies with IAS 21
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
