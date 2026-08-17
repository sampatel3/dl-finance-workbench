Verdict: no

The demo does not contradict the deck on the three surfaces the deck shows. I checked every figure
on slides 4, 5 and 6 against the running product and they reconcile to the penny. Where the demo
contradicts itself is worse in one specific place: **the Cash surface and the Scenarios surface give
two different answers for the same 13-week cash forecast, both labelled "the approved forecast", and
the demo's own click path takes you from one to the other.** That is finding 2 below and it is in my
driving notes.

## Blocking

- **Critical** — The Commentary surface — stop 9 of 12, and the one surface that proves the product
  can do the work the deck's problem slide is built on — produces ungrammatical English in every
  paragraph, and this is the state the demo ships in keyless. The README's claim that without a key
  "the demo is whole" is not true. I would have to see seven paragraphs a group financial controller
  could paste into a board pack unedited before I believed the deck's central claim that this
  removes the commentary rewrite.
  - Seven paragraphs, seven broken sentences: "Against Forecast it £618k higher", "Against Forecast
    it £588k higher", "Against Forecast it 194bps lower", "Against Forecast it £94k higher",
    "Against Forecast it £64k lower", "Against Forecast it £92k lower", "Against Forecast it £1.1m
    lower". The verb is missing from the template, not from one instance.
  - `web/lib/story.ts:159` — `` `Against ${against.label} it ${said(against.movement, against.unit)}` ``.
    Every period, every entity, every comparator inherits the defect.
  - The deck sells this exact page twice. Slide 2: "The pack, and the commentary explaining it.
    Written from scratch every month." The guided tour's own stop 9 calls it "A concise Board-ready
    statement". It is not board-ready; it is not sentence-ready.
  - Same class of defect in the Overview's entity notes: "not every posting carries **a** entity",
    printed under all four measures.

- **High** — Two surfaces state materially different 13-week cash forecasts for the same group, the
  same month and the same approved basis, and neither reconciles to the other. The product exists to
  stop exactly this. I would have to see one 13-week line, or both pages naming their opening
  balance and basis on the face of the table, before I would put this in front of a treasurer.
  - `/app/cash`: "Opening balance £4.8m … Week 9 closes at £1.7m, £760k under the £2.5m floor. Its
    low point is £1.3m in week 10." Funding panel: "£7.9m can arrive in time against a shortfall of
    £760k."
  - `/app/scenarios`, row labelled **"Approved forecast"**: "LOW POINT £2.2m · HEADROOM −£273k ·
    BREACH Week 10", and the decision card reads "The floor is breached in week 10 by £273k, and
    £8.8m can be reached in time."
  - I reached the second by clicking the first. The Overview raises "Cash breaches the floor by £760k
    in week 9" as a HIGH risk whose named action is "Stress the cash floor"; that link lands on the
    page that says £273k in week 10. The number I clicked from is nowhere on the page I arrived at.
  - The cause is a deliberate basis difference — `web/lib/scenario.ts:354` runs plan-against-plan off
    forecast cash (£5.9m) while the Cash surface runs off actual cash (£4.8m) — which makes it worse,
    not better: the code comment at line 419 asserts that "'fund it by week seven' on this page and
    on the cash page are the same claim", and the running product proves it is not.

- **High** — There is no user evidence of any kind, and I could not find a trace of one. Every input
  to this product is the vendor's own. That is the finding, not a caveat.
  - The source material named in `docs/review/00-source-review.md` is
    `DEEPLIGHT_Finance_Workbench_PRD_120826.docx` and `DEEPLIGHT_Finance_Transformation_AI_120826.pptx`
    — Deeplight's own PRD and Deeplight's own slides. The review's own words: "the findings are all
    about what neither says."
  - I grepped the entire `docs/` tree for interview, user research, design partner, pilot customer,
    "we asked", "spoke to". Zero hits.
  - The deck's credentials slide is two data-platform programmes (ADCB, EWEC) and 1,300+ models. None
    of it is this product, and none of it is a finance close. The deck offers no CFO who has seen
    this, no close it has been run against, and no number about what a close costs today.
  - I would have to see three named group CFOs or financial controllers who have driven this for
    twenty minutes each, with what they said, and at least one of them a person who then asked when
    they could have it. Absent that, everything in it is a hypothesis about a buyer, expressed very
    fluently.

- **High** — Only one month of the demo is alive, and the failure is silent. Every period other than
  July 2026 reads +0.0% against the default comparator, the MATERIAL flags disappear and the four
  decision boards empty out to "No headline movement cleared the materiality policy this period."
  The first thing a CFO does with a variance product is look at last month.
  - Driven, all on the default `vs Forecast v6`: Jun 26 revenue +0.0% / EBITDA +0.0% / cash +0.0%;
    May 26, Apr 26, Mar 26, Dec 25 all +0.0% / +0bps on all four measures. `/api/v1/measures?month=2026-06`
    returns `comparative` equal to `value` to the penny on three of the four measures.
  - The Explore grid prints the whole of it in one screen: six columns Feb–Jul 2026, and only the
    July column has a non-zero variance on any row.
  - The model can do better and the UI will not let you reach it. `packages/measures/src/comparator.ts`
    hardcodes `choice.versionId ?? 'v6'`; v4 and v5 exist with earlier `actualsThrough`, and
    `/app?month=2026-04&version=v4` gives a full live variance (−3.8% revenue, −326bps margin,
    −19.7% EBITDA). But the version picker exists only on `/app/forecast`, and the context bar on
    every other surface prints "Comparator: vs Forecast v6" with no way to change it.
  - I would have to see the comparator resolve to the forecast version that was in force when the
    period opened, or, failing that, the page say on its face why a variance is zero. A blank
    decision board with no explanation reads as a broken product, and in a demo it reads as one
    month of stagecraft.

- **High** — The deck says "The workbench is built" on the only slide that carries a schedule and a
  price, and never says what is not built. Everything missing sits inside the fixed twelve weeks and
  the US$185K.
  - Not built, on the evidence of the running product and its own copy: any ERP or consolidation
    connector (deck slide 7 puts these in weeks 9–11); persistence of any kind ("Nothing a visitor
    does persists on this tier", "this tier stores nothing"); the approval workflow the product
    repeatedly names — "the commentary workflow is draft, review, approve, publish, and this tier
    stores nothing"; authentication, since a persona is a URL parameter (`?as=gulf-controller`).
  - The problem slide's whole argument is "nothing above the ledger can read it in place". The part
    that reads the ledger in place is the part that does not exist.
  - I would have to see one slide, or one line on slide 7, that says plainly what exists today and
    what week 12 has to create. As it stands the reader prices a product and buys an integration
    project, and I would not sign that for a team of mine.

- **High** — Twelve surfaces is at least eight too many for what the case needs, and the extra ones
  are where the incoherences live. The argument gets stronger under the cut, which is the tell.
  - The case that lands is one spine: position → bridge → drill to rows, plus 13-week cash. That is
    four surfaces (Overview, Performance, Cash, Explore) and it is genuinely good.
  - I would cut KPIs, Year to Go, Capex & Procurement, People and Forecast Quality before funding it.
    Every one of them is another surface to keep coherent with the other eleven, and the two
    coherence breaks I found are both between surfaces I would have cut or between one of them and
    the spine. Scenarios I would keep only because the lever genuinely re-runs the generator — but it
    is also the source of finding 2.
  - The deck already knows this: it shows three surfaces and mentions twelve. If three carry the hour,
    the other nine are cost, not proof.

- **High** — Nothing anywhere says what this is worth, so there is no case against doing nothing.
  Doing nothing is what I would do.
  - The deck quantifies the problem as "twelve times a year, the same work" and stops. No days, no
    FTE, no cost of an argued figure, no cycle time. The one measurable thing on offer is a baseline
    that the buyer pays to have taken in week one — the engagement discovers whether the engagement
    was worth it.
  - What it competes with, and none of it is addressed: the spreadsheet (free, already trusted, no
    integration project); the group FP&A analyst who already writes the commentary in two days; and
    the incumbent, which is doing nothing for another quarter. The deck's own layer diagram concedes
    BI and planning are "already solved", which means the buyer already has a place to look at
    numbers.
  - I would have to see one number of the form "the July close took N days and M of them were spent
    reconstructing figures somebody already had", taken from a real finance function — and then this
    product's claim on N.

- **High** — Week seven, this becomes a thing someone opens when asked. I do not think it survives,
  and I want to be specific about why rather than gesture at novelty wearing off.
  - There is no write path. No approval, no publish, no persistence, by construction. So the close
    still happens in the existing tools and this is a second place to look, which is one more thing
    to reconcile rather than one fewer. Week-seven products that add a reconciliation die.
  - The one thing that removes work is the commentary, and the commentary does not produce publishable
    prose (finding 1).
  - The demo's coherence is calibrated on one month with one planted set of conditions — two unmapped
    codes, one restatement, one intercompany break, one three-month subcontract run. In week seven
    the data has grown and the conditions are different ones, and I have no evidence the product
    handles a month where nothing interesting happened other than by going blank (finding 4).
  - What would have to be true for it to still be in use: the commentary is good enough to publish
    from, the approval and publish steps exist so the pack is produced here rather than copied out of
    here, and the comparator behaves on any month a user picks.

## Would improve

- The Explore grid and the segment table label percentage-point differences as if they were relative
  changes. `/app/performance` prints Equipment margin ACTUAL 35.8%, COMPARATIVE 36.2%, VARIANCE
  −0.3%, RELATIVE −32bps — the VARIANCE and RELATIVE columns are the same quantity in two units, and
  neither is the relative change. A CFO reads "−0.3%" beside a 35.8% margin as a relative decline.
- The Ask panel announces "Answer ready." in the live region and then renders "The answer service is
  not running here, so nothing could be looked up." Two statements, opposite meanings, same moment.
- The AI usage log on a keyless server attributes seeded narrations to `claude-opus-5` with outputs
  and human dispositions. One row correctly says `no-model:deterministic-template`. On a page whose
  purpose is an append-only record of what a model actually did, the mixture invites the wrong
  question at the wrong moment.
- The repo states its own demo-kit pin as `cc844bf6e94…` in two places; `git ls-tree HEAD
  vendor/demo-kit` says `e2da3bb98…`; the most recent commit message says it moved to `6506c84`.
  Three SHAs for one pointer, verifiable in one command. Slide 7 sells "model documentation, control
  mapping … produced by the build rather than written up afterwards", and this is the one piece of
  documentation I could check.
- The server became unresponsive for stretches of two to four minutes while I was driving it, on
  `/api/health` as well as on app routes. I could not attribute this cleanly — it is a dev-mode
  server and I could see another reviewer's browser process hitting it at the same time — so I am not
  counting it as a defect. It is worth knowing that two concurrent drivers were enough to produce it,
  and that nothing in the deck or the product says what a scenario costs to compute.

## What it gets right

The measure layer is real engineering, not a stage set. Entity, period, comparator and currency lens
propagate through every navigation as URL state and genuinely recompute — I changed each one and the
numbers moved coherently, including a scenario lever that pushed the cash breach from week 10 to week
2. Every row is computed at its own level and the product says so, refuses to make ratios additive,
names a residual instead of hiding it, and shows an elimination line rather than forcing parts to sum
— the drill on deck slide 6 is exactly what the app produces, to the penny. The Quality & Controls
surface, the four-way partition of findings by direction and horizon, and the refusal to fake a sent
email or a posted journal are all better product judgement than most funded products have.

## Questions it failed to pre-empt

- Who has used this, and what did they say? Nothing in the deck or the repo answers it.
- What does a month-end cost today, in days or in pounds? The deck asserts the pain and never sizes it.
- What is built and what is not? I had to derive the answer from the product's own disclaimers.
- Why is every month except July flat against the forecast? The product prints +0.0% and an empty
  decision board and offers no explanation on the page.
- Which 13-week cash forecast is the real one — week 9 at £760k, or week 10 at £273k?
- What is the second month of a real deployment like, when the planted conditions are different ones?
- What is the smallest version of this? Twelve surfaces is an answer to a question nobody asked.
- What happens when a controller disagrees with a figure? There is no write path, so where does the
  disagreement go?

## What I made of the product after driving it

Roughly two hours, one headless Chromium, twenty-five probe scripts, plus direct calls to the three
JSON endpoints.

What I drove. The shell at `/` (defaults to an iPhone frame at 90% — I switched to desktop). The
guided tour at stops 0, 1, 2, 4, 8, 9 and 12, checking the narration against the surface inside the
iframe each time; the narration is unusually good and stop 9's "concise Board-ready statement" is the
one that does not survive contact. Free mode. All twelve app surfaces. The deck at `/deck.html`: 13
sections, 10 folios, no `[[ placeholders ]]`, no failed requests, and all three live embeds loaded
their real routes at 1194×834 — the deck is showable and its live frames work.

The recompute test, nine variations. `month=2026-06` (£13.9m, all variances zero), back to July
(identical to the first read — deterministic), `entity=gulf` (£2.7m, +5.9%, entity share correctly
100%), `comparator=prior_year` (+6.8%, and the contribution table correctly switched from BY ENTITY
to BY SEGMENT), `comparator=budget` (+6.6%), `comparator=trend` (−9.2%, and correctly labelled "an
expectation, not an approved plan" and excluded from materiality), `lens=constant` (revenue £12.4m →
£12.5m, and only the currency-sensitive figures moved), `period=ytd` (£90.2m, +0.7%),
`as=gulf-controller` (role and scope both narrowed together). All of it moved, all of it moved
coherently, and setting a context then walking the nav preserved it. This is the best part of the
product and it is not fake.

Then I went backwards in time and the product went quiet. June, May, April, March and December 2025
all read +0.0% on revenue, EBITDA and cash against the default comparator, and the four decision
boards collapse to "No headline movement cleared the materiality policy this period". The Explore
grid shows six months side by side and only July has a variance in it. `?version=v4` on April brings
the whole product back to life — so the data is there, and the UI will not let a mouse reach it.

The Ask panel, four times — three typed questions plus one repeat, and five more times through
`POST /api/ask`. Nine attempts, nine identical refusals: "The answer service is not running here, so
nothing could be looked up." It is an honest refusal and I will not mark a fallback as a crash. But
on the attempt where I typed the deck's own example question, the live region said "Answer ready."
above a body that said nothing could be looked up.

The Commentary page is where I stopped giving the demo the benefit of the doubt. Seven paragraphs, and
every one of them contains a sentence that is not English: "Against Forecast it £618k higher". This
is the code-written commentary the README calls whole, on the surface that carries the deck's central
promise, at stop 9 of 12.

Then the click path that decided it. From the Overview I clicked the HIGH risk "Cash breaches the
floor by £760k in week 9" — its named action, "Stress the cash floor" — and landed on Scenarios,
where the row labelled "Approved forecast" says the low point is £2.2m, the headroom −£273k and the
breach week 10. I went to `/app/cash` to check which was right: £4.8m opening, week 9 at £1.7m, £760k
under, low point £1.3m in week 10, £7.9m available. Scenarios says £8.8m available against £273k in
week 10. Both pages describe the group's 13-week direct cash forecast on the approved basis. Neither
mentions the other. The scenario lever itself works properly — dsoDays +10 moved the breach to week 2
and the low point to −£248k — so the machinery is sound and the labelling is what is wrong. For a
product whose entire pitch is that a figure means one thing everywhere, being handed two answers by
following its own link is the finding I would have led with if the commentary had been publishable.
