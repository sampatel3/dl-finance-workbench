# dl-finance-workbench — build plan

**This began as a promise and is now the implementation record for all eight waves.** The repository
work for Waves 0–7 is implemented and locally verified: the model, measures, analysis, all three
product front doors, the expanded guided tour, the latest Free-mode shell behaviour and the
twelve-slide deck. The deck's ten product shots were regenerated; lint, aspect and overflow checks
pass; and the committed twelve-page tagged PDF was visually reviewed. Release is a deliberate manual
operation. The releaser captures the deployed SHA, timestamp and live `/api/health` response in the
release transcript and evaluates them against the contract in [`02-verification.md`](02-verification.md),
so this document never confuses a locally verified tree with a hosted commit.

Source citations use `kit: <path>` for demo-kit and `ceo: <path>` for the ceo-dashboard reference.
Nothing is copied from `ceo:` — it is read for its mechanisms and its standard, and every
mechanism reused is named at the point of reuse.

---

## What is being built

A live, passcode-gated demo of the Deeplight Finance Workbench, in its own repo
`sampatel3/dl-finance-workbench`, scaffolded by demo-kit and vendoring the kit as a submodule so
framework fixes propagate.

A visitor lands on a guided tour, and beside it a real product: **Kestrel Industrial Group**, a
fictional five-entity, four-currency mid-market group, 43 closed months, every figure computed from
a seeded fact store. The tour walks an executive through what changed in July 2026, then hands the
window over so the visitor can drill the same numbers down to the source rows, take a bridge apart,
change a forecast driver and watch the cash line move, and read the approval trail behind the
commentary.

**What it is not.** It is not the product — it is a demo of the product, and the demo says so on
its own gate page: the group is synthetic, the figures are generated from a fixed seed, and nothing
a visitor does is written to any system of record. It does not connect to a real ERP; §4 of
[`01-product-definition.md`](../review/01-product-definition.md) is represented as a modelled ingestion layer
with its statuses, vintages and validation results in the seed, which is what makes the Controls
surface honest rather than decorative.

The modelled register contains deterministic monthly histories for all nine configured feeds, plus
the June restatement. Facts carry the vintage of the feed that supplied them: entity GLs, PSA, CRM,
payroll and bank for actuals, and Anaplan for forecast and budget.

## The tier, and the one thing it costs

**Memory tier**, with scenario state carried in the URL.

A scenario is defined in §3.6 of the product definition as a base version plus a set of assumption
deltas and nothing else. That definition makes it a pure function, which means it can live entirely
in a query string — `?base=v7&rev=-8&subrate=+4` — and recompute deterministically on the server.
The visitor gets a scenario that is shareable as a link, reproducible on any machine, and
screenshotable; the demo gets no database, no migrations, no Railway bill, one CI path, and no
possibility of two prospects treading on each other.

**The cost, stated.** Two things genuinely need persistence and do not have it: a scenario saved
under a visitor-defined name, and a workflow transition made by that visitor. Both are handled
honestly. A scenario is the URL itself, and the seeded library is a list of reproducible links. The
commentary queue spans draft, in review, approved, published and rejected-with-reason, so the state
machine and its evidence can be read and drilled; role-appropriate actions are labelled preview-only
and perform no mutation. If a client conversation requires saved names or live approvals to survive
a reload, that is the trigger to move to the postgres tier — recorded as a decision with its cost in
[`01-decisions.md`](01-decisions.md) §1, not discovered mid-build.

## The world

Everything below is generated from one seed string. Nothing is a typed-in figure, which is what
makes the period selector, the entity picker, the version diff and the scenario sliders all
genuinely recompute rather than relabel.

### The group

| Entity | Country | Functional currency | Division |
| --- | --- | --- | --- |
| Kestrel Industrial Group plc | UK | GBP *(presentation)* | — |
| Kestrel Manufacturing Ltd | UK | GBP | Products |
| Kestrel Services Ltd | UK | GBP | Services |
| Kestrel Gulf Technical Services FZ-LLC | UAE | AED | Services |
| Kestrel Europe GmbH | Germany | EUR | Products |
| Kestrel Inc | US | USD | Services |

Presentation currency is GBP, which is what slide 5 shows. AED is pegged to the dollar and EUR and
USD are not, so translation is a real effect in three entities and a stable one in the fourth —
an honest detail that a made-up rate table would miss.

Segments: **Equipment**, **Spares**, **Service contracts**, **Projects**. Cost centres:
manufacturing operations, field service, engineering, sales & marketing, finance & administration,
IT. Periods: **2023-01 through 2026-07**, 43 closed months, plus 13 forward weeks for cash. July
2026 is the reporting month, which is also the month the PRD's own illustrative question asks for a
board commentary on.

Scale is tuned so the four headline figures land on slide 5's illustration — revenue £12.4m, gross
margin 41.8%, EBITDA £2.1m, cash £4.8m — as **computed results** rather than literals. Reproducing
the client's own concept from a live model is the single most persuasive thing the demo can do, and
it is also the trap the reference demo's Figma predecessor fell into: those four figures are the
output of the seed, and if a threshold or a rate changes they will move, and the freshness test
will say so rather than the numbers quietly drifting away from the deck.

### Versions

`BUDGET FY26` (approved) · `FORECAST v5` (Q1 reforecast, superseded) · `FORECAST v6` (Q2
reforecast, approved — the version the PRD's example question asks about) · `FORECAST v7` (July
roll, draft, active).

### Vintages

A monthly core load per entity, plus one restatement: the July load restates June at Kestrel
Services, reclassifying £310k from cost of sales to operating expense. Prior-period gross margin
therefore moves between vintages, which is exactly why the model holds vintages and why a published
pack pins one.

### What is deliberately wrong in it

Twelve planted conditions. Each is **true in the data**, which means each is drillable to the rows
that cause it, and none of them is a string a detector was told to print.

They are also **balanced across the four priority boards** of the revised PRD — adverse, favourable,
risk, opportunity — because the boards partition findings by direction × horizon and a seed that
plants only bad news leaves the Opportunities board empty. Condition 12 exists for exactly that
reason and was found by reviewing the revision against this plan.

| # | Condition | What it makes demonstrable |
| --- | --- | --- |
| 1 | Revenue £0.7m ahead of forecast v6, mainly on volume | The bridge, with a favourable finding — a demo where every finding is bad news reads as a scold |
| 2 | Service-contract gross margin 267bps below forecast, and projects 404bps, while the group is **ahead** | Segmented margin variance, and slide 5's own second sentence. The figure is what the seed produces rather than a target it was tuned to hit — see verification finding 24 |
| 3 | Subcontract blended rate above the forecast **in force at the time** for three consecutive months, spanning two versions | Driver attribution, and the run-rate-versus-timing split |
| 4 | EUR weakened over the comparative period | Reported versus constant currency, and FX as a bridge bar |
| 5 | Days sales outstanding at Kestrel Gulf up 9 days over three months | Working capital as a driver, and the P&L-to-cash path |
| 6 | The 13-week forecast first breaches the £2.5m board floor at £1.7m in week 9, reaches a £1.3m low in week 10, then recovers | The cash surface, the floor breach, and the scenario that makes it worse |
| 7 | Two new GL accounts in the July load are unmapped, £212k at stake | The unmapped-account gap that F5 says every real pilot hits |
| 8 | An intercompany mismatch of £48k between Gulf and Manufacturing | A named reconciliation check that **fails**, rather than a green tick |
| 9 | Forecast versions v4, v5 and v6 each under-called the cost to serve, and by less each time | Forecast bias — a same-direction miss three vintages running, and the amplification into EBITDA that makes it findable |
| 10 | Kestrel Inc has submitted July but not closed it | Close readiness, and a group figure that carries a completeness flag |
| 11 | The June restatement above | Vintages, "as at" reporting, and why an approved pack pins one |
| 12 | CRM pipeline conversion running above assumption — roughly £0.8m of full-year revenue at stake if it holds | **The Opportunities board.** A forward-looking favourable, carrying a *run scenario* action rather than an investigation |

Which board each lands on:

| | **Adverse** | **Favourable** |
| --- | --- | --- |
| **Current** | 2 services margin · 5 working capital · 7 unmapped · 8 intercompany · 10 close · 11 restatement | 1 revenue ahead on volume · 4 constant-currency growth ahead of reported |
| **Forward** | 3 contractor run-rate · 6 cash floor breach · 9 forecast bias | 12 pipeline conversion |

### The healthy twin

A second seed, same group, **none** of conditions 1–12 present, growth comfortably clear of the
noise band so nothing can stumble into a run of declines by accident. Its job is the one the demo's
own world cannot do: prove the detectors stay **quiet**. A detector proven only to fire is
half-proven, and a false positive in front of a CFO discredits every other number on the screen. It
is a first-class artifact — the tests assert against it and a Controls-surface panel can render it
beside the real world when the product explains itself.

## Repo layout

The demo grows its own packages. demo-kit's decision §17 keeps layering to convention rather than
lint and names the condition under which a demo should layer anyway; a fact store, a measure engine
and an analysis engine are that condition, and `web/lib/` is the wrong home for them. The layering
is `model → measures → analysis → web`, strictly acyclic, enforced by package dependencies and
review — the same arrangement the reference demo held at 14.5k lines.

```
dl-finance-workbench/
  packages/
    model/       period spine, account taxonomy + basis, dimensions, currency +
                 IAS 21 translation, vintages, the fact store, consolidation, the seed
    measures/    certified measure definitions, computation with recorded inputs
                 (the drill spine), comparatives, constant currency, materiality, formatting
    analysis/    variance + bridge, driver graph + attribution, forecast + version diff,
                 cash (direct and indirect), forecast quality, detectors, triage
  web/           the Next 15 app: ten routes, three front doors
  vendor/demo-kit/   the kit, as a submodule pinned to one SHA
  docs/plan/     this convention, propagated: 00 build plan, 01 decisions,
                 02 verification, 03 traceability
  docs/deck/     the product deck as a committed PDF
```

`pnpm-workspace.yaml` gains `packages/*` beside `web` and the explicit kit paths. This is a
hand-edit to a scaffolded file and it is safe across upgrades: `demo update` moves the submodule
pointer, installs, tests and commits, and never rewrites the workspace file
(`kit: packages/create-demo/src/update.ts`).

## Routes

| Route | Surface | Front door |
| --- | --- | --- |
| `/` | The demo shell: tour, device window, notes, the persona switcher | Demo furniture |
| `/app` | Overview | Executive |
| `/app/performance` | Actual versus budget and forecast, the bridge | Executive → Analyst |
| `/app/explore` | The pivot, the drill, the formula inspector, export | Analyst |
| `/app/forecast` | Active version, drivers, version diff | Analyst |
| `/app/quality` | Error by horizon, bias, forecast value added | Analyst → Executive |
| `/app/scenarios` | Base plus deltas, carried in the URL | Analyst → Executive |
| `/app/cash` | 13-week direct forecast, indirect bridge, working capital | Both |
| `/app/commentary` | Anchored drafts, the approval machine, the published pack | Executive |
| `/app/controls` | Sources, close, checks, mappings, catalogue, lineage, AI log, permissions | Controller |
| `/api/v1/measures` | The JSON behind the pages — values as numbers with a unit, never pre-formatted strings | — |
| `/api/ask` | The grounded tool loop | — |
| `/api/health` | The deployed commit, the tier, whether a key is configured | — |
| `/deck` | The product deck, gated with everything else because it is served from `public/` | — |

**Persona and permissions.** The product reads `?as=` and resolves a signed-in principal — group
CFO, group FP&A lead, group controller, or the Gulf business-unit controller — into an entity
subtree and a set of dimension filters. Everything downstream honours it, **including the chat**: a
question asked as the Gulf controller is answered from the Gulf slice or refused, because a chat
that reaches past the permission model is the way around the permission model. The product header
shows who you are; the *switcher* is demo furniture and lives in the shell's notes column.
An absent persona keeps the intended executive demo default; an explicit unknown persona fails
closed to the least-privileged seeded grant. Finding, scenario and selector links carry the resolved
persona, period, comparator, currency lens and inner/full view rather than trusting overrides in a
raw target URL.

## Ground rules for every wave

- The original delivery target was one branch and one PR per wave. The continuation reconciles the
  waves as one integrated tree, runs their gates together and releases that verified SHA manually.
- A wave owns the paths listed under **Owns** and may not touch another wave's paths.
- A **Gate** is a command and its expected result. If it cannot be checked mechanically, the wave
  is not done — except where the gate explicitly says it is checked by looking, which some are and
  which the reference demo's convention legitimises.
- No `Math.random`, and no wall clock in any seed or model code. Time is a parameter. A demo whose
  figures move a month after the screenshots were taken is a demo whose screenshots are wrong.
- Amounts are signed integers in minor units everywhere below `web/`. Formatting happens once, at
  the edge.
- Every PR description records deltas from this plan.

---

## Wave 0 — scaffold

**Owns** the whole repo, once · **After** nothing

Run the kit for real: `pnpm -C <demo-kit> demo new dl-finance-workbench --tier memory --dir <parent>
--no-provision`. Then the edits the demo owns: `web/lib/demo.ts` identity (name, short name, mark
`DL`, description, the seed, the group's name, the petrol accent), `pnpm-workspace.yaml` gains
`packages/*`, `.nvmrc` pins node 24, `README.md`, and `docs/` receives the review and this plan.

**Gate.** `pnpm install && pnpm -r typecheck && pnpm -r test` exits 0.
`git grep -nE 'TODO|\{\{[a-zA-Z_]+\}\}' -- . ':!vendor' ':!docs'` exits 1 — narrowed from the kit's
own wording, which cannot pass on any scaffold containing JSX or CI workflow expressions; see
[`02-verification.md`](02-verification.md) finding 3. The first commit message is
`scaffold: create-demo <sha>`. `pnpm --filter web build` is green.

## Wave 1 — the model

**Owns** `packages/model/` · **After** wave 0

The whole world, and the arithmetic that has to hold before anything above it can be believed.

- **Period spine.** Fiscal months as the primary key, `YYYY-MM`; scope builders for month, quarter,
  **half-year**, fiscal year, year-to-date and trailing twelve months; the prior-period comparative as the same
  window shifted twelve fiscal months, preserving window **length** rather than snapping to the
  prior year's full extent — a year-to-date-through-July scope compares against the prior January
  to July, which is the comparison a CFO means. Weeks, separately, for cash.
- **Account taxonomy.** Canonical accounts, each declaring basis (`flow` / `balance` /
  `avg_balance`), statement, side, sign convention and display polarity. Basis is the rule that
  makes every scope correct from one table; without it a quarterly comparison sums three closing
  balances.
- **Dimensions.** Entity (with functional currency, ownership, consolidation method), account, cost
  centre, segment, channel, each with its hierarchy.
- **Currency.** Transaction, functional and presentation; a versioned rate table with a source;
  IAS 21 translation — closing rate for balance-sheet items, average for the period for P&L items,
  residual to a cumulative translation adjustment inside equity. Constant currency is the same
  translation run at the comparative period's rates.
- **Vintages.** Immutable loads with source system, timestamp, row counts, validation result, and
  `restatesVintageId`. Nothing is ever updated in place.
- **The fact store.** The grain of §5.1 of the product definition, keyed for the common query;
  `query` evaluating a scope according to the account's basis and returning null rather than 0 when
  no fact exists; `series`; the rows it touched, so the drill spine has something to terminate in.
- **Consolidation.** Elimination pairs, ownership percentage, minority interest, and the
  statutory-versus-management distinction.
- **The seed.** The group, month by month, with the twelve conditions and the healthy twin. Entity
  and cost-centre balances drive the group totals rather than the other way round, and the
  allocations that have to reconcile are allocations rather than independent series — a segment
  table whose margins do not roll up to the income statement above it is the first thing a
  controller catches.

**Gate.** `pnpm --filter @kestrel/model test` green, including: assets = liabilities + equity, to
the cent, every month, per entity **and** consolidated; segments sum exactly to revenue; cost
centres sum exactly to the entity; the loan of the intercompany pair nets to zero everywhere except
the one planted £48k; equity rolls forward by retained earnings less dividend; the same seed
produces deep-equal output across two runs; the healthy fixture builds and contains none of the
twelve conditions; `git grep -nE 'Math\.random|Date\.now|new Date\(\)' packages/model/src` exits 1.

## Wave 2 — measures

**Owns** `packages/measures/` · **After** wave 1

- **The catalogue.** Every measure declared once: id, label, unit, polarity, formula in words,
  basis-aware computation, owner, approval state. This is the semantic layer, and it is the same
  artifact the chat's tools and the Controls surface read.
- **Computation with recorded inputs.** Every computed value carries the inputs it was built from —
  each with its value, the months used and the row count — which is the bottom of the drill spine
  and the mechanism behind lineage, the formula popover and the citation under an answer.
- **Comparators.** Five, resolved in one place and carried in the URL: prior period, prior year,
  budget, forecast version, and **trend** — the trailing-twelve-month linear expectation, labelled as
  an expectation and excluded from materiality so it can inform a reader but cannot raise a board
  item. Current, prior, delta, and `favourable` derived from the measure's **own polarity** rather
  than the arithmetic sign, so a cost that grew prints `+3.4%` in red.
- **Currency lenses.** Reported and constant-currency views are available across the governed
  measure set. Functional currency is meaningful for one legal entity only; group contexts refuse it
  rather than adding unlike currencies, and the shared group selector does not offer it.
- **Materiality**, as a versioned policy object with an absolute floor and a relative threshold per
  statement and account group.
- **Formatting**, once, at the edge: values travel as numbers with a unit and never as
  pre-formatted strings.

**Gate.** `pnpm --filter @kestrel/measures test` green: a golden set of measures asserted at four
scopes (month, quarter, half-year, year-to-date) and two currencies; a half-year equals the sum of
its two quarters for a flow and its closing month for a balance; each of the five comparators
resolves to the window it claims and trend is refused by the materiality check; the ratio
denominators asserted
individually — margin on revenue, returns on average capital, days ratios on average balances and
actual days rather than assumed thirties; polarity applied to a rising cost; constant currency
differs from reported for the EUR entity and not for the AED one; a measure with no facts returns
null and formats as `—`, never `0`.

## Wave 3 — analysis

**Owns** `packages/analysis/` · **After** wave 2

- **Variance and the bridge.** Direct variance works across the governed measure catalogue. The
  attribution bridge is intentionally narrower: revenue and cost of sales are bridgeable because
  their segmented facts carry natural units; gross profit is composed exactly from those two bridges.
  They can be compared with prior period, prior year, budget or a named forecast at any supported
  scope; trend is refused because a fitted line has no recorded quantities to attribute. Contributions
  are price, volume, mix, rate/unmeasured units, unsegmented activity, FX and a named residual, under a
  stated convention and **summing to the total**. The three-way split is a separate governed object:
  selected month, year to date and the approved forecast remaining strictly after both the selected
  close and the version's actuals cut-off — a July close therefore shows August–December.
- **The driver graph.** Drivers with values, kinds (`observed` / `assumed`), owners, and edges to
  the measures they move. Attribution runs the edges, so "driven mainly by volume" is computed.
- **The forecast engine.** A version is base plus assumptions plus the graph; recalculation is a
  pure function of the three. **Version diff**: two versions in, the set of assumption changes out,
  each with its impact on revenue, margin, EBITDA and cash.
- **The cash engine.** Direct: receipts and payments by week from receivable and payable ageing,
  collection and payment profiles, payroll and tax calendars, debt service; each week locked before
  actuals so weekly variance is scoreable, receipts and payments separately. Indirect: profit to
  cash through working capital and non-cash items — the path a P&L scenario travels to reach a cash
  answer.
- **Forecast quality.** Absolute percentage error by horizon, bias as the repeated same-direction
  miss, value added against a naive baseline; the same instruments for the weekly cash forecast.
- **Detectors and triage.** Twelve rules, each writing its own plain-English statement of why it
  fired, each carrying the closed set of figures behind it and a materiality score for ranking,
  each with a fingerprint for dedupe, and each declaring its **direction** (adverse / favourable) and
  **horizon** (current / forward) — which is what partitions the four priority boards by construction
  rather than by judgement. The suite has to be balanced across all four quadrants, not merely across
  severities. Triage caps what reaches a brief and reports what it suppressed.
- **Priority insights.** The board projection: findings for a period and comparator, partitioned into
  the 2×2, ranked within each board by priority from the materiality policy, each carrying its typed
  action — expand commentary, open forecast drivers, run scenario — as a URL into the surface that
  owns it.

**Gate.** `pnpm --filter @kestrel/analysis test` green: **every governed bridge sums to its total to
the penny**, asserted for both bridgeable flows, the composed gross-profit bridge, every supported
comparator and entity, segment and group scopes — a
decomposition that does not sum has explained nothing; the residual bar is smaller than the
smallest real bar on the demo's own data; the driver-attribution edge for revenue reproduces the
volume-led result of condition 1; the version diff between v6 and v7 round-trips — applying the
diff to v6 reproduces v7; the 13-week forecast breaches the £2.5m floor in week 9 and names it;
bias is detected across v4/v5/v6 and is not detected on the healthy twin; **every detector returns
nothing on the healthy fixture**; triage's suppressed count is reported rather than silent; **all four
priority boards are non-empty on the demo's own world** and every finding lands in exactly one of
them; changing the comparator re-partitions the boards rather than reordering one list.

## Wave 4 — the executive surfaces

**Owns** `web/app/{page,app,app/performance}`, `web/components/`, `web/app/globals.css`,
`web/lib/{narration,tools}` · **After** wave 3 *(the design system may start after wave 1)*

- **The design language**, as one stylesheet of tokens that carry their reasoning inline — the
  reference demo's mechanism, none of its values. Three decisions to make and record: an
  interactive accent that stays out of the way of favourable/unfavourable, because in a finance
  product green and red already mean something; figures in a tabular sans rather than a monospace,
  because a CFO scanning eight figures wants them to read as money; and a surface treatment that
  reads as instrument rather than app furniture. Both a light and a dark treatment, the choice held
  in a cookie so the first paint is correct.
- **Overview**: headline measures with the selected comparator and polarity applied; the **four
  priority boards** as the surface's centre, each item carrying its movement, its driver caption from
  the bridge, its priority, and its typed action as a deep link; the period and comparator selectors
  in the header; the completeness banner; and Ask.
- **Performance**: the bridge as a hand-written waterfall, the three-way split beside it, actual
  against budget and against forecast at group / entity / division / segment, every row drillable.
- **Charts, hand-written.** Waterfall, dual line, stacked bar, donut, and the weekly cash column
  chart with a floor line. No charting library: the reference demo shipped a client-grade UI with
  zero UI dependencies, and a demo whose charts are somebody else's component cannot be adjusted to
  say the thing the slide says.
- **Ask.** The grounded tool loop from `@demo-kit/llm`, over tools that read the measure catalogue
  and the analysis engines and are the only source of numbers. Arithmetic lives in a
  `compare_measures` tool, because a difference the model worked out itself is a figure no tool
  returned. Named refusals with suggested questions when it cannot finish. The four questions from
  §9 of the PRD must all resolve.
- **Narration.** Commentary **headlines** are written at build time by the narration ladder, cached in
  a committed generated file, with a freshness test that pins every deterministic figure and lets only
  the prose float. The **detail level is written by code** — it is an evidence chain, not prose — so
  the cache holds one narration per item for the default period and comparator rather than one per
  combination of four periods and five comparators. A keyless build ships the deterministic sentence
  code wrote, which is not a degraded mode; it is the designed fallback, and here it is also what any
  non-default period/comparator pair renders.
- **`/api/v1/measures`**, so the JSON behind the page can be shown.

**Gate.** `pnpm --filter web test` green including the freshness test in keyless mode. A scripted
client integration test runs all four PRD questions through the same guarded multi-turn tool loop as
the live route and requires grounded citations; the tool tests separately prove their deterministic
finance objects. A question outside the closed tools is refused in words; with no key, every page
renders and Ask shows the `no_client` sentence and its chips; a fabricated numeral in a hand-edited
answer fails the grounding test. A real-key call remains a release smoke rather than something a
keyless automated gate pretends to prove. `deck shoot` against the built app writes JPEGs, which proves
the markup and the deck tooling agree on the sentinel.

## Wave 5 — the analyst surfaces

**Owns** `web/app/app/{explore,forecast,quality,scenarios,cash}` · **After** wave 4

**Implementation record.** The governed pivot and drill live in
`packages/analysis/src/pivot.ts`; `web/lib/explore.ts` gives the page and CSV endpoint one URL
contract; `/app/explore` renders the grid, formula/input provenance and source rows; and
`/api/v1/explore` exports that same resolved view with comparator, definitions and vintage ids.
Repeated dimensions are canonicalised at the URL boundary and refused by the engine. A group drill
names the intercompany elimination so its entity rows tie exactly to the displayed cell. Drill and
formula provenance select one terminal row grain rather than mixing aggregate and child rows;
in-progress quarter windows stop at the selected through-month; and a forbidden explicit export scope returns
403 instead of a CSV for a substituted entity. Dataset and version are first-class Explore controls:
actual, budget or forecast changes the data being analysed, and a forecast selection carries its
stored version in the URL rather than silently reusing the comparator's version.

The Forecast, Quality and Cash surfaces render the already-built analysis engines. Scenarios are
implemented in `web/lib/scenario.ts` and `/app/scenarios`: bounded URL assumptions re-run the same
world generator at the approved forecast's actuals cut-off, then compare P&L, working capital, cash
and low-point headroom plan-to-plan. The seeded scenario library is a set of shareable links; it is
not a persistence claim.

- **Explore**: measures down, periods across, any dimension on either axis; version, scenario,
  currency lens and persona as selectors; variance columns generated; drill from any cell down the
  aggregation path to source rows with their vintage; a formula inspector on every measure; export
  to CSV with the provenance attached. State lives in the URL, so any view a finance user reaches
  is a link they can send.
- **Forecast**: the active version, the driver panel with kind and owner per driver, and the
  version diff against any prior version.
- **Quality**: error by horizon, bias, value added, and the weekly cash score with receipts and
  payments separated.
- **Scenarios**: assumption controls that write the URL, recompute on the server, and show P&L,
  margin, EBITDA, working capital, the weekly cash line and covenant headroom against base. A
  seeded scenario library, each entry a link.
- **Cash**: the 13-week direct forecast with the floor drawn across it and the breach week named,
  the indirect bridge, and the working-capital drivers per entity.

**Gate.** A pivot with three dimensions on an axis renders and totals tie to the same measure
computed directly — a grid that disagrees with the Overview is the failure this gate exists to
prevent; drill from a group revenue cell reaches source rows whose sum equals the cell; the URL of
any Explore or Scenario view, pasted into a clean browser, reproduces it exactly; the `rev=-8`
scenario moves the cash line and the floor breach in the direction and roughly the magnitude the
indirect bridge predicts; export opens in a spreadsheet with its vintage in the header.

## Wave 6 — the governance surfaces

**Owns** `web/app/app/{commentary,controls}`, `web/lib/{permissions,commentary,controls}.ts`,
`packages/model/src/{sources,mappings,checks,approvals,ai-log}.ts` · **After** wave 4 *(parallel with
wave 5)*

**Implementation record.** `packages/model/src/{sources,mappings,checks,approvals,ai-log}.ts`
project governance records from the existing seeded world rather than duplicating finance facts.
`web/lib/controls.ts` applies the resolved entity grant before `/app/controls` receives load,
mapping, close, reconciliation, lineage or AI-audit metadata. The July projection shows Kestrel Inc
submitted but not closed, two unmapped accounts with £212k at stake, and the £48k intercompany check
failing with both sides named. A Gulf-scoped reader gets Gulf records and a named refusal instead of
a sliced group reconciliation presented under the same control name.

`packages/model/src/approvals.ts` enforces the commentary state machine and pins publication to the
approved vintage. `web/lib/commentary.ts` builds the code-written evidence chain from governed
measures, drivers and source rows, filters the queue by permission and carries the prior published
item forward. `/app/commentary` shows role-aware workflow affordances as **preview only**; the memory
tier does not mutate or persist a visitor's transition. Permission resolution in
`web/lib/permissions.ts` is shared by view construction, selectors, detail contexts and Ask tools.
Detector control metadata is scoped too, so a narrow grant cannot recover group mapping,
intercompany, close or restatement facts through a finding. Commentary wording is tested against
the same comparison object its evidence panel renders.

- **Commentary**: drafts anchored to the figure each explains, at **two levels** — a Board-ready
  headline and a code-written detail chain of movement → drivers with amounts → accounts and
  operational factors → source rows — where expanding one into the other changes neither the period,
  the version nor the comparator; each item stating its period and comparator as part of its identity;
  the state machine as seeded data spread across every state, with reject carrying its reason; the
  published snapshot with its pinned vintage; last period's commentary carried forward beside this
  period's figures; and each draft's provenance — figures, model, prompt version, vintage.
- **Controls**: sources and load status with vintages and row counts; close readiness per entity
  and period, with Kestrel Inc's July visibly not closed; the reconciliation gate as named checks
  that pass or fail, with the £48k intercompany mismatch failing; mappings and the two unmapped
  accounts with their £212k at stake; the measure catalogue with definitions, bases and owners;
  versions and vintages including the June restatement; lineage from a published figure to its
  source rows; the AI usage log; and the permission model as it resolves for the current persona.
- **Permissions**: entity-subtree and dimension-filter resolution, applied to every surface and to
  the chat's tools.

**Gate.** Expanding a commentary headline leaves the period, version and comparator parameters
byte-identical in the URL, and the detail's driver amounts sum to the movement the headline quotes;
a board item's typed action lands on the surface it names with its state pre-set. As the Gulf
business-unit controller, no group figure is reachable on any surface and the
chat refuses a group question in words rather than answering it from a slice it can see; the failing
intercompany check names both sides and the amount; the unmapped-account panel's total equals the
gap between the mapped P&L and the trial balance; a published commentary item cites a vintage, and
changing the as-at month does not change the published item; the AI log has a row for every
model-authored seeded commentary item.

## Wave 7 — presentation and release

**Owns** `web/lib/tour.ts`, `web/public/deck.html`, `web/deck.config.mjs`, `docs/` · **After**
waves 5 and 6

**Implementation record.** `web/lib/tour.ts` contains ten evidence-led steps covering
the position, bridge, source drill, pivot, forecast diff, scenario, cash, quality, permissions and
controls, plus an opening overview. The opening step switches the shell to the phone itself.
`web/app/page.tsx` consumes the current demo-kit `TourWindow` and `resolveShellView` directly: guided
mode keeps its frame and notes, while the kit's free mode hands the viewport to the product.

The product-specific deck is twelve slides with ten product shots spanning the position, bridge,
source drill, forecast, scenario, cash, quality, commentary, controls and permission refusal. All
shots were regenerated from the current app; the current demo-kit deck lint, aspect sync and slide
overflow checks pass; `docs/deck/demo.pdf` is a visually reviewed, tagged twelve-page PDF. The
submodule pin is `cc844bf6e94f2c35479fd914d6aec6dc4339044b`, published on
`codex/latest-free-fullscreen`; it combines upstream `main` at `4757c73` with the official
auto-fullscreen Free-mode line at `660c16c`.

- **The tour**, ten steps, one rule: nothing in it may promise a capability the app does not have.
  Draft order — the position; what changed and the bridge; drill it to source; the analyst pivot;
  the drivers and the version diff since v6; the scenario, moving cash; the 13-week forecast and the
  floor; does the forecast deserve trust (quality); who you are, and what you cannot see
  (permissions); can I explain it (controls, close, the failing check, the unmapped accounts). Plus
  an opening `TourOverview`; free mode uses the kit's full-viewport product view rather than a
  route-matched notes column. The first step switches the device to a phone rather than asking the
  visitor to find the control.
- **The deck**, twelve slides in the kit's single self-contained format, screenshots captured from
  the running app rather than taken by hand, aspect-stamped, overflow-checked, exported to a
  committed PDF with one slide to one page.
- **Manual release**: run the repository gates, deploy from the repository root with the pinned kit,
  and **verify** by polling `/api/health` until it reports the exact supplied commit. Record the SHA,
  timestamp and health payload in [`02-verification.md`](02-verification.md). A release is not done
  because a CLI said SUCCESS.
- **The documentation pass**: convert this plan into a record in the demo's own `docs/plan/`,
  annotate each wave with what actually happened, fill `02-verification.md`'s findings, correct any
  drifted traceability row, and fold anything learned back into
  [`00-source-review.md`](../review/00-source-review.md) if the build proved a finding wrong.

**Gate status.** The repository gate is complete: the ten-step tour, `TourOverview`, non-empty
findings ledger, combined demo-kit pin `cc844bf`, ten regenerated product shots, current deck lint,
twelve overflow-free slides and the twelve-page tagged PDF are present. The PDF was checked from
rendered pages. The manual release gate is recorded separately in
[`02-verification.md`](02-verification.md) against the final SHA, including live Free-mode, gate and
commit-health checks, so those results can be updated without rewriting the build history.

---

## Parallelism

```
w0 ── w1 model ── w2 measures ── w3 analysis ──┬── w4 executive ──┬── w5 analyst ──┬── w7 ship
                                               │                  └── w6 governance ┘
                                               └── (design system may start after w1)
```

The spine is serial and there is no way around it: measures cannot be computed without a grain, and
a bridge cannot be decomposed without measures. Waves 5 and 6 are genuinely independent of each
other and both depend on wave 4 for the design system and the shell.

## What is not built

- **Real ERP connectors.** Ingestion is modelled — sources, loads, vintages, validation results,
  unmapped accounts, all in the seed — because a demo that dials a customer's SAP is not a demo.
  §4.2 of the product definition is the design; the demo shows its output.
- **Persisted visitor state.** The tier's cost, stated above: saved scenarios and visitor
  approvals are represented by seeded records. Scenario changes survive in a shared URL; workflow
  actions are read-only previews and do not change even browser-local state.
- **Write-back to a planning system.** Phase 3 in the product definition, and out of the demo
  entirely — the demo's whole claim is that it changes nothing in anyone's system of record.
- **A configurable model.** No dimension designer, no formula builder, no report designer. The
  demo ships one opinionated model, which is the product's position too.
- **Streaming chat.** Answers are short and grounded; the memory tier shows a loading state rather
  than a stream, per demo-kit's decision §5.
- **A keyless answer engine.** No key means a named refusal and suggested questions, never a
  second engine reaching a different conclusion behind the same interface.
- **Individual-level payroll or customer data**, anywhere, at any grain. The seed does not contain
  a person.
- **E2E tests.** None in the memory tier, per demo-kit's decision §11: unit tests plus the deck
  shot plus looking. The gates above say which checks are which.
