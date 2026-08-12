# Deeplight Finance Workbench — what the product should be

*This is the product definition the demo is built to prove. It takes the PRD's spine — connect,
govern, explain, forecast, approve, with no journal posting and a human at the decision boundary —
and closes the findings in [`00-source-review.md`](00-source-review.md).*

---

## 1. The product in one paragraph

The Finance Workbench is a **governed measure layer over the systems Finance already runs, with an
analysis surface on top of it and a human approval gate at the exit.** Loads arrive from ERP,
planning, payroll, CRM, banking and operational systems as immutable vintages; mappings resolve
them into one dimensional measure model with declared grain, basis and currency; deterministic
engines compute the metrics, decompose the variances, roll the drivers forward and project the
cash; a language model explains what the engines found, using only figures the engines produced;
and nothing reaches a board pack without a named person approving it.

**What it is not.** It is not an ERP, a general ledger, or an accounting engine — it posts nothing.
It is not a BI tool — it ships one opinionated model rather than a canvas. It is not a planning
platform — it holds forecast *assumptions* and versions, not a bottom-up budget-submission
workflow across hundreds of contributors. And it is not a chatbot with a database behind it: the
model never computes, it phrases.

## 2. Three front doors on one model

The PRD names three personas and then describes one dashboard. That is the gap the word
"Workbench" is already promising to fill. The resolution is three surfaces over **one** measure
model — never three models, because three models is how a board pack disagrees with the drill-down
that produced it.

| Front door | Who | The question | Design posture |
| --- | --- | --- | --- |
| **Executive** | CFO / Finance Director, CEO, board | *What changed, why, what should I do?* | Answer-first. Few figures, large. Every claim carries the link that proves it. Reads in ninety seconds on a phone. |
| **Analyst** | FP&A lead, finance manager | *Show me. Let me take it apart.* | Instrument-first. A real grid, dimension pickers, version and period selectors, drill to source rows, formula inspection, export. Density is a feature here and a bug next door. |
| **Controller** | Financial controller, business partner, data steward | *Can I trust it, and can I explain it?* | Evidence-first. Load status, close readiness, mappings and what they missed, reconciliation checks that pass or fail by name, definitions, versions, lineage, the AI log. |

The same figure, opened from any of the three, resolves to the same computation with the same
provenance. That is the product's central claim and the reason the drill spine (§6.1) is
architecture rather than a screen.

## 3. The surfaces

Navigation keeps the seven names from slide 5, because they are the client's own vocabulary, and
adds two — **Explore** and **Forecast quality** — that the findings require. Each surface below
states the question it answers and the front door it belongs to.

### 3.1 Overview — *what is the position, and what needs attention now?* (Executive)

Headline measures for the selected period and comparator, each with its polarity applied. Then the
surface's centre: **four priority boards**, which are the revised PRD's `FW-DASH-001` and are the
executive's whole scan.

They are a **2×2**, not four peers — direction × horizon — which is what makes every finding land in
exactly one board by construction rather than by opinion:

|  | **Adverse** | **Favourable** |
| --- | --- | --- |
| **Current period** | **Adverse** — what went against us | **Favourable** — what went for us |
| **Forward looking** | **Risks** — what may go against us | **Opportunities** — what may go for us |

Each item carries its movement against the selected comparator, its driver caption (which is a
bridge bar, not a sentence — *↓ volume*, *↑ price/mix*), its priority from the materiality policy,
and a **typed action**: expand the commentary, open the forecast drivers, or run a scenario. Each
action is a deep link into the surface that owns it with its state pre-set, so the click path is
`board item → headline → detailed commentary → quantified drivers → supporting rows → source
lineage` without the period or version changing underneath the reader.

Because the boards are computed against the selected comparator, changing the comparator
re-partitions them — which is correct, and is the most persuasive ten seconds in the product.

Below the fold: **Ask**, and the completeness banner — as-at date, load vintage, close state, and
anything the reconciliation gate failed. An executive surface that hides incompleteness is the
fastest way to lose an executive.

### 3.2 Performance — *what is changing, and why?* (Executive → Analyst)

Actual against budget and against forecast, at group, entity, division and segment. The centre of
the page is the **bridge**: the total variance decomposed into price, volume, mix, rate, FX and
one-offs, bars summing to the total, each bar openable into the rows that make it up. Beside it,
the same variance split three ways — in-month, year-to-date, and remaining forecast — which is how
a timing difference is told apart from a run-rate change. Every row is drillable; the drill is the
same mechanism the Analyst surface uses, entered from a different door.

### 3.3 Explore — *let me take it apart* (Analyst)

The workbench proper, and the surface the PRD does not contain. A pivot over the measure model:
measures down, periods across, any dimension on either axis; version and scenario as first-class
selectors, not a page mode; comparatives and variance columns generated rather than configured;
drill from any cell down the aggregation path to the source rows and their vintage; a formula
inspector on every measure showing its definition, its inputs and its basis; and export to
spreadsheet with the provenance attached. This is where a finance manager spends the afternoon,
and it is what makes the executive surface's numbers defensible rather than decorative.

### 3.4 Forecast — *what is the outlook, and what moved it?* (Analyst)

The active forecast version, its status and its owner. The driver panel: every assumption, its
value, its source (observed from a system, or assumed by a person), and the measures it moves. A
**version diff** against any prior version — the set of assumption changes, each with the measured
impact on revenue, margin, EBITDA and cash — which is the object that answers *"which drivers
changed since forecast v6?"*. Recalculate is explicit and shows what moved.

### 3.5 Forecast quality — *should I believe it?* (Analyst → Executive)

The surface that makes the product accountable for its own output, and the one most likely to be
cut and most worth keeping. Absolute percentage error against actuals **by horizon**, so a
one-month-out claim is never averaged with a six-month-out one; **bias** — the repeated
same-direction miss, which is the early warning that an assumption is wrong rather than the
weather; and **forecast value added** against a naive baseline, which answers whether the process
beats "same as last month". Weekly cash forecasts are scored on the same page with receipts and
payments separated, because offsetting errors otherwise hide.

### 3.6 Scenarios — *what if?* (Analyst → Executive)

A scenario is a **base version plus a set of assumption deltas**, and nothing else. That
definition is what makes it reproducible, comparable, shareable as a link, and isolated from the
approved forecast until somebody promotes it. Change a driver; every dependent measure
recomputes — P&L, margin, EBITDA, working capital, the weekly cash line and the covenant headroom.
Compare against base and against any sibling scenario. Save, version, annotate. Promotion to the
active forecast is an approval, not a button.

### 3.7 Cash — *what does this mean for liquidity?* (Executive + Analyst)

Two models, because finance needs both. The **13-week direct forecast** — receipts and payments by
week, from the collection and payment profiles of the actual receivables and payables ledgers —
with each week locked before actuals land so the variance is scoreable; the board's minimum-cash
floor and any covenant drawn across it; and the week the forecast first breaches, named. And the
**indirect bridge** — profit to cash through working capital and non-cash items — which is what
connects a P&L scenario to a cash answer, and therefore what makes *"what happens to cash if
revenue falls 8%?"* answerable. Working capital drivers (days sales outstanding, days payable,
days inventory) are shown as the drivers they are, per entity, because that is where the
deterioration hides.

### 3.8 Commentary — *what should management know?* (Executive + approval)

Draft commentary, risks and opportunities, each **anchored to the figure it explains** rather than
floating as prose — because unanchored prose cannot expand into anything, and expansion is what
`FW-AI-004` asks for.

**Two levels per item.** A **headline** — one or two sentences, Board-ready, what a CFO reads out —
and a **detail** level beneath it: the movement, its decomposition into drivers with amounts, the
accounts and operational factors behind them, and the source rows. The headline is narrated by a
model; **the detail level is written by code**, because it is a structured evidence chain rather than
prose, and a chain of figures does not need a writer. Expanding one into the other changes nothing
about the period, the version or the comparator — the detail is the same computation the headline
was written from, opened up.

**Every item states its period and its comparator**, which is `FW-AI-005`, and both are part of the
item's identity rather than page context — so a quarterly commentary against budget and a monthly one
against prior year are two items and can never be confused for each other.

Every draft carries: the figures it was written from, the model and prompt version that wrote it, the
data vintage it was computed against, and its state. The state machine is draft → in review →
approved → published, with reject carrying a reason and an owner at each step. Publishing pins the
vintage, so a pack cannot change after it was approved. Last period's commentary is carried forward
beside this period's figures — *you said the shortfall was contractor rates; here is what
happened* — which is the single most valuable thing a workbench can say.

### 3.9 Data & Controls — *can I trust it and explain it?* (Controller)

Sources and their load status, with each load's vintage, row count and validation result; **close
readiness** per entity and period; the **reconciliation gate** as named checks that pass or fail —
trial balance nets to zero, assets equal liabilities plus equity, subledger control accounts tie to
the GL, intercompany nets across the group; **mappings** and, more importantly, what they missed —
unmapped accounts, with the amount at stake; the **metric catalogue** — every measure, its
definition, its basis, its owner, its approval state; **versions and vintages**, including which
loads restate which; **lineage** from any published figure back to its source rows; the **AI usage
log**; and the permission model as it actually resolves for the signed-in user.

## 4. Enterprise connectivity

§11 of the PRD is one box labelled "APIs • Secure ingestion". Every real cost of this product is
inside it. The architecture below is four layers and one rule.

**The rule: bulk finance data arrives in batches, on a watermark, and is replayable.** Not one of
the systems below is designed to be read at request time for a group P&L, and designing for
request-time reads is the classic and expensive mistake. The product reads its own governed store;
loads fill it.

### 4.1 The four layers

| Layer | Holds | Rule |
| --- | --- | --- |
| **Landing** | Source extracts exactly as delivered, immutable, addressed by vintage | Nothing is ever edited here. A correction is a new vintage that declares what it restates. |
| **Staged** | Typed, deduplicated, schema-drift-checked rows | Rejects are visible and counted, never dropped. A load that fails a check blocks or flags downstream use rather than half-arriving. |
| **Mapped** | Source accounts, cost centres and entities resolved to canonical codes through effective-dated, versioned mappings | Unmapped is an output, not an omission: it has a value and it appears on the Controls surface. |
| **Governed** | The measure model of §5, and only it | Nothing above this layer knows a source system's account numbers. |

### 4.2 The systems, and how each one actually gives up its finance data

The point of this table is that the *shape* of the extract differs enough between platforms to
change the connector, and picking the wrong mechanism per platform is how a six-week pilot becomes
six months.

| System | The right mechanism | Notes that cost money if ignored |
| --- | --- | --- |
| **SAP S/4HANA** | The Universal Journal (`ACDOCA`) or the released CDS views over it, extracted by scheduled batch; incremental via change documents, an `ACDOCA` timestamp watermark, or SLT replication | `ACDOCA` is one table for GL, controlling, asset accounting, material ledger and profitability — which is why it is the right grain to read. **Do not extract through the compatibility views**: they are slow and memory-heavy. Custom fields need to be exposed to the read API before they appear. |
| **Oracle Fusion Cloud ERP** | Business Intelligence Cloud Connector for bulk, scheduled, incremental extraction; REST for low-volume real-time reads | **BI Publisher and OTBI are not integration-grade** and Oracle says so; using them for extraction is an unsupported pattern that will be withdrawn from under a pilot. GL balances have a purpose-built integration path worth using rather than rebuilding. |
| **Microsoft Dynamics 365 Finance & Operations** | Link to Fabric / Synapse Link for Dataverse into a lake, or the Data Management Framework for scheduled entity exports; OData for low volume | Export to Data Lake is superseded — new work goes to Synapse Link / Link to Fabric. The Business Performance Analytics record-to-report dimensional model is a useful reference for the entity/dimension/period slice this product needs. |
| **NetSuite** | SuiteQL / SuiteAnalytics over a scheduled extract | Saved-search exports drift silently when someone edits the search; a query the connector owns does not. |
| **Sage / Xero / QuickBooks (smaller entities in a group)** | Vendor REST APIs, paged, on a watermark | Rate limits and shallow history are the constraint. A group with one Xero entity still needs full history in the model, which means an initial backfill plan. |
| **Planning: Oracle EPM, SAP SAC/BPC, Anaplan, Workday Adaptive** | Scheduled export of the approved budget/forecast version, tagged with that tool's version identity | The budget must arrive **with its version**, or "actual versus budget" silently compares against whichever budget was last loaded. Write-back is a later phase and a different risk class. |
| **Payroll / HR** | Scheduled extract of headcount, FTE, cost by cost centre and grade | The most sensitive feed in the product. It is needed for the largest cost line and for driver-based forecasting, and it must land aggregated to cost centre — no individual-level records in the governed layer. |
| **CRM (Salesforce, Dynamics)** | Pipeline, bookings, backlog by stage and close date | This is the revenue driver that makes a forward forecast more than a trend, and it is also the least reliable feed in the product. It arrives as a driver with a confidence, not as revenue. |
| **Operational (PSA, field service, MES, ticketing)** | Utilisation, chargeable hours, subcontract hours, volume, unit rates | The source of the Services-margin story on slide 5. Without at least one operational feed, driver analysis is arithmetic on the P&L wearing a driver's name. |
| **Banking / treasury** | Bank statements as ISO 20022 `camt.053`/`camt.052` or MT940/942 over host-to-host or SFTP; treasury system export where one exists | The 13-week direct forecast is built on actual cleared cash. Statement formats vary by bank in ways that need a per-bank parser and a reconciliation against the ledger. |
| **Controlled file ingestion** | SFTP or upload, CSV/XLSX against a **declared, versioned file contract** | Always needed and always underestimated. The contract — columns, types, period key, currency, sign convention — is the deliverable, not the folder. |

### 4.3 What every connector must do, whatever it connects to

- **Watermark and resume.** An interrupted load restarts from its watermark without duplicating.
- **Idempotent replay.** Re-running a load produces the same vintage, not a second copy.
- **Schema-drift detection.** A new or vanished source column is a visible event, not a silent
  null.
- **Late arrival and restatement.** A load may correct a closed period. It arrives as a new
  vintage that declares what it restates; nothing is updated in place.
- **Row counts and control totals**, compared against the source's own, per load.
- **Secrets and least privilege.** Read-only credentials, per source, rotatable, never in the
  application tier's own environment beyond what it needs to read.
- **A status a human can read**, because `FW-DATA-001` requires ingestion status to be visible and
  because the first question after a wrong number is always *when did this last load?*

## 5. The data model

This replaces §12 of the PRD. Eight objects become a declared grain plus the objects that govern
it.

### 5.1 The measure fact — the grain, stated

One numeric table. Every figure the product shows resolves to a query over it.

```
Measure fact
  entityId        legal or management entity          (never null)
  accountId       canonical line item                 (never null)
  period          fiscal month, YYYY-MM                (never null)
  scenario        ACTUAL | BUDGET | FORECAST           (never null)
  versionId       the version within that scenario     (never null)
  currency        the currency this row is stated in   (never null)
  costCentreId    null = the entity total
  segmentId       null = unsegmented
  channelId       null = unattributed
  vintageId       the immutable load this row came from (never null)
  amountMinor     signed integer, minor units
  quantity        signed integer or null — the volume behind the amount
```

Five rules do most of the work:

1. **Amounts are signed integers in minor units.** Never floats. A balance sheet that has to
   reconcile cannot be built on binary fractions.
2. **A null dimension means the aggregate, and it is a different row from its children.** So a
   cost-centre row and the entity total are never double-counted by construction: a query for the
   entity total filters on `costCentreId === null`, and no caller can accidentally sum both.
3. **`quantity` beside `amountMinor` is what makes price/volume/mix possible.** Without a volume on
   the same row, a bridge can only ever be a delta. This is the single field the PRD's model is
   missing that most changes what the product can do.
4. **Nothing is updated in place.** A correction is a new `vintageId` whose vintage record declares
   `restatesVintageId`. "As at" reporting and the audit trail both fall out of this rather than
   being built.
5. **A missing month and a genuine zero are different things**, and a query returns null rather
   than 0 when no fact exists. A dashboard that renders them identically will eventually tell a CFO
   their cash is zero.

### 5.2 The account taxonomy, and basis

Every source chart of accounts maps into canonical accounts. Each canonical account declares a
**basis**, and the basis is the single rule that makes every period scope correct out of one fact
table:

| Basis | Evaluated over a window as | Examples |
| --- | --- | --- |
| `flow` | Summed across the months | Revenue, cost of sales, opex, tax, receipts, payments |
| `balance` | Read at the last month present | Cash, receivables, payables, inventory, debt, equity |
| `avg_balance` | Averaged across the months present | The denominators — average capital employed, average receivables for a days ratio |

An account also declares its statement (P&L / balance sheet / cash flow), its side (asset /
liability / equity), its sign convention, and its polarity for display — because a cost that rose
is a positive number and unfavourable news, and colouring by arithmetic sign is how a rising
expense ends up green.

### 5.3 Currency — three of them, and a translation rule

- **Transaction currency** — what the document was in. Held for drill-down and for exposure.
- **Functional currency** — the entity's own. Its books are kept in this, and this is what an
  entity-level variance should be read in.
- **Presentation currency** — the group's. What the CFO reads.

Translation follows IAS 21: **closing rate** for balance-sheet items, **average rate for the
period** for P&L items, with the residual landing in a cumulative translation adjustment inside
equity rather than in profit. Rates are themselves versioned data with a source, because a variance
computed on a re-keyed rate is a variance nobody can reproduce.

This is what buys the two lenses every group CFO asks for: **reported**, and **constant
currency** — the current period restated at the comparative period's rates, so growth is separated
from translation. FX is then also available as a bar in the bridge rather than as an unexplained
residual.

### 5.4 Dimensions and hierarchies

| Dimension | Levels | Note |
| --- | --- | --- |
| Entity | Group → division → legal entity → branch | Carries functional currency, ownership %, and consolidation method. This is also the row-level security dimension. |
| Account | Statement → group → account | Carries basis, side, polarity. |
| Cost centre | Function → department → cost centre | The management view; often not the same tree as the legal one. |
| Segment | Line of business → product family | Where margin analysis lives. |
| Channel / customer group | Optional | Needed for mix; the first thing a pilot cannot supply. |
| Period | Year → **half-year** → quarter → month → week | Weeks only for cash. Fiscal, not calendar, as the primary key — a June year end then needs no special case, and a prior-year comparative is the same window shifted twelve fiscal months. Half-year is in the spine because `FW-AI-005` reports on it. |

**Consolidation** is part of the model, not a report: intercompany elimination pairs, ownership
percentage, minority interest, and the distinction between the statutory consolidated view and the
management view that reallocates costs across the legal boundary. UAE corporate tax now makes
IFRS-aligned statements a statutory matter and tax-group consolidation a separate line-by-line
exercise from the IFRS one — which is a good reason for the model to carry the consolidation method
per entity rather than assume one.

### 5.5 Versions, scenarios and vintages — three different things

They are routinely conflated and they answer different questions.

- **Scenario** — the *kind* of number: actual, budget, forecast.
- **Version** — a specific, immutable, owned state within a scenario: `FORECAST v7`, `BUDGET
  FY26 approved`. Carries status (draft / in review / approved / published / superseded), owner,
  approval record, and the assumption set that produced it.
- **Vintage** — the *load* a row arrived in, with its source system, load timestamp and what it
  restates. Answers "when did this figure become this figure".

A published figure cites all three. A version diff (§3.4) is a function of two versions' assumption
sets and the measures they move.

### 5.5a The comparator, as a control

`FW-AI-005` makes the comparator a user choice rather than a baked-in prior year, so it is a
first-class parameter carried in the URL, applied to every measure, and **named in every commentary
item and every board caption**. Five of them, and one needs defining before it can be trusted:

| Comparator | Resolves to |
| --- | --- |
| Prior period | The immediately preceding window of the same length |
| Prior year | The same window shifted twelve fiscal months, preserving length |
| Budget | The approved budget version for the same window |
| Forecast | The active — or a named — forecast version for the same window |
| **Trend** | The trailing-twelve-month linear expectation for the measure |

Four of those are objects in the model. **Trend is not** — it is a fit, and a comparator whose fit is
unstated is where a plausible-wrong number comes from. So its definition is written down, it is
labelled as an expectation rather than a plan wherever it appears, and it is **excluded from
materiality** — it may inform a reader and may not raise a priority-board item — until an owner signs
the definition off in the metric catalogue.

### 5.6 Drivers — a graph, not a list

The PRD's `Driver` is "an operational or financial input". That is not enough to attribute anything
to. A driver here carries:

- Its **value** per entity, period and version.
- Its **kind**: `observed` (it came from a system — utilisation, headcount, bookings) or `assumed`
  (a person set it in a forecast version).
- Its **edges**: which measures it moves, and how. `revenue = volume × price`, `services cost =
  chargeable hours × blended rate`, `receivables = revenue × DSO ÷ days`.
- Its **owner** and its **provenance**.

The edges are what make driver-based forecasting a recalculation rather than a spreadsheet, what
let a scenario move cash from a revenue change, and what let the bridge attribute a variance to a
driver rather than merely display one beside it.

### 5.7 The governance objects

| Object | Purpose | Key attributes |
| --- | --- | --- |
| Source / load | One extract from one system | Source, period covered, vintage, row counts, validation result, restates |
| Mapping set | Source codes → canonical codes | Version, effective dates, owner, status, coverage, unmapped list |
| Metric definition | A certified measure | Formula, basis, unit, polarity, owner, approval state, version |
| Materiality policy | What counts as material | Absolute floor and relative threshold, per statement and per account group, versioned, owned |
| Check | One reconciliation or validation rule | Rule, scope, severity, pass/fail, last run |
| Finding | Something a detector found | Detector, severity, entity, the closed set of figures behind it, why it fired, materiality score, fingerprint, **direction** (adverse / favourable), **horizon** (current / forward) |
| Priority insight | A finding surfaced to the CFO on one of the four boards | The finding, its board (direction × horizon), priority from materiality, period and comparator, linked commentary, typed action, status |
| Commentary | A management insight, at two levels | Anchor (the figure it explains), **level** (headline / detail), period, comparator, linked drivers, state, author, model and prompt version, vintage, approval record |
| Approval event | Evidence of a decision | Actor, timestamp, object and version, outcome, reason |
| AI interaction | One material model use | Purpose, model id, prompt version, inputs shown, output, accepted / edited / rejected, actor |
| Permission grant | Who sees and does what | Principal, role, entity subtree, dimension filters, publish rights |

## 6. The engines

Deterministic code, testable, no model involved. This is the half of the product that has to be
right before the other half is safe.

### 6.1 The drill spine

Not a screen. A property of every computed figure: it knows the **inputs** it was computed from
(each with its own value, months used and row count) and the **children** it aggregates, and
recursion terminates in source rows carrying their vintage. Build this once and lineage
(`FW-DATA-004`), traceability (`FW-AI-003`), the formula popover, the Explore drill and the
board-pack citation are all the same mechanism. Build it per screen and they will disagree.

### 6.2 The variance engine

For any measure, any two of (actual, budget, forecast version), any scope:

- The **variance**, with polarity applied so favourability is the metric's own and not the sign's.
- **Materiality**, from the policy object, absolute **and** relative.
- The **decomposition**: price, volume, mix, rate, FX, one-offs — MECE, with a stated attribution
  convention, and bars that sum to the total. The summing constraint is the discipline; a
  decomposition with a residual bar labelled "other" larger than its smallest real bar has
  explained nothing.
- The **three-way split**: in-month, year-to-date, remaining forecast, which is how timing is told
  apart from run-rate.
- **Attribution to drivers** through the driver edges, so "driven mainly by volume" is a computed
  claim.

### 6.3 The forecast engine

A forecast version is a base plus assumptions plus the driver graph. Recalculation is a pure
function of those three, which is what makes a version reproducible and a scenario shareable.
Rolling by default: each close extends the horizon. Assumption changes are recorded individually so
a version diff exists.

### 6.4 The cash engine

Direct: receipts and payments by week, from receivable and payable ageing plus collection and
payment profiles, plus payroll and tax calendars, plus debt service. Indirect: profit to cash via
working capital and non-cash items, which is the path a P&L scenario travels to reach a cash
answer. Each week's forecast is **locked** before actuals land, so weekly variance is real and
scoreable, receipts and payments separately.

### 6.5 The forecast-quality engine

Error by horizon, bias, and value added against a naive baseline, for both the monthly financial
forecast and the weekly cash forecast. Same-direction misses across consecutive vintages are
surfaced as an assumption to fix, not as a chart.

### 6.6 The detectors

Deterministic rules over the model, each writing its own plain-English statement of why it fired,
each carrying the closed set of figures behind it and a materiality score for ranking. **Every
detector must be provable quiet**: a second fixture with none of the conditions present, asserted
to produce nothing. A false positive in front of a CFO costs more than a missed finding, because it
discredits everything else on the screen.

Every finding also declares its **direction** and its **horizon**, which is what partitions the four
priority boards of §3.1 by construction rather than by judgement — and it means the detector suite has
to be balanced across all four quadrants, not merely across severities. A product whose only
forward-looking finding is a risk has an empty Opportunities board.

## 7. Governance

- **The metric catalogue is the semantic layer**, and it is the same artifact the AI reads. One
  certified definition serves the report, the export and the model — which is the answer to "how do
  you stop the AI making up its own definition of gross margin".
- **Close and completeness are visible on the executive surface**, not buried in an admin page.
- **Approval is a state machine with an immutable published snapshot** that pins the data vintage.
- **Permissions resolve on the entity subtree and the dimension filters**, and they resolve the same
  way for the chat as for the grid. The chat is not a way around the permission model.
- **Everything is versioned**: mappings, definitions, materiality policy, forecast versions,
  commentary, and prompts.

## 8. The AI, and what holds it

### 8.1 Where the model is, and is not

| Job | Who does it |
| --- | --- |
| Decide what is true — every figure, variance, decomposition, forecast and finding | Deterministic code |
| Decide what is material and what to rank first | Deterministic code, from the materiality policy |
| Phrase a finding, draft commentary, write a risk | The model, from a closed set of figures code produced |
| Answer a question by choosing which figures to look up | The model, through tools that are the only source of numbers |
| Post a journal, publish a pack, change an approved version | Nobody — a human, or not at all |

### 8.2 The grounding contract

The model cannot produce a figure; it can only ask for one. Tools read the governed layer and
return figures; **every numeral in the finished answer is then checked against everything the tools
returned**, and a numeral that is not accounted for makes the whole answer a named, logged refusal
rather than a plausible sentence. Arithmetic belongs in a tool, not in the model: a difference the
model worked out itself is a figure no tool returned.

There is **no second answer engine**. When the loop cannot finish — no model available, a transport
failure, too many turns, a figure that fails grounding — the product says which of those happened
and stops. A different engine reaching a different conclusion behind the same interface is worse
than no answer, because it breaks the only promise the product makes.

### 8.3 The action ladder

What the AI may do, written down, versioned, and enforced by the system rather than by a prompt:

| Rung | Meaning | Gate |
| --- | --- | --- |
| **Explain** | Answer a question, phrase a finding, describe a movement | None. Read-only, grounded, logged. |
| **Propose** | Write a draft — commentary, a scenario, an action — that changes no published state | None to create; it is a draft and labelled one. |
| **Change** | Alter an assumption, promote a scenario, publish commentary | A named human approval, recorded. |
| **Post** | Write to a system of record | Never. No capability exists. |

### 8.4 The AI audit log

Per material interaction: purpose, model id, prompt version, the data vintage the figures were
computed against, the figures shown, the output, and what a human then did with it — accepted,
edited, rejected. That is what makes `FW-SEC-002` an audit record rather than a usage counter, and
it is the artifact an audit committee will actually ask for.

## 9. Feature inventory

Against the PRD's three phases, with the findings' additions marked **[new]**.

### MVP — the decision foundation

Ingestion with vintages and validation · mapping sets with unmapped-account reporting **[new]** ·
the measure model with grain, basis and three currencies **[new]** · consolidation with
eliminations **[new]** · metric catalogue as the semantic layer · half-year in the period spine ·
the **comparator as a control**, with trend defined and excluded from materiality **[new]** ·
Overview with the **four priority boards** as a direction × horizon 2×2, each item carrying a typed
action · Performance with the variance **bridge** **[new]** · **Explore** — the analyst grid with
drill to source **[new]** ·
driver-based forecast with versions · **version diff** **[new]** · scenarios as base-plus-deltas,
shareable **[new]** · **13-week direct cash forecast with weekly lock and scoring** **[new]** ·
indirect P&L-to-cash bridge **[new]** · detectors with provable quiet · grounded Ask with named
refusals · **two-level commentary** anchored to figures, headline narrated and detail written by
code, stating its period and comparator **[new]** · approval state machine
with a vintage-pinned published snapshot **[new]** · close readiness and the reconciliation gate
**[new]** · row-level permissions on the entity subtree **[new]** · lineage · AI audit log ·
**forecast quality: error by horizon, bias, value added** **[new]** · spreadsheet export with
provenance **[new]** · no journal posting.

### Phase 2 — from insight to action

Broader driver coverage and a richer driver graph · allocations and transfer pricing · workforce
and headcount planning · rolling forecast automation at close · covenant and liquidity monitoring
with alerts · subscriptions and "what changed since I last looked" · board-pack assembly and export
· scenario portfolios and side-by-side comparison at scale · statutory-versus-management view
reconciliation · anomaly detection on journal patterns · multi-entity rollout tooling.

### Phase 3 — the intelligent finance co-pilot

Governed write-back of an approved forecast to the planning system · agentic close monitoring
within the action ladder · driver discovery from operational data · commentary that learns the
group's house style from approved history · peer and market benchmarks · deeper scenario methods
where the model supports them.

### Deliberately never

Posting journals · replacing the ERP or the accounting engine · rebuilding AP/AR OCR and workflow ·
being a general BI canvas · replacing Finance judgement or approval · a bottom-up
budget-submission workflow · individual-level payroll or customer data in the governed layer.

## 10. Non-functionals worth restating

The PRD's §14 is right in intent. Two changes.

**Replace "bank-grade" with the controls that exist.** Row-level access on the entity subtree;
tenant data segregation; read-only, least-privilege source credentials; immutable load vintages;
an append-only approval and AI audit record; no journal-posting capability anywhere in the product.
Those are testable claims. A grade is a procurement argument the MVP cannot win.

**Add reproducibility as a first-class non-functional.** Any published figure must be recomputable
from its stated version and vintage, on another machine, to the same value. It is the property
every other guarantee in this document rests on, and it is the one the demo exists to make
visible.
