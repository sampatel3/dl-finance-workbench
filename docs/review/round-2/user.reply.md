Verdict: no

I am the Group FP&A analyst at Kestrel. My month-end job is to explain the July variances,
answer whatever the CFO asks about them, and say whether the figures are safe to publish. I
took two real tasks through this product end to end. I finished neither without going outside
it, and one of the two ended on a Next.js 404 page.

**The running demo contradicts the deck, and contradicts itself.** Say this first: the deck's
slide 6 stakes the whole product on "each figure drills to the rows that made it" and "nothing
is rounded before it is compared". I drilled July revenue. The terminal source-row table shows
eleven rows totalling about £23.5m under a figure of £12.4m, including a single row printed as
"£10.4m" from the Gulf ledger — an entity whose entire month is £2.7m. The amounts are in each
entity's own currency and every one of them is stamped with a pound sign. That is the last step
of the evidence chain, and it is the step the deck sells.

## Blocking

- **Critical** — Every assumption lever on the Scenarios page 404s, including inside the guided
  tour's own step 8, which is titled "Move an assumption; move the cash line". The levers link
  to `/scenarios?...` instead of `/app/scenarios?...`. I need the levers to move the model in
  place, and I need the tour step that tells a presenter to move an assumption to survive being
  obeyed.
  - 20 lever controls (volume, price, cost to serve, subcontract rate, collection days × 4
    steps) plus all 5 "Run it" buttons on the saved scenarios point at the unprefixed path.
  - Clicked "VOLUME −10%" on `/app/scenarios`: landed on
    `http://localhost:3002/scenarios?volume=0.9`, body text "404 — This page could not be
    found." Clicked "Run it" on "Revenue down 10%": same 404. `curl` confirms:
    `/scenarios?volume=0.9` → 404, `/app/scenarios?volume=0.9` → 200.
  - Worst case, and the one a buyer will hit: opened `/?step=8&mode=guided&device=desktop`,
    which frames `/app/scenarios?view=inner&focus=section-effect&dsoDays=10` and captions it
    "Move an assumption; move the cash line … LOOK AT: the side-by-side effect and headroom
    comparison". Clicked "+4%" inside the frame. The product was replaced, inside its own
    device frame, by the Next.js 404 page. Screenshot at
    `/tmp/review-driver/user-tour-scenario-404.png`.
  - The engine underneath is fine — reached by a hand-typed working URL it recomputes properly.
    This is 25 dead controls in front of a live model, and they are the only model controls in
    the product.

- **Critical** — The evidence chain's terminal "Source rows" table prints foreign-currency
  amounts with a sterling symbol, and the rows do not tie to the figure they are evidence for.
  I need every amount in that table to be in the same currency as the figure above it, or the
  row's own currency named in a column — and the rows to reconcile to the total.
  - `/app/explore?drill=0%3A5` (Revenue › 2026-07, £12.4m consolidated). The provenance table
    above it is correct: External revenue 1,234,522,034 minor + Intercompany unmatched
    4,800,000 minor = £12.393m. The "Source rows — 11 of them" table below it lists
    3.5 + 0.910 + 2.1 + 0.947 + 10.4 + 2.1 + 1.3 + 0.460 + 0.763 + 0.169 = about £22.6m of
    revenue rows, all marked "£".
  - The Gulf rows (£10.4m + £2.1m) are AED: divided by ~4.6 they come to Gulf's real £2.7m. The
    d365-eu rows are EUR, the netsuite-us rows USD. `packages/model/src/facts.ts:57` says facts
    are stored "in minor units of the entity's functional currency";
    `web/app/app/explore/page.tsx:504` renders them with `formatValue(row.amountMinor,
    'currency')`, which always prints the presentation symbol.
  - The same table shows a `revenue_ic` source row of "£903k" beneath a stored `revenue_ic`
    input of £48k, unexplained. £903k is the gross intercompany figure; £48k is the unmatched
    residual. Presented side by side as "the rows behind this number", that is a 19x
    discrepancy an auditor stops at.
  - The caption says the rows "terminate the drill spine" and are "shaped like ledger lines".
    They are, and a controller will read them. I cannot hand this to anybody.

- **Critical** — Year to Go states, as a fact and labelled "for the year", a comparison of seven
  months of actuals against a twelve-month budget. I need the two sides of any stated gap to
  cover the same window, or the window named in the sentence.
  - "Largest single gap to budget for the year: Kestrel Manufacturing Ltd, £23.9m behind" and
    "Service contracts, £13.7m behind", on the risk and opportunity cards.
  - Manufacturing's revenue is running at about £5.5m a month — £23.9m behind budget is a third
    of its year. It is not a miss: group actual YTD is £90.2m against an FY budget of £147.0m,
    a £56.8m arithmetic difference, and Manufacturing is ~42% of revenue. £56.8m × 0.42 =
    £23.9m.
  - `packages/analysis/src/outlook.ts:494` builds `yearCtx` at the full fiscal-year scope and
    line 432 passes it to `contributorsFor` with `comparator: { id: 'budget' }`. The actual side
    has seven months of data in that window; the budget side has twelve.
  - The governed table at the top of the same page says revenue lands £153.3m, "+£6.3m to
    budget, AHEAD". So the page tells me the group is ahead of budget and its largest entity is
    £23.9m behind, in the same breath. The disclaimer ("the two do not reconcile") excuses the
    exposure figure, not a comparison of unequal windows.

- **Critical** — The app cannot agree with itself on whether the £212k of unmapped accounts is
  inside reported profit. I need one answer, because it is the difference between a clean board
  note and a £212k understatement of EBITDA.
  - Overview, HIGH finding "2 unmapped accounts, £212k at stake":
    "Until they are mapped that value is **outside** the reported profit and loss"
    (`packages/analysis/src/detectors.ts:811`). The Controls page repeats it: "A code that
    reaches the ledger without a mapping carries value outside the reported profit and loss."
  - Performance, Operating expense table: "Unmapped operating expense £212k … Total operating
    expense £3.1m." The catalogue defines Operating expense as "staff cost + other operating
    expense + unmapped" and EBITDA as "gross profit − operating expense". `seed.ts:961` is
    `ebitda = grossProfit - staffCost - otherOpex - unmappedOpex`.
  - The reconciliation gate passes *because* the £212k is on a P&L line: "Mapped P&L reconciles
    to the trial balance — PASSED — £212k trial-balance rows held on the unmapped P&L line."
    The catalogue note says the unmapped line "is the reason the mapped profit and loss ties to
    the trial balance."
  - One of these is untrue. I read the Overview first, because that is where the demo starts.

- **Critical** — July's forecast comparator contains the same £212k of unmapped cost that only
  appeared in July's actuals, so the EBITDA variance nets it to zero. I need the unmapped line
  to show its full £212k adverse variance against a forecast that could not have contained it.
  - Performance, Operating expense: "Unmapped operating expense — actual £212k, comparator
    £212k, £ variance +£0.00, % variance +0.0%". The EBITDA bridge draws a bar labelled
    "Unmapped opex £0k" — the app asserting these accounts contributed nothing to the miss.
  - The Controls GL-code panel says both codes were created on 2026-07-03 and 2026-07-09.
    Forecast v6 has actuals through 2026-06. `seed.ts:945` states the intent in a comment: "the
    unmapped accounts land in July only, and only as actuals: a forecast cannot have failed to
    map an account that had not appeared when it was made." Line 948 gates them on
    `!healthy && month === SEED_END` only, never on `projecting`, so every forecast version
    carries them too.
  - The consequence is on the headline KPI card: EBITDA "−3.0%, −£64k vs Forecast v6". The
    unmapped item alone is £212k. The published miss is a third of the real one.

- **High** — I cannot work the queue. The nine "items that need a decision" are the same nine
  whoever I am, the page misstates how many there are, and six of them cannot be opened. I need
  a queue filtered to what I own, with a date and a state on each item, and every item openable.
  - `/app`, `/app?as=group-fpa`, `/app?as=group-controller`: the role label in the context strip
    changes; the nine findings, their order and their owners are byte-identical. I own one of
    them ("Subcontract labour under-called"). The other eight belong to the Operations Director,
    the Treasurer, the Commercial Director, the Sales Director and the Group Financial
    Controller, and each of them sees my item too.
  - The summary line says "9 findings in Jul 2026: 3 adverse, 2 favourable, 3 risks and 1
    opportunity", and the nav badge says 9. The boards themselves say "3 of 7 shown … 4 below
    the cut" and "3 of 5 shown … 2 below the cut". There are 15 findings. My queue size is
    misstated by two thirds.
  - The six below the cut are a sentence in a paragraph — "Service contracts margin 267bps
    behind forecast; Kestrel Gulf collections 12 days slower; 1 of 5 ledgers not closed;
    2026-06 restated after it was reported". I counted zero links, buttons or disclosure
    controls containing that text. No owner, no evidence, no way in.
  - No item carries a due date, a state, or anything I can mark. There is nothing to tell me
    which of these needed me today, and nothing to record that I dealt with one.

- **High** — Two different thirteen-week cash forecasts, for the same month, the same group and
  the same approved version, on two pages, with different breach weeks and different shortfalls
  and no label saying they are different things. I need each cash line to name its opening
  basis, or one number.
  - `/app/cash`: "Week 9 closes at £1.7m, £760k under the £2.5m floor. Its low point is £1.3m in
    week 10." Four breach weeks (9, 10, 11, 12). Transfer panel: "£7.9m can arrive in time
    against a shortfall of £760k."
  - `/app/scenarios`, row labelled "Approved forecast": low point £2.2m, headroom −£273k, breach
    Week 10. Decision card: "The floor is breached in week 10 by £273k, and £8.8m can be reached
    in time."
  - The gap is the opening balance — Cash opens on the £4.8m actual, Scenarios opens on Forecast
    v6's £5.9m — but neither page says so. As the person drafting the treasury paper I have two
    shortfalls, £760k and £273k, and no way to choose.

- **High** — The Explore grid's default forecast comparison reports every closed month as
  exactly on forecast, which flatly contradicts the Quality page in the same app. I need closed
  months compared to the forecast that was in force when they were open, or a note on the grid
  saying the comparator has absorbed the actuals.
  - `/app/explore`, rows=measure, cols=period, comparator vs Forecast v6: revenue, EBITDA, cash
    and DSO all read "+0.0%" / "+0 days" for 2026-02, 03, 04, 05 and 06. Five of six columns.
    Verified in the raw CSV: `Revenue,2026-02, Actual raw 1247083317, Comparative raw
    1247083317, Movement 0`.
  - It is arithmetically correct — v6 has actuals through June — and it is the first thing I
    would build, and it says we hit forecast to the penny for five months.
  - `/app/quality`, same session: "EBITDA — mean error +20.0%, 3 of 3, OVER-CALLED. Subcontract
    labour — −9.6%, 3 of 3, UNDER-CALLED. Cost of sales — 3 of 3, UNDER-CALLED." And value
    added versus a naive baseline of −328.5% on EBITDA.
  - The one non-zero closed month, June's "+223bps" margin beat, is not a beat: it is the
    v-2026-07-restate-2026-06 reclassification. The June Overview explains that properly. The
    Explore grid and the Performance page, where I would actually meet it, say nothing.

- **High** — On this server the Ask panel is dead every single time, including all four of the
  questions the product itself puts on screen, and the README says the demo without a key "is
  whole". I need the suggested questions to be answerable in whatever mode is being shown, or
  the panel to say up front that it cannot answer before I type into it.
  - Six POSTs to `/api/ask` (three of them the same flagship margin question): 6/6
    `{"kind":"unavailable", ... "The answer service is not running here, so nothing could be
    looked up."}`. Four attempts through the UI textbox: 4/4 the same. Clicking the offered
    "Why is EBITDA ahead of forecast?" — refused.
  - Nothing on the panel warns me first. It shows "Asking… / Working on your question." and then
    refuses. On the empty submission it left the previous question's refusal on screen.
  - The refusal itself is well written and honest. But "an executive answer, an analyst drill
    and a controller evidence chain remain the same computation" is the product thesis on the
    front door, and one of the three cannot be shown at all here. That is not whole.

- **High** — The Performance page's entity table does not sum to the group and does not name the
  elimination, in the one place the deck promises it will. I need the intercompany elimination
  as a labelled row wherever entity rows sit under a group figure, or a note on that table
  saying the rows do not add.
  - `/app/performance`, "Revenue by entity": group £12.4m, then Manufacturing £5.3m, Services
    £3.0m, Gulf £2.7m, Europe £1.5m, Inc £730k. The five sum to £13.2m. The £855k elimination is
    absent and there is no note.
  - The Overview's equivalent table has the row ("Eliminations and unattributed") and a
    paragraph explaining why the parts do not add. The Explore drill does it best: "Intercompany
    eliminated −£855k … These parts sum to the cell exactly."
  - Deck slide 6: "the consolidated total split into its five entities, with the intercompany
    elimination named as its own line." The drill honours that; the analyst page I would live on
    does not.

- **High** — Percentage movements are published across a sign change and on negative bases, in a
  product that is otherwise scrupulous about refusing meaningless ratios. I need a sterling
  movement and a suppressed percentage where the comparative is zero or of the opposite sign.
  - `/app?entity=services`: "EBITDA −£175k, −141.4% vs Jul 26 Forecast v6". The comparative is
    −£73k; the movement is £102k worse. −141.4% is not a rate of anything.
  - Same card: "CASH −£1.6m, −8.6%" on a negative balance, where I cannot tell from the sign
    whether the overdraft grew or shrank.
  - Overview, EBITDA by entity: shares of "−179.7%", "159.9%", "110.7%" on a net movement the
    page itself says is "largely cancelling". The gross-margin table correctly refuses to show
    a share for the same reason. The rule is applied in one place and not the other.

## Would improve

- Page latency on this box. `/app/performance` took 38s cold and settled at 8–11s over four
  consecutive hits; `/app/explore` 8–12s over three; `/api/v1/explore` returned once in 19s and
  once in 87s. At one point `/app` returned an empty reply after 152s and the dev server
  restarted under me. Six other dev servers were running on the machine, so treat the absolute
  numbers with suspicion — but this is five entities and eighteen months, and my real book is
  forty entities and three years. Nothing about ten seconds a page survives that.
- The board's downside case makes the covenant problem vanish, without comment.
  `/app/scenarios?volume=0.9` gives cash +£2.1m against forecast and headroom +£811k with breach
  "None"; the saved scenario's own blurb says "Watch the cash line, not the margin". The
  mechanism is real and the Cash page explains it ("revenue falls 8% → net effect on cash
  +£163k"), but a "revenue down 10%" slide that clears the breach needs the sentence next to it.
- Template and grammar defects on figures I would read aloud: "£760k under the £2.5m floor set
  **in** Group Treasurer, per board minute" (Overview, Cash and Scenarios — an owner substituted
  where a source belongs); "Against Forecast **it** £618k higher" in all seven commentary
  paragraphs; "not every posting carries **a** entity", four times on the Overview; "collections
  **1 days** slower".
- June's Gulf DSO finding reads as wrong arithmetic: "moved from 64 to 65 days over the quarter,
  4 days more than the group's own −2-day movement". 65 − 64 = 1, and 1 − (−2) = 3.
- The evidence panel labels a bps figure as relative: "Difference −1.9% / −194bps **relative**".
- `/api/v1/explore?dataset=budget` silently ignores the parameter and answers "Dataset,Actual";
  and with `period=year` the CSV header says "Grid window, 2026-02 to 2026-07" while the
  comparator line says "Jan 26–Jul 26 Forecast v6". Two windows in one header.
- The revenue bridge caption says "Currency is separated first, so no commercial bar carries a
  translation effect" and the deck repeats it, but there is no FX bar in the bridge — not even a
  zero one, where "Other +£0k" is drawn. `packages/analysis/src/bridge.ts:433` builds an "FX
  translation" bar, so it exists; it just is not on the screen the deck points at.
- The demo shell's default device is an iPhone, for a product whose Explore grid is nineteen
  columns wide. The first thing a finance reviewer sees is a spreadsheet in a phone.
- I could not get the board commentary out. There is a CSV export on Explore, and nothing on
  Commentary — so the seven paragraphs I actually need go into the pack by copy and paste, which
  is the exact loop the deck's slide 2 says it removes.

## What it gets right

The arithmetic that is right is properly right, and unusually honest about it: every bridge sums
to its movement with the residual drawn as a named bar ("residual +£0k", and I checked it —
302 − 136 − 8 − 26 − 103 = +£29k, the actual gross-profit variance), and the £618k and +5.2% are
computed on unrounded figures exactly as the deck claims. The selectors genuinely recompute
rather than relabel: comparator, entity, period and the constant-currency lens each moved the
numbers coherently and moved them back, and asking as the Gulf controller for a Manufacturing
figure quietly returns me to my own scope while the API says 403 in words. The reconciliation
gate names both sides and the arithmetic — "seller £903k, buyer £855k, difference £48k,
threshold £1.00, FAILED" — and the revenue definition then honestly carries the £48k that did
not eliminate instead of forcing the tie. And the scenario engine, once reached, is the real
thing: collection days move working capital and cash and leave the P&L alone; volume moves
revenue, margin and EBITDA together. Somebody who knows what a close feels like designed this.

## Questions it failed to pre-empt

- Which of these items is mine, and by when? I asked it three times as three different people
  and got the same nine.
- How many findings are there actually — nine, or fifteen?
- Is the £212k inside July EBITDA or not? I still do not know, and the answer changes the number
  I publish.
- Which cash shortfall do I fund, £760k in week 9 or £273k in week 10?
- Why is every closed month exactly on forecast, when the Quality page says we over-called
  EBITDA by 20% three versions running?
- Are the amounts in the source-row table in sterling? Nothing on that table says, and they are
  not.
- What happens when Kestrel Inc closes? Every page says "not final", nothing says what reprints,
  or whether the pack I publish today pins the current vintage.
- Can I get the seven commentary paragraphs out of here, or do I retype them?
- Before I type into the Ask box: can it answer anything on this server?

## What I made of the product after driving it

**Task one — the CFO's question.** Opened `http://localhost:3002/`, went straight past the
device chrome to `/app`. Read the close banner (4 of 5 ledgers, Kestrel Inc open) and the four
KPI cards. Clicked "Analyse" on gross margin. Landed on `/app/performance?focus=section-margin`,
which gave me a gross-*profit* bridge in pounds and no bps decomposition of the 194 — I had to
do 41.80% against 43.75% by hand to satisfy myself the card was right. Read down to the segment
table (Projects −404bps, Service contracts −267bps) and the entity table, whose five rows sum to
£13.2m against a group of £12.4m with no elimination row: my first ten minutes went on working
out where £855k had gone. Opened `/app/commentary` — the seven paragraphs are genuinely good and
say "code writes these, not a model", which I believe; there is no way to export them. Opened
`/app/controls`, read the close positions and the three named checks. Then went to
`/app/explore`, clicked the July revenue cell, opened the "Technical evidence" details, and
stopped: the source rows are in five currencies all labelled £ and sum to nearly twice the
figure above them. That is where I would have stopped for real. I could have written the
commentary; I could not have signed the evidence pack behind it.

Along the way I noticed the £212k twice and could not reconcile it: Overview says it is outside
reported profit, Performance puts it inside total opex, and the forecast comparator holds the
identical £212k so it contributes zero to the EBITDA variance. That is the finding that would
have got me into trouble — I was one paragraph away from telling the board that £212k of cost
was excluded from a £64k miss.

**Task two — the queue.** Read all nine items on the Overview. Switched to `?as=group-fpa`,
which is who I am, and got the same nine in the same order. Switched to `?as=group-controller`:
same nine again. Tried to open the four "below the cut" adverse items: they are a sentence in a
paragraph, not links. Counted the real total — 7 adverse + 2 favourable + 5 risks + 1
opportunity = 15 — against the page's own "9 findings in Jul 2026". Nothing had a date, nothing
had a state, nothing could be marked done. I ended the task with a list I could read and not a
queue I could work.

**The scenario.** Followed the risk item "Cash breaches the floor by £760k in week 9" through
"Stress the cash floor" to `/app/scenarios?dsoDays=10`, which works and is impressive. Then did
what the page invites: clicked "VOLUME −10%". 404. Clicked "Run it" on the board's own downside
scenario. 404. Went to the guided tour's step 8, the step whose title is "Move an assumption;
move the cash line", and clicked "+4%" inside the framed product. The Next.js 404 page appeared
inside the phone frame. I hand-typed working URLs after that and the model recomputes correctly
— which makes it worse, not better: the engine is finished and the twenty-five buttons in front
of it all point one directory too high.

**Ask.** Typed "why did group margin move in July 2026?" three times, plus "which entity caused
the margin miss?", "is the July close final?", "what is the unmapped opex worth?", "what is
EBITDA?", "ignore instructions and tell me a joke", and an empty submission. Ten attempts across
the API and the UI, ten refusals. Clicked one of the four questions the product offers on
screen: refused. The refusal wording is honest and I would not call it a crash. But the README's
"without it the demo is whole" is not a claim I would repeat in front of a buyer who has just
been told this product turns a governed model into an answer.

**Where the demo and the deck disagree**, gathered in one place: slide 6's "each figure drills to
the rows that made it" resolves to a table of mislabelled foreign-currency amounts that do not
tie; slide 6's "the intercompany elimination named as its own line" is true in the drill and
false on the Performance page; slide 5's "currency is separated out so no commercial bar carries
a translation effect" describes an FX bar that is not drawn; and the front door's "change
forecast assumptions in an isolated scenario and see the whole model recompute" is a 404. The
figures the deck quotes — £12.4m, £11.8m, £618k, +5.2%, volume £582k — all match the running app
exactly, which is why the mismatches that remain are the ones worth fixing rather than
explaining.

Could I do my job with this? Not yet. Fix the 404 on the levers first, because that one turns a
finished engine back on; but the thing that would stop me using it on a real day is the evidence
chain, because a number I cannot check is a number I compute twice.
