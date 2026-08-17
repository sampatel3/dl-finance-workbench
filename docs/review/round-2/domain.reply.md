Verdict: no

The model is not wrong. I want to say that before anything else, because the brief warns me to
look for a demo whose data is the wrong side of the transaction, and this is not one. The entity
tree is the legal one with the management view held as a re-grouping off it, the currency layer is
IAS 21 done properly — functional versus presentation, closing rate for balances, average for
flows, counts left untranslated, a constant-currency lens that borrows the comparative period's
rates — and the consolidation runs translate, then eliminate, then attribute, in that order, with
a comment explaining why the order matters. Whoever wrote `packages/model` has kept a set of group
books.

What is wrong is narrower and it is all in the same place: **the controls that are supposed to
prove the figures are defensible do not test what they claim to test.** The balance-sheet
reconciliation cannot fail. The intercompany reconciliation nets across counterparties and never
names a pair. The forecast cannot carry a rate assumption, so a forecast variance in a
four-currency group has no currency component by construction. And the half of the close a group
controller actually signs — the statement of financial position, equity, the translation reserve,
the non-controlling interest — is computed in the model and shown on no surface, while the deck
promises "a governed model of P&L, balance sheet, cash and KPIs".

One procedural note, because it bears on how you read the first item. A fix round landed in the
working tree **while I was driving the product**: `git status` at the start of my session showed
only `docs/review/LEDGER.md` modified, and by the end `seed.ts`, `detectors.ts`, `gl-codes.ts`,
`contributors.ts`, `story.ts`, `scenario.ts` and `explore/page.tsx` were all dirty. Two of the
things I found are among them. I found them before I saw that diff, and I have said so item by
item; where a fix has landed I re-ran the numbers and recorded whether it works.

## Blocking

- **Critical** — The blocking control "Assets equal liabilities plus equity", threshold £0.00,
  cannot fail for any of the three foreign entities. The cumulative translation reserve is
  *defined* as the residual that makes each foreign entity balance, so it absorbs whatever does
  not tie. The Controls surface presents this as a passed named reconciliation with both sides
  quantified, next to a sentence saying "a reconciliation that always balances is one that has
  stopped being a check". I need to see either a check whose left and right sides are computed
  from independent sources, or the reserve derived from an equity movement history and the
  residual reported separately as an unexplained difference — not a plug rendered as a control.
    - `packages/model/src/consolidate.ts:219-231` sets `reserveByEntity` to
      `assets − liabilities − capital` for every entity whose functional currency is not GBP, then
      writes the sum into the `translation_reserve` equity line.
      `packages/model/src/checks.ts:91-110` then tests `assets − liabilities − equity = 0` against
      a zero threshold.
    - I proved it rather than argued it. I injected AED 5,000,000 of phantom inventory into
      Kestrel Gulf and re-ran the consolidation: consolidated difference stayed at **exactly £0**,
      the check stayed **passed**, and the translation reserve moved from −£15,721 to
      **+£1,055,199**. A £1.07m fabricated asset went into equity and nothing turned red.
    - The consequence for the buyer is specific: this is the one control on the Controls surface
      marked `blocking` that a group financial controller would point at when asked "what stops a
      bad balance getting into the pack?", and for the three entities where the risk is highest —
      the ones being translated — it stops nothing.

- **Critical** — Approved Forecast v6 contained £212k of "unmapped operating expense", which made
  the demo's own headline EBITDA miss read at a quarter of its true size, and the Overview then
  described that £212k in terms flatly contradicted by two other surfaces. **A fix for both halves
  landed in the working tree during this review and I have verified it works** — I am reporting it
  because it was live in the running product when I started and it is uncommitted.
    - The arithmetic, taken from the running product before the fix: the Performance operating
      expense table read "Unmapped operating expense · Actual £212k · Comparator £212k · +£0.00 ·
      +0.0%", and the EBITDA bridge against Forecast v6 showed a "£0k Unmapped opex" bar. The same
      bridge against Jul 25 actual showed "−£212k Unmapped opex" — which is how the leak is visible
      from the outside without reading any source.
    - Cause: `healthy` is a world-level flag, so `buildWorld` generated every plan version through
      the same `monthPl`, and the planted unmapped accounts were emitted into Budget FY26 and every
      forecast version. The code's own comment at `seed.ts:945` said they land "only as actuals: a
      forecast cannot have failed to map an account that had not appeared when it was made", which
      was the opposite of what the function did.
    - Effect on the headline: `/api/v1/measures` reported EBITDA −3.0%, £64k, priority **low**.
      With the forecast correctly at £0 unmapped it is −£276k, −11.6%, priority **high** under the
      product's own materiality policy. I computed that before seeing the fix; the running server
      now returns exactly `"£276k and 11.6%" … "high"`. The demo was understating its own EBITDA
      miss by a factor of four and ranking it off the board.
    - The second half: the Overview finding and the Controls alert both said the £212k "carries
      value outside the reported profit and loss". It is inside it — the measure catalogue defines
      Opex as "staff cost + other operating expense + unmapped" and EBITDA as "gross profit −
      operating expense", and the check "Mapped P&L reconciles to the trial balance" names "£212k
      Trial-balance rows held on the unmapped P&L line". A controller reading the Overview
      concludes EBITDA falls £212k when the codes are mapped; it does not move at all.

- **High** — Group revenue is not group revenue. The headline £12.4m is £12,345,220 of external
  revenue **plus £48,000 of intercompany revenue that did not eliminate**, and the product says so
  in the formula: "external revenue + any intercompany revenue that did not eliminate". Under
  IFRS 10 intragroup revenue is eliminated in full; an unmatched difference goes to a consolidation
  suspense account and blocks the close. It does not go on the top line, and because the matching
  is `Math.min` of the two sides, the £48k lands in gross profit and EBITDA at 100% margin. I need
  to see the elimination taken in full and the difference carried as a named reconciling item.
    - Worse on the comparator: Forecast v6 carries **£98,078** of un-eliminated intercompany
      revenue — twice the amount that is flagged as a blocking control failure on the actuals — and
      no control tests it, because `reconciliationChecks` runs on `scenario: 'ACTUAL'` only. So
      both sides of the flagship £618k variance are contaminated, in opposite directions. The
      revenue bridge does name the net as an "Intercompany −£50k" bar, which is to its credit, but
      nothing anywhere says the approved forecast fails the group's own intercompany control.
    - The drill is honest about the £855k that *did* eliminate: I opened the July revenue cell in
      Explore and got the five entities plus "Intercompany eliminated −£855k / −6.9%" and "These
      parts sum to the cell exactly". The £48k that did not eliminate appears on no line in that
      drill; it is silently inside both Kestrel Manufacturing's row and the group cell.

- **High** — The intercompany reconciliation is a group net, not a counterparty matrix, and its
  tolerance is not a real one. The check reads "£903k Seller ledgers — Kestrel Manufacturing" versus
  "£855k Buyer ledgers — Kestrel Services, Kestrel Gulf, Kestrel Inc", difference £48k. The first
  thing a group financial controller does with an intercompany break is open the pair. This demo
  cannot show one, and the Ask panel that might have been asked is dead (below). I need to see the
  reconciliation by counterparty pair, and by currency.
    - Netting buyers together means offsetting differences cancel. Here there is one seller so the
      break is recoverable by inspection; add a second selling entity — which any real group has —
      and a +£200k break at one pair and a −£200k break at another reports as reconciled.
    - The threshold is `£1.00` on amounts translated out of AED, EUR and USD at monthly average
      rates. No group uses a £1 tolerance on translated intercompany, because translation rounding
      alone breaches it; the trade runs a tolerance band per pair with an explicit FX-difference
      bucket, precisely so that a real cut-off break is distinguishable from a rate difference.
      There is no transaction-currency view of intercompany anywhere in the model —
      `currency.ts:11` states that document currency is deliberately not represented on `Fact` —
      so the demo cannot separate a genuine mismatch from a translation one, which is the whole
      job of this reconciliation in a multi-currency group.

- **High** — A forecast variance in this group can never have a currency component, so the single
  most-argued bar in a real multi-currency forecast review does not exist. Every scenario is
  generated against one rate table: `buildWorld` builds `rates` once and passes the same object to
  the actual and to every version, and `AssumptionSet` carries volume, price, unit cost, service
  delivery cost, subcontract rate, subcontract hours, DSO days and pipeline conversion — and no
  exchange rate. I need to see a plan rate held on the version, and the FX bar in the
  forecast bridge showing the difference between the rate the plan was set at and the rate the
  month closed at.
    - Driven, not inferred: the revenue bridge against Forecast v6 has no currency bar at all;
      switching the comparator to prior year makes an "FX translation −£115k" bar appear
      immediately. The mechanism works — there is simply nothing for it to find against a plan.
    - Deck slide 5 asserts "Currency is separated out so no commercial bar carries a translation
      effect" over exactly the bridge in which the currency effect is structurally nil. A group
      FP&A lead will ask "what rate is Forecast v6 at?" in the first two minutes and no surface
      answers it.

- **High** — There is no balance sheet. The deck's slide 3 promises "A governed model of P&L,
  balance sheet, cash and KPIs"; the product has twelve surfaces and none of them is a statement of
  financial position. The only balance-sheet view is a seven-line movement table on Commentary:
  fixed assets, capital spend, inventory, receivables, cash, payables, borrowings, working capital.
  For the buyer this brief describes, that is the half of the close they personally sign.
    - Omitted from that table: intercompany receivables and payables, other assets, other
      liabilities, and **all three equity lines**. The assets shown total roughly £73.2m against
      £80.1m of consolidated assets, and nothing on the page reconciles the gap.
    - `nonControllingInterest` is computed — £1,113,283, being 15% of Kestrel Europe GmbH's net
      assets — and rendered on no surface. `translationReserve` (−£15,721) likewise. PAT is
      reported at 100% throughout, including on Scenarios, with no "attributable to owners of the
      parent" anywhere. For a plc that is the number on the front of the pack and the denominator
      of EPS. The model knows about NCI and IAS 21; the product never shows either, which is the
      one thing that would prove to a group controller that this is a consolidation and not a
      roll-up.
    - The deck contradicts itself on this too: the title slide says "one model of P&L, cash and
      KPIs" and slide 3 says "P&L, balance sheet, cash and KPIs".

- **High** — The 13-week cash forecast and the board floor run on a pooled group balance that the
  panel directly beneath them says cannot be pooled. Group cash of £4.8m nets Kestrel Manufacturing
  at +£6.37m against Kestrel Services at −£1.60m and Kestrel Inc at −£2.02m. Nothing in the model
  or on any screen names an overdraft, a cash pool or a right of set-off, and IAS 32 offsetting
  needs both a legally enforceable right and an intention to settle net. I need to see cash and
  overdrafts presented gross, and the forecast run by pool and by currency.
    - The contradiction is on one page: the breach analysis says week 9 closes at £1.7m against a
      £2.5m floor, which is only a meaningful statement if the £4.8m is spendable; the funding panel
      below it then models entity buffers, approvals, banking cut-offs, currency conversion and a
      40-working-day lead time — i.e. it says the cash is not fungible, and excludes Kestrel Inc
      entirely because its period is not closed.
    - The floor is only ever applied forward. **June 2026 closed at £1.4m actual — £1.1m below the
      board's own £2.5m floor — and no surface, detector or check mentions it.** I found that in
      the Explore CSV export, not on any screen. A treasury function whose product flags a
      projected week-9 breach and stays silent on a breach that already happened has the control
      pointing the wrong way.

- **High** — Keyless, the surface named after the problem the deck is built on cannot answer
  anything, and the README calls the demo whole anyway. I posted to `/api/ask` seven times, across
  four personas and six different questions; all seven returned the identical
  `{"kind":"unavailable","failure":"no_client"}`. The refusal is honest, named and correctly a 200,
  and an empty question correctly 400s — none of that is a crash. But the deck's problem statement
  (slide 2) climaxes on "A question — the board asks where a figure came from, and the whole cycle
  starts over", and the Overview's closing call to action is "Need to go deeper? Explore & Ask …
  grounded questions and the evidence chain behind a cited figure". Both lead to a panel that
  refuses everything, including its own four suggestion chips.
    - The README's "Without it the demo is whole: … Ask says plainly that it cannot look anything
      up" is self-refuting as written. A panel that cannot look anything up is not a whole demo of
      a product whose pitch is answering the board's question.
    - It also removes the only route to the answers the other findings above leave open — which
      counterparty pair is the £48k, what rate is v6 at, where is the NCI. I tried all three as
      questions. All three were refused.

## Would improve

- The most damning fact in the pack is buried by an ordering rule. Quality & Controls reports that
  EBITDA has been over-called in 3 of 3 forecast versions by a mean of 20.0%, and that against a
  "same month a year earlier" baseline the EBITDA forecast adds **−328.5%** value — it is more than
  four times worse than doing nothing. That finding sits *below the cut* on the Risks board,
  displaced by a £35k-a-month subcontract rate, because the cap of three per board breaks ties by
  detector order rather than by priority.
- "Underlying revenue growth 99bps ahead of reported" is filed on the **Favourable** board. A £115k
  currency drag on the reported top line is not good news; the favourable reading is a gloss on it.
  A group treasurer reads that as spin, and it is the one item on that board that would make them
  distrust the other three.
- DSO is defined as "average receivables ÷ revenue × days in the period" against a single month's
  revenue. That is why the demo's own series jumps from 57 to 65 days in one step. Group treasury
  uses a countback or a three-month rolling denominator precisely to stop seasonality moving a
  collections metric that nothing about collections caused.
- Nothing in the source list is a consolidation system — four ledgers plus Anaplan, Salesforce, a
  PSA, payroll and camt.053 bank statements, all correctly named and correctly typed. But a plc's
  statutory consolidation lives in a dedicated tool, and it is the output the auditors sign.
  Nowhere does the workbench reconcile its group figures to it, and the roadmap does not mention a
  consolidation connection until weeks 9–11. "Whose group revenue goes to the board" is the first
  question the group financial controller will ask, and the answer has to be a reconciliation, not
  a claim.
- Materiality has no entity or segment dimension. One £50k P&L floor decides what is material at
  the group and at Kestrel Inc, whose entire monthly revenue is £730k — where £50k is 6.6%. The
  policy object is right and versioned and owned, which is more than most products manage; it just
  needs a second axis.
- No effective-tax-rate walk and no deferred tax. The catalogue notes tax is "charged at each
  entity's own rate — nine per cent in the UAE, thirty in Germany — so a group effective rate is a
  weighted outcome rather than a policy", which is exactly right and then stops. An ETR
  reconciliation is a standing item in a group close pack.
- The commentary carries a draft/approved state and a rule that changing the period creates a new
  unapproved draft, which is good. The **figures** carry no such state. Nothing on Overview says
  who approved the July pack or that it is unapproved, next to a banner saying the period is not
  final.
- Capital spend is presented as a balance-sheet line with an opening balance: "Capital spend in the
  month · Assets · Jun £330k · Jul £331k · +£366.31". Capex is a period flow, it has no opening
  balance, and it is not an asset; it belongs as a component of the £53k fixed-asset movement,
  which is what the note beside it already says it is.
- Small things that a controller notices in the first minute and that cost the pack credibility:
  "the £2.5m floor set in **Group Treasurer**, per board minute" (a template writing "set in
  {owner}", on both the Overview headline risk and the Cash page); money formatted to the penny
  beside £k and £m in the same column — "−£5,886.36", "+£366.31", "+£0.00"; "above the forecast in
  force in each of the last **3 months** (v5, v6)" naming two versions for three months.
- `MINIMUM_CASH` is a bare £2.5m constant with a person's name attached and no id, version, status
  or effective date — unlike the materiality policy it sits beside, which has all four. "Which
  board minute, and when?" has no answer.
- The Overview contributor tables put every entity outside the top three into a row labelled
  "Eliminations and unattributed", owned by the Group Financial Controller. On revenue that row is
  +£17k, made of Kestrel Europe +£82k, Kestrel Inc +£40k and eliminations −£105k. Eliminations
  moved −£105k; the row implies +£17k, and £122k of two named controllers' movement is booked to
  group consolidation. The footnote "The other 2 are in the remainder" discloses it; the label and
  the owner column contradict it.
- The forecast-bias table's mean errors cannot be reproduced from the per-version evidence printed
  beside them — Revenue shows +2.3% over v4 +4.0%, v5 +1.2%, v6 −5.0% (simple mean 0.07%);
  Subcontract shows −9.6% over −11.0, −8.2, −5.6 (simple mean −8.3%). They are point-count-weighted,
  which is the right choice, but the screen says "the per-version series is the evidence rather than
  the assertion" and never states the weighting. The one number a reader will check by hand does
  not tie.
- The Explore CSV names its comparator from the window's first month — "Comparator,Feb 26 Forecast
  v6" — on a grid whose reporting period is July and whose header everywhere else reads "Jul 26
  Forecast v6". An exported evidence file that mislabels its own basis is the one artefact where
  that matters most.
- The Explore grid shows Forecast columns for Feb–May 2026 at +0.0% variance with no note that
  those months are actuals held inside Forecast v6 rather than a forecast. Performance states the
  cut-off; the grid does not, and a reader concludes the group forecasts perfectly for five months
  and then falls apart.
- The period selector offers both "Year" and "Year to date". In every state this demo can reach
  they resolve to the same window and the same figures (2026-01 to 2026-07, labelled "FY26 YTD to
  Jul 26"). A controller picking "Year" expects the full-year view — seven actual plus five
  forecast — which is a thing the product has, on a different surface, called Year to Go.

## What it gets right

- IAS 21 is done properly in the model, and I expected it not to be. Functional versus presentation
  currency, closing rate for balances and average for flows, non-monetary counts left untranslated
  ("a count is a count in every currency"), a constant-currency lens that borrows the *comparative*
  period's rates rather than a fixed one, and rates held as a versioned table with a named source
  rather than as constants. The elimination-after-translation ordering is stated and correct.
- The evidence chain is real, and it is the best thing here. The Explore CSV export carries raw and
  formatted values, the formula, the owner, the definition state and the contributing load vintages
  — including the restatement vintage on the June rows. I reproduced the £618k and the +5.2% by
  hand from it. Vintages behave the way a close behaves: a correction arrives as a new load naming
  the one it restates, and the June gross-profit variance the restatement created is visible in the
  grid while June revenue stayed flat.
- The refusals are the right refusals, which is the tell that someone in the trade has read this. A
  business-unit controller is 403'd out of the group at both the page and the API. A fitted trend
  comparator is inadmissible for materiality. Ratios show no share because they are not additive.
  Entity rows are computed independently and never apportioned down, and the page says so. Submitted
  and closed are separate acts with separate timestamps. And `checks.ts` explicitly declines to
  fabricate a subledger reconciliation because it has no independent source for one — which is the
  opposite instinct to the balance-sheet check above, and the reason that finding is worth fixing
  rather than fatal.

## Questions it failed to pre-empt

- Whose consolidation is authoritative? If the workbench eliminates, translates and computes NCI
  itself, and the group's consolidation system does the same, which figure goes to the board, and
  where is the reconciliation between the two?
- What exchange rate is Forecast v6 set at? No surface names a plan rate, and the answer turns out
  to be "the same table the actuals used", which no real forecast uses.
- Is EBITDA of £2.1m before or after the £212k of unmapped cost? Two surfaces answered differently
  when I drove it.
- Which counterparty pair is the £48k intercompany break? The check names one seller and three
  buyers and stops there.
- Is the group's £4.8m of cash spendable? Two panels on the same page assume opposite answers.
- Where are equity, the non-controlling interest and the translation reserve, given the model
  computes all three and a plc board pack leads with the first and the second?
- Which board minute set the £2.5m cash floor, and on what date?
- Who signed the July pack? The commentary carries an approval state; the figures carry none.
- Why is the group's own cash floor not tested against closing actuals, when June closed £1.1m
  below it?

## What I made of the product after driving it

I fetched all fourteen routes plus `/deck.html` over curl with long timeouts; every one returned
200, several after a 60–200 second cold compile, none of them dead. I read the deck end to end and
then went looking for each of its numeric claims in the running app.

**APIs, more than once.** `/api/v1/measures` seven times: default; as a business-unit controller
asking for the group (correctly **403**, "Kestrel Industrial Group plc is outside this persona's
entity scope"); as a business-unit controller asking for Kestrel Gulf (200, its own four measures);
with deliberately corrupt parameters `entity=NOPE&period=banana&month=1999-13&comparator=zzz`
(200, fell back to the default view and flagged `parametersFellBackToDefaults: true`, which is the
right behaviour); and across `period=month|quarter|year|ytd`. That last sweep is where I found Year
and Year to date returning the identical window. `/api/ask` seven times, four personas, six
questions plus one blank — the blank correctly 400s, the other six all returned the same named
`no_client` unavailable. `/api/v1/explore` twice, taking the CSV apart line by line; that is where
I found the "Feb 26 Forecast v6" comparator label and the June cash balance of £1.4m.

**In the app.** I switched the comparator from Forecast to Prior year on Performance, which is what
made the FX bar appear at −£115k and proved the currency separation works — and, incidentally, made
the "−£212k Unmapped opex" bar appear in the EBITDA bridge, which is what put me onto the leak into
the forecast. I opened the drill on the July revenue cell in Explore and got the five entities plus
"Intercompany eliminated −£855k / −6.9%" with "These parts sum to the cell exactly", which verifies
the deck's slide 6 claim. I walked Controls tab by tab: sources, loads and vintages, close
readiness, the three named checks, mappings, the measure catalogue.

**Where I checked the numbers behind the screen.** I wrote two throwaway probes against
`packages/model` and deleted them afterwards. The first printed the consolidation: group revenue
£12,393,220 of which £48,000 is un-eliminated intercompany; Forecast v6 revenue carrying £98,078 of
the same; unmapped opex at £212,000 in *both* actual and Forecast v6; the translation reserve at
−£15,721 and NCI at £1,113,283. The second is the one that matters — I injected AED 5,000,000 of
phantom inventory into Kestrel Gulf, and the consolidated balance sheet still reconciled to exactly
£0.00 with the check still passing, the whole error having gone into the translation reserve.

**Where the demo disagreed with the deck.** Slide 3 promises a governed balance sheet; there is no
balance-sheet surface, no equity and no NCI anywhere in the product, and the deck's own title slide
omits the balance sheet from the same list. Slide 5 says currency is separated out so no commercial
bar carries a translation effect, over a bridge in which the currency bar is structurally zero
because plan and actual share one rate table. Everything else on slides 4, 5 and 6 I could verify:
£12.4m against £11.8m, £618k, +5.2%, the £0k residual, every bar named, five ledgers, the drill
reaching rows with their measure, period and vintage. The three surfaces the deck actually shows do
what it says they do.

**And a fix round arrived underneath me.** Between my first fetch and my last, seven source files
went dirty in the working tree, including the two that carry the unmapped-account defect. I re-ran
the numbers on the patched source: Forecast v6 unmapped is now £0 and the EBITDA variance is
−£275,986 / −11.6% / priority high — which is the figure I had computed from the pre-fix data
before I saw the diff, and the running server now returns it. I have left that item as Critical
because it was live when I drove the product and the fix is uncommitted, but it is fixed, it is
verified, and it should close on sight.
