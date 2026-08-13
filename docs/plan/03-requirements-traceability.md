# Requirements traceability

Three tables, and one rule that is the whole point: **Where** points at a path you can read, and
**How to check** is something you can run or look at. A row with no way to check it is a row you
should not believe.

These rows were reconciled against the integrated tree on 13 August 2026. Paths are relative to the
`dl-finance-workbench` repo; `kit:` means demo-kit, reached through `vendor/demo-kit/`. A path is
evidence only when it can be opened and its stated check exists. All twenty-four requirements have
implementation evidence inside the demo's documented boundary. The hosted SHA is evidence only when
the manual release record in [`02-verification.md`](02-verification.md) contains its matching health
response.

---

## 1. The PRD's twenty-four functional requirements

*Twenty in the original, plus the four the revised PRD of 12 August adds. The review of that
revision is [`00-source-review.md`](../review/00-source-review.md) §7.*

| ID | Requirement, in short | Where | How to check |
| --- | --- | --- | --- |
| FW-DATA-001 | Ingest GL actuals, budget/forecast and approved drivers; status visible | `packages/model/src/sources.ts` (loads, statuses) · `web/app/app/controls` | Controls → Sources lists all nine configured feeds with period, row and validation history; fact vintages resolve to the entity GL, plan, PSA, CRM, payroll or bank source that supplied them; the measures API names the current vintage |
| FW-DATA-002 | Map source fields/accounts into governed structures; mappings versioned and reviewable | `packages/model/src/mappings.ts` · Controls → Mappings | Two mapping-set versions are listed with owner, effective dates and coverage; switching the as-at month across the July boundary changes which version resolves |
| FW-DATA-003 | Validate completeness, period alignment, types and reconciliation before use | `packages/model/src/checks.ts` · Controls → Checks | Every named check prints pass or fail; the intercompany check **fails** at £48k and names both sides; Kestrel Inc's July shows *submitted, not closed* and the group figure carries the flag |
| FW-DATA-004 | Lineage from a displayed value back to source datasets and mapping versions | `packages/measures/src/compute.ts` (recorded inputs) · `packages/model/src/facts.ts` (rows) · `web/lib/explore.ts` · Controls → Mappings | Open an Explore cell for formula, inputs, months, row count and source-specific vintage ids; one terminal row grain ties to the computed input without aggregate/child duplication, and the group drill ties after a named elimination; Controls names the effective mapping set separately |
| FW-MODEL-001 | Governed P&L, balance sheet, cash flow and KPI structures | `packages/model/src/taxonomy.ts` · `packages/measures/src/catalogue.ts` | `pnpm --filter @kestrel/model test`: assets = liabilities + equity to the cent, every month, per entity and consolidated |
| FW-MODEL-002 | Approved KPI definitions and calculation logic, visible with period/version context | `packages/measures/src/catalogue.ts` · Controls → Catalogue | Every measure lists its formula, basis, unit, polarity, owner and approval state; the same definition is what the chat's tools quote |
| FW-MODEL-003 | Distinguish current, prior and approved versions; published views name the active one | `packages/model/src/seed.ts` (`VersionSpec`, `VERSIONS`) · shared version selector · Controls → Versions | Budget FY26 and v4–v7 carry state, owner and actuals cut-off; the shared header names the selected version; a published commentary snapshot pins its approved version |
| FW-ANALYSIS-001 | Compare actual with budget and/or forecast; identify material variances; reproducible and traceable | `packages/analysis/src/{bridge,three-way}.ts` · `packages/measures/src/materiality.ts` · `web/app/app/performance` | Direct variance covers the governed catalogue. Attribution bridges are limited to the bridgeable natural-unit flows — revenue and cost of sales — with gross profit composed from both; tests cover prior period, prior year, budget and forecast and refuse trend. Every contribution sums to the movement. The three-way object separates selected month, YTD and approved forecast strictly after both selected close and version actuals cut-off; finding evidence names the policy and Explore reaches the same measure's source rows |
| FW-ANALYSIS-002 | Present key drivers behind material movements; driver attribution distinct from AI interpretation | `packages/analysis/src/drivers.ts` (the graph and its edges) | "Driven mainly by volume" is a computed bar, not a sentence: the volume bar's value equals the driver edge's own output, asserted in tests; the AI's phrasing sits in a visibly separate block from the computed attribution |
| FW-ANALYSIS-003 | Surface risks and opportunities as decision support, not decisions | `packages/analysis/src/detectors.ts` · `packages/analysis/src/priority.ts` | Twelve detectors, including favourable and forward items; each prints *why it fired* and a typed route/owner; every detector returns nothing on the healthy fixture; actions stop at explain/propose/run-scenario |
| FW-FORECAST-001 | Controlled updates to forecast assumptions using defined drivers; changes and outputs visible | `packages/analysis/src/forecast.ts` · `web/app/app/forecast` | The driver panel shows value, kind (`observed`/`assumed`) and owner per driver; recalculation is explicit and prints what moved |
| FW-FORECAST-002 | Create management scenarios by changing assumptions; isolated from the approved forecast | `web/lib/scenario.ts` · `web/app/app/scenarios` | Bounded URL deltas re-run a separate scenario world at the approved version's cut-off; both sides are forecasts, the approved base is unchanged and no promotion/write action exists |
| FW-FORECAST-003 | Compare scenario output with base/current forecast | `web/lib/scenario.ts` · Scenarios → effect/headroom/cash line | Revenue, margin, EBITDA, working capital, cash and net debt are shown plan-to-plan; low-point headroom and the weekly cash line are recomputed from the scenario world; `cash.test.ts` proves collection days move cash |
| FW-AI-001 | First-draft commentary, risks and opportunities from governed data; subject to approval | `web/lib/narration.ts` + committed generated headline · `packages/model/src/approvals.ts` · `web/app/app/commentary` | The queue is seeded across workflow states; model-authored items name figure refs, model id, prompt version and vintage; the keyless freshness test pins deterministic content |
| FW-AI-002 | Natural-language questions, grounded, facts separated from interpretation | `web/lib/tools.ts` · `web/lib/ask-integration.test.ts` · `kit: packages/llm/src/{ask,grounding}.ts` | A scripted client runs all four PRD §9 questions through the guarded multi-turn loop and requires grounded citations; deterministic tool tests cover the same finance objects. Unsupported forecasting is refused in words, and a hand-edited fabricated numeral fails the grounding test. A keyed provider call is a release smoke, not an unrecorded automated claim |
| FW-AI-003 | AI output carries enough context to validate the figures and logic | `web/components/Ask.tsx` · `web/app/api/ask/route.ts` · citation targets on Performance, Explore, Forecast and Cash | Ask carries the selected persona, reporting period, comparator, entity, lens and forecast version into an actual-only reporting context; an Explore budget/forecast dataset cannot silently change the facts Ask reads. Each citation links to the surface and governed value it names; arithmetic is returned by deterministic tools, never derived by the model |
| FW-APP-001 | Finance review and approval of commentary and published outputs; approver recorded | `packages/model/src/approvals.ts` · `web/lib/commentary.ts` · Commentary | Model tests enforce draft → review → approved → published, rejection-with-reason and a vintage-pinned snapshot; the surface shows role-aware actions as preview-only because the memory tier does not persist visitor transitions |
| FW-SEC-001 | Role-based access to data, scenarios and outputs | `web/lib/permissions.ts` · `web/lib/world.ts` | As the Gulf business-unit controller, no group figure or control metadata is reachable and chat refuses a group question. Unknown explicit personas fail closed; finding/scenario links preserve the resolved grant and finance view; forbidden explicit Explore exports return 403 |
| FW-SEC-002 | Log material AI usage and output/approval events; history retained | `packages/model/src/ai-log.ts` · Controls → AI log | Every model-authored seeded commentary item projects one immutable audit row with purpose, model, prompt, vintage, figure refs, output and review state; duplicate append and second-review attempts are refused in tests |
| FW-CTRL-001 | No autonomous journal posting; no such capability exposed | Nowhere, by construction | `git grep -niE 'journal\|posting\|post_entry' -- web packages` finds only prose stating the prohibition; the product has no write path to any system of record |
| FW-AI-004 | Board-level headline commentary with linked detailed commentary per material movement, expandable without changing period or version | `web/lib/narration.ts` (headline) · `web/lib/commentary.ts` (code-written evidence) · Commentary | Commentary tests preserve period/version/comparator parameters through queue navigation and assert every detailed driver set adds to its quoted movement |
| FW-AI-005 | Commentary for month, quarter, half-year and year, with like-for-like comparators, stating the period and comparator used | `packages/model/src/period.ts` · `packages/model/src/approvals.ts` · `packages/measures/src/comparator.ts` · `web/lib/{world,commentary}.ts` · Commentary | The shared selector exposes all four reporting grains (plus YTD), clips incomplete quarter/half/year scopes at the selected through-month and offers all five comparator definitions. Changing period or comparator creates a new unapproved item identity and recomputes its evidence; the page prints both values. Seeded published records separately demonstrate complete month, quarter, half-year and year approval history. Model and web tests assert like-for-like window lengths and selected-content recomputation. |
| FW-DASH-001 | Overview provides four quick-read boards — Adverse, Favourable, Risks, Opportunities — with materiality/priority, forward-looking items included | `packages/analysis/src/priority.ts` (the direction × horizon 2×2) · `web/app/app` | All four boards are non-empty on the demo's own world; every finding lands in **exactly one** board; changing the comparator re-partitions the boards rather than reordering one list |
| FW-DASH-002 | Each board item drills into the KPI movement, driver analysis, detailed commentary and source lineage | `packages/analysis/src/detectors.ts` typed actions · `web/app/app/performance` · `web/lib/commentary.ts` · `packages/analysis/src/pivot.ts` | Detector tests parse each typed route and required state; Performance entity and segment rows carry the selected context into Commentary; Commentary resolves movement → drivers → accounts → source rows; Explore's group drill ties exactly and every row names a vintage |

## 2. The findings of the source review

Each finding from [`00-source-review.md`](../review/00-source-review.md) §3, what closes it, and how that is
checked.

| # | Finding | Closed by | How to check |
| --- | --- | --- | --- |
| F1 | No grain, no basis, no numeric representation | The stated grain, `quantity` beside `amountMinor`, basis on the account, signed minor units | Wave 1 gate: a quarter equals the sum of its months for a flow and the last month for a balance; `git grep -n 'toFixed\|parseFloat' packages/model/src` finds nothing in the store |
| F2 | No currency model, so constant currency is impossible | Four functional currencies, GBP presentation, versioned rates, IAS 21 translation and constant currency as a reporting lens | Wave 2 gate: constant currency differs from reported for EUR and USD and not for the AED peg; the cumulative translation adjustment reconciles. A multi-entity functional-currency request is refused rather than adding unlike currencies |
| F3 | "Identify material variances" is subtraction | Direct variance for every governed measure; exact bridges for revenue, cost of sales and composed gross profit; the three-way split; materiality and polarity | Wave 3 gate: every supported bridge sums across all lookup comparators and scopes, trend is refused, and the three-way object's three horizons are deterministic; a rising cost prints `+3.4%` in red |
| F4 | Drill-down is one bullet and it is half the product | The drill spine as a property of every computed figure; the Explore surface | Wave 5 gate: a pivot with three dimensions on an axis totals to the same measure computed directly; drill from group revenue reaches rows whose sum equals the cell |
| F5 | No close, no completeness, no unmapped, no restatement | Close readiness, the named-check gate, the unmapped panel, vintages with `restatesVintageId` | Wave 6 gate: the intercompany check fails by name; the unmapped total equals the gap between the mapped P&L and the trial balance; the June restatement changes prior-period margin between vintages |
| F6 | The forecast is never held accountable | The Forecast quality surface: error by horizon, bias, value added | Wave 3 gate: bias detected across v4/v5/v6, and **not** detected on the healthy twin |
| F7 | Two of the four illustrative questions have no object that answers them | The version diff, the deterministic revenue sensitivity and the cash engine's indirect bridge | Wave 3 gate: applying the v6→v7 diff to v6 reproduces v7; Wave 4's scripted-client integration runs all four §9 questions through the real guarded loop and checks their citations |
| F8 | Commentary is a blob; approval is a status field | Anchored drafts; the state machine; the vintage-pinned published snapshot; carry-forward | Wave 6 gate, plus: last period's commentary appears beside this period's figure for the same anchor |
| F9 | Permissions are named but not dimensioned | Entity-subtree and dimension-filter resolution, applied to the chat's tools too | Wave 6 gate: the Gulf controller's refusal |
| F10 | The integration layer is one box | §4 of [`01-product-definition.md`](../review/01-product-definition.md): four layers, per-platform mechanisms, seven connector obligations | Controls → Sources names all nine configured sources, their mechanisms and deterministic load histories. Each fact vintage points back to its supplying feed. The demo dials nothing, and says so |
| F11 | "AI assists; Finance decides" is a value, not a mechanism | The grounding contract, the action ladder, the enriched AI log | Wave 4 gate: named refusals, no second engine; every AI feature's rung is declared in `web/lib/narration.ts` and `web/lib/tools.ts` headers |
| F12 | Two internal inconsistencies (core banking; "bank-grade") | Raised as open questions, not silently resolved | §4 below carries both, unanswered, for the client conversation |

## 3. The slide-5 concept, reproduced

| On the slide | Where | How to check |
| --- | --- | --- |
| Nav: Overview · Performance · Forecast · Scenarios · Cash · Commentary · Data & Controls | `web/app/app/*` — all seven names kept, Explore and Quality added | Every name on the slide is a route; the two additions are the ones findings F4 and F6 require |
| Revenue £12.4m, +6.2% vs FC | `packages/measures` → Overview | Computed from the seed, not a literal: `curl /api/v1/measures \| jq '.measures[] \| select(.id=="revenue")'` returns a number with a unit |
| Gross Margin 41.8%, −1.1pt | Same | Delta is in points because the measure's unit is a percentage; the sign is the metric's own polarity |
| EBITDA £2.1m, +£0.3m | Same | — |
| Cash £4.8m, 13 weeks | Cash surface | Read as the 13-week forecast per [`01-decisions.md`](01-decisions.md) §6; the card names the horizon's low point and the week it falls in |
| "Revenue is £0.7m ahead of forecast, driven mainly by volume" | The bridge | The volume bar is the largest favourable bar and equals its driver edge's output |
| "Services gross margin is 3.4pts below forecast" | Performance, segment scope | Planted condition 2; drillable to the subcontract rows that cause it |
| "Q4 outlook positive but contractor cost is an emerging risk" | The three-way split's remaining-forecast column, and a detector | Planted condition 3: the subcontract rate is above assumption for three consecutive months, and the detector says so |
| Ask Deeplight, four questions | `web/lib/tools.ts` `SUGGESTIONS` · `web/lib/ask-integration.test.ts` | Each suggested question has a deterministic finance object and is exercised through the guarded loop with citations — a chip the demo refuses is worse than no chip |
| Management actions | Overview → actions, each owned | Every action is attached to a finding and carries an owner; none of them executes anything |

### The revised PRD's priority-dashboard mock-up

| On the mock-up | Where | How to check |
| --- | --- | --- |
| **Adverse** — a revenue miss against budget, captioned with a volume driver, priority High | Planted condition 2, on the Adverse board | The caption is a bridge bar, not a sentence: its value equals the driver edge's own output |
| **Favourable** — a margin gain against last year, captioned pricing/mix, priority Medium | Planted conditions 1 and 4 | Constant currency separates the real gain from translation, so the caption cannot claim a movement FX produced |
| **Risks** — cash headroom may fall below threshold, forward-looking, priority High | Planted condition 6 | The 13-week forecast breaches the £2.5m floor in week 9 and the item names the week |
| **Opportunities** — pipeline conversion could add full-year revenue, forward-looking, carrying *run scenario* | Planted condition **12**, added because reviewing the revision showed the seed had no opportunity in it | The action is a link into Scenarios with the pipeline driver pre-set, and the scenario's revenue delta matches the amount the item claims |
| Period selector — Month / Quarter / Half-Year / Year | `packages/model/src/period.ts` | Half-year exists in the spine and reconciles to its quarters |
| Comparator selector — Prior Period / Prior Year / Budget / Forecast / Trend | `packages/measures/src/comparator.ts` | All five resolve; trend is defined as the trailing-twelve-month linear expectation, labelled as one, and cannot raise a board item |
| Click path — headline → detailed commentary → quantified drivers → supporting evidence → source lineage | The drill spine | `FW-DASH-002` and `FW-AI-004` above |

## 4. Open questions for the client

The PRD's §20 asks eight. Six of them the demo answers by choosing a defensible default and saying
so; two need the client, and two more come out of the review.

| Question | The demo's answer, or who has to decide |
| --- | --- |
| Which ERP and operational systems are in the first pilot? | **Client.** §4.2 of the product definition names the mechanism per platform; the pilot's answer sets the first connector and most of the schedule. |
| Which KPI definitions are approved? | Demo default: the measure catalogue in `packages/measures`, with owners and approval states, as the shape a client's own set drops into. |
| Which operational drivers are reliable enough? | Demo default: utilisation, chargeable and subcontract hours, blended rate, volume, unit price, and the three working-capital days ratios. **Client** decides which of these actually exist. |
| What threshold defines "material"? | Demo default: a versioned policy object with an absolute floor and a relative threshold per statement. The values are a starting point; the *object* is the answer. |
| Which calculations are deterministic versus AI-assisted? | Answered, and it is the product's spine: **every** figure, variance, decomposition, forecast and finding is deterministic. The model only phrases, and only from a closed set of figures. |
| What approval workflow and evidence retention? | Demo default: draft → in review → approved → published, reject-with-reason, vintage-pinned snapshots, append-only approval and AI logs. **Client** decides retention period and delegation. |
| Which users publish versus only review? | Demo default: publish rights on the principal, separate from read scope; the Gulf controller reviews and cannot publish. |
| What baseline quantifies ROI? | **Client**, and it needs capturing before the pilot starts. Worth a small instrument in the product — a cycle log — rather than a spreadsheet nobody fills in. |
| *(from F12)* Is the first pilot a financial institution? §18.1 says "core banking"; §11 says ERP/CRM/payroll/ops. | **Client.** It changes the first chapter of the data model, and it changes the demo's fictional group. |
| *(from F12)* "Bank-grade" security, or the controls that actually exist? | Recommendation: state the controls — row-level access, tenant segregation, immutable vintages, append-only audit, no journal-posting capability. **Client** decides what procurement needs to hear. |

## 5. The demo's own claims

| Claim | Where | How to check |
| --- | --- | --- |
| Every figure is computed; nothing is a typed-in literal | `packages/{model,measures,analysis}` | Change the seed string and every figure moves; the freshness test fails until the narration is regenerated |
| The same seed builds the same world everywhere | `kit: packages/data` + `packages/model/src/seed.ts` | Two runs, deep-equal; `git grep -nE 'Math\.random\|Date\.now' packages` exits 1 |
| The detectors can be quiet | The healthy twin | Every detector returns nothing on it |
| Nothing is written to any system of record | The whole app | No write path exists; `FW-CTRL-001`'s check above |
| It is a demo, and says so | `web/app/gate/page.tsx`, the tour's first step, the Controls surface | The gate page states that the group is synthetic and the figures generated from a fixed seed |
| A hosted build is the manually verified build | `kit: packages/shell/src/health.ts` · `README.md` manual release command · `02-verification.md` release record | Deploy with the final SHA explicitly, then record `curl /api/health \| jq .commit`; the returned commit must equal that SHA before the release is called complete |
| The replacement deck's screenshots come from the running app | `web/deck.config.mjs` · `web/public/deck.html` · `docs/deck/demo.pdf` | All ten product shots were regenerated from the current app; current kit deck lint, aspect sync and all twelve slide renders pass without overflow; the committed tagged PDF has twelve pages and was visually checked from rendered pages |
