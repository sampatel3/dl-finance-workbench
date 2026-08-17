Verdict: no

I am the group FP&A lead. My month is: work the exception queue after close, explain the
misses to the CFO, take the cash trough to the treasurer, and get the board narrative
approved. I tried all four of those in here. I could do the *reading* part of every one of
them better than I do it today. I could not finish a single one, and on two of them the
product handed me two different numbers and no way to choose.

## Blocking

- **Critical** — The deck's flagship "running live" slide shows a different EBITDA and a
  different cash variance from the running product. Same month, same entity, same
  comparator, same screen.
  - `web/public/deck.html` slide 4 ("Every figure on this screen opens into the working
    behind it") carries `shots/july-position.jpg`. That image reads **EBITDA £2.1m, −3.0%
    vs Jul 26 Forecast v6** and **CASH £4.8m, −18.4% vs Jul 26 Forecast v6**, both badged
    MATERIAL. Its alt text repeats those figures.
  - `http://localhost:3002/app` right now reads **EBITDA £2.1m, −11.6%** and **Cash £4.8m,
    −20.4%** against the same named comparator. `/api/v1/measures` agrees: ebitda
    comparative `237153157`, movement `−0.1164`; cash comparative `601998847`, movement
    `−0.2035`.
  - The variance on the group's profit line is out by a factor of four between the artefact
    the buyer is shown and the product they are shown it on. The slide's live iframe
    (`/app?view=inner&focus=section-headline`) renders the current figure, so in the same
    deck the number changes depending on whether the embed loads — and a PDF export bakes
    in the stale one. The image was regenerated today (13:58) while the other shots date
    from 15 Aug, so this is a partial re-shoot, not an old deck.
  - The deck earns the right to be picked apart here: slide 6 says "nothing is rounded
    before it is compared". I would have to see the deck and the app agree on all four
    headline figures before I would put this in front of anyone.

- **Critical** — The product's own high-priority cash finding is contradicted by the page it
  sends you to in order to act on it.
  - `/app` finding: *"Cash breaches the floor by £760k in week 9 — high. The 13-week
    forecast first breaches the floor in week 9, closing at £1.7m, £760k under the £2.5m
    floor set in Group Treasurer, per board minute. Its low point is £1.3m in week 10."*
    Its action link is "Stress the cash floor" → `/app/scenarios?focus=section-headroom`.
  - `/app/cash` agrees: four weeks below the floor (9, 10, 11, 12), worst −£1.2m in week 10,
    with per-week stream breakdowns and a named funding route.
  - `/app/scenarios`, nothing moved, row **"Approved forecast"**: **Low point £2.6m,
    Headroom +£142k, Breach None.** Same £2.5m floor, same board minute quoted verbatim,
    same thirteen weeks, same month. Reproduced four times, and across two server restarts.
  - The cause is that `/app/cash` builds the direct forecast from the actual position
    (opening £4.8m) and `/app/scenarios` builds it from the forecast position — but neither
    page says so, neither names its opening balance next to the other's, and both call the
    result "the 13-week forecast against the board's floor". I cannot send the treasurer a
    £760k funding request from a product that also tells me the floor holds.
  - I would need one cash horizon, or two that name their basis and reconcile to each other
    on the page.

- **Critical** — The decision queue is not complete against the product's own materiality
  policy, and it miscounts itself.
  - `/app` states: *"9 findings in Jul 2026: 3 adverse, 2 favourable, 3 risks and 1
    opportunity."* Twenty lines below, the same page states *"3 of 7 shown, ranked by
    priority. 4 below the cut"* on the adverse board and *"3 of 5 shown … 2 below the cut"*
    on risks. There are 15 findings, not 9. The nav badge says 9. The headline sentence is
    also the one recorded in the AI usage log as `ai:brief:overview:2026-07`.
  - Worse, EBITDA is nowhere in the queue at all. The headline tile flags EBITDA
    **material** at **−11.6% (−£276k)** against a policy of "£50k and 2.0%". No adverse
    finding, no risk, not even below the cut. Cost of sales is **+£588k / +8.9%** over
    forecast (`/app/commentary`) — also absent. `packages/analysis/src/detectors.ts` has
    twelve detectors; `revenue_ahead_of_forecast` catches the good news and
    `segment_margin_behind_forecast` catches a segment, but nothing catches the group's
    headline profit miss.
  - So the queue shows me the £618k revenue beat and hides the £276k EBITDA miss. If I work
    this queue and only this queue, I walk into the CFO's office having explained everything
    except the thing she will ask about. That is the exact failure mode a "what needs a
    decision" surface exists to prevent.

- **High** — Nothing in the product can be done. It is a viewer.
  - `grep -c '<button'` returns **0** on `/app/commentary`, `/app/performance` and every
    other surface. Across `web/app/app/**` and `web/components/**` there is exactly one
    `<form>`/`<button>`/`onClick` in the whole product, and it is the Ask box. Three client
    components exist: `Ask`, `FocusOnLoad`, `ActiveNavScroll`.
  - The commentary workflow does compute the right affordances per role and state — I
    checked all four personas against all five states and the matrix is correct — but they
    render as non-clickable `<span>`s with the note *"Preview only · this deterministic demo
    does not persist workflow changes."* I cannot submit, approve, reject, publish or revise
    anything.
  - Each of the nine findings ends in a page that names a number and an owner and offers me
    no next step: the £48k intercompany break shows £903k vs £855k in aggregate but never
    names the counterparty pair or the missing row; the £212k unmapped register lists two
    account codes with no way to propose a mapping; the scenario I build is "an unsaved
    link"; the funding transfer is a sentence. Every one of the nine ends with me in Outlook
    or Excel. On the question I was asked — could I do my job with this — the honest answer
    is that I would do the reading here and all of the work somewhere else.

- **High** — Stop 12 of 12 does nothing, and the README says otherwise.
  - `README.md:27` — *"Without it the demo is whole."* It is not whole. I posted **36
    questions** to `/api/ask` across twelve prompts, three times each — the four suggestion
    chips verbatim, plus real ones ("Why is gross margin down 194bps?", "How much is
    unmapped and who owns it?", "What is the intercompany break?") — and got
    `kind: unavailable, failure: no_client` **36 times out of 36**. Empty and whitespace
    questions 400. There is no distribution; there is one answer.
  - The four suggestion chips on `/app/explore` are therefore dead controls: they fill the
    box, submit, and fail. The surface above them promises *"The question inherits the
    selected role, organisational scope, period, comparator, currency basis and forecast
    version. Every returned figure links back to governed evidence; unsupported or
    unauthorised questions are refused."* None of that is demonstrable here, and the
    landing page sells "Explore & Ask" as the twelfth and deepest stop.
  - The refusal copy itself is honest and well written. That is not the problem. The problem
    is that a demo in this state cannot show the one capability that distinguishes it from a
    BI dashboard, and the README tells the person setting it up that it can.

- **High** — Two server processes from the same repo gave me materially different numbers for
  the same URLs. Whatever this is, it means the demo is not reproducible.
  - I was handed a warm instance. On it, `/api/v1/explore?rows=measure&cols=period` returned
    `Comparator, Feb 26 Forecast v6` with Feb–May actual and forecast **byte-identical**
    (revenue `1247083317` vs `1247083317`, +0.0% across every measure for four straight
    months), July EBITDA comparative `215953157` (−3.0%) and July cash comparative
    `587815257` (−18.4%).
  - I restarted `pnpm --filter web dev` from the same working tree. The same URL now returns
    `Comparator, "Feb 26 Forecast v4 — the version in force at close, because v6 already
    held this period as actual"`, Feb variance −3.8%, July EBITDA comparative `237153157`
    (−11.6%) and July cash comparative `601998847` (−20.4%). `/app/scenarios` flipped from
    "breach Week 10, headroom −£273k" to "Breach None, headroom +£142k". Actuals were
    identical throughout; only comparatives moved.
  - The newer behaviour is plainly the better one. The point is that the instance a reviewer
    (or a buyer) is pointed at can be several material figures away from the repo, silently,
    with no version marker anywhere on screen — `/api/health` reports `"commit":"dev"`. The
    landing page's claim *"The figures are deterministic"* is only true within a process.
  - I would need the running instance to name its build on screen, and a check that fails
    when the deck's shots and the app disagree.

- **High** — The 13-week cash forecast does not carry the capital commitments that the
  Capex page says are behind it, and the floor-breach analysis rests on that line.
  - `/app/capital`: *"What lands in the next thirteen weeks — the same horizon the cash
    surface uses, so a commitment shows up before the invoice does rather than after. Every
    one of these is money already agreed."* Six dated orders totalling **£1.26m**: £96k
    week 2, £61k week 3, £295k week 4, £142k week 5, **£486k week 6**, £180k week 11.
  - `/app/cash`, every week of the horizon: **Capital spend −£75k, "every week"** — a flat
    run rate, £975k over thirteen weeks, £285k short of the committed book and in the wrong
    weeks. Week 6 carries £75k where £486k is contracted.
  - The capital page's closing sentence tries to have it both ways: *"The cash surface's
    weekly line carries the ordinary capital run rate; these are the specific orders behind
    it."* They cannot both be true. As treasurer I would be £411k worse off in week 6 than
    the page that raised the funding decision says.

- **High** — The scenario funding decision is sized to the wrong week, and the page's own
  note says so.
  - `/app/scenarios?dsoDays=10`, six lines apart: the decision card says *"Fund the trough
    from group balances — The floor is breached in week 2 by £528k, and £6.4m can be reached
    in time"*, and the headroom table says *"Scenario — Low point £167k, Headroom −£2.3m,
    Breach Week 2."*
  - `web/lib/scenario.ts:420` sizes the funding plan from `breach.shortfall` (the first
    breaching week) while `:400` measures headroom from `low.amount` (the trough). The
    surface's own note says *"Headroom is measured at the horizon's low point rather than at
    its close, because a forecast that ends comfortably and dips in week nine still needs
    funding in week nine."* The card ignores that rule. Funding £528k against a £2.3m
    trough leaves the group £1.8m under the floor with a decision recorded as taken.

- **Low** — Two of the five period options are dead. `?period=year` and `?period=ytd` return
  the identical window (2026-01→2026-07), the identical label ("FY26 YTD to Jul 26") and the
  identical figures. `?period=quarter` and `?period=half_year` both return July alone, the
  same figures as `?period=month`. Four of the five chips produce two distinct results, and I
  clicked all of them before working that out.

- **Low** — The same consolidation fact is presented three ways and two of them omit the
  reconciling line. `/app/performance` "Revenue by entity" lists the group at £12.4m over
  five entities summing to **£13.23m** with no elimination row and no note; the entity grid
  at `/app/explore?rows=entity` shows the five entities with no group total, no elimination,
  and a "Window" column of dashes. The cell drill gets it exactly right — five entities plus
  *"Intercompany eliminated −£855k"* and *"These parts sum to the cell exactly"* — which is
  what makes the other two look like mistakes rather than choices.

- **Low** — The KPI scorecard silently ignores the comparator I selected. The chrome says
  "Comparator: vs Forecast v6"; the scorecard's movement column is hard-wired to the prior
  period, so **Cash reads "↑ +253.6%"** on the page called Key Performance Indicators while
  the headline tile two clicks away reads −20.4% and the cash surface says the floor breaks
  in four of thirteen weeks. Disclosed in a sentence above the table; not survivable at a
  glance, which is how a scorecard is read.

- **Low** — The AI usage log shows four rows attributed to `claude-opus-5` on a server where
  no model has run, alongside one correctly marked `no-model:deterministic-template`.
  Nothing on the surface marks the four as seeded. On the one page whose entire job is to
  say truthfully what the model did, that is the wrong place to be ambiguous.

## Would improve

- The front door defaults to `mode=guided&device=iphone` — a 402pt phone frame around a
  workbench whose tables run to nine columns. The first thing a CFO sees is their P&L in a
  handset. Desktop is one click away and should be the default.
- The intercompany break stops one level short of useful. £903k against £855k tells me there
  is a break; it does not tell me which counterparty pair or which document. That last hop
  is the entire job.
- The most alarming number in the product is buried. Forecast quality reports EBITDA
  **+20.0% mean over-call across three versions** and **value added −328.5% against
  "same month last year"** — i.e. the forecast process is worse than a naive baseline. That
  belongs on the Overview, not on a sub-tab of Quality & Controls, and its finding sits
  "below the cut" underneath a 9.6% subcontract miss.
- As Business-unit controller the whole Commentary surface is empty ("No commentary is
  visible in this scope"). The refusal is correct and well explained, but it means the
  daily-user story only exists for group roles — and the business-unit controller is the
  persona with the largest real-world queue.
- "All 1 findings shown."
- The three dated actions on Year to Go ("Take a fixed-cost reduction to the board", "Freeze
  recruitment outside delivery roles") never appear in the Overview queue, which claims each
  finding has "exactly one home".

## What it gets right

- The evidence chain is the best thing here and it is not close. Opening the £12.4m cell
  gives five entities plus the named −£855k elimination that ties exactly, then the formula,
  then the stored value in minor units (`1,234,522,034`), then eleven source rows in local
  currency (AED 10.4m, $169k) each carrying its load vintage. I could defend that in front of
  an auditor, which is more than I can say for my current pack.
- The CSV export is a real artefact, not a screenshot escape hatch: raw minor units beside
  formatted values, comparator basis, formula, definition owner, definition state and
  contributing vintages on every row.
- Permissions are enforced at the API, not just the UI — `?as=gulf-controller&entity=group`
  returns 403 with a named refusal on both `/api/v1/measures` and the CSV route.
- The cash surface distinguishing timing from structural breaches by *recovery inside the
  horizon* rather than by size, and the "this week only" vs "every week" marking on streams,
  is the sharpest piece of finance thinking in the product.
- The prose refuses to flatter itself in several places it easily could have — "a
  reconciliation that always balances is one that has stopped being a check", the naive
  baseline, "no message is sent". Most demos would have shipped a fake Send button.

## Questions it failed to pre-empt

- Which build am I looking at? There is no version, commit or data-as-at marker anywhere on
  screen, and `/api/health` says `"commit":"dev"`. I only found out my instance was stale by
  restarting the server on a hunch.
- Which cash horizon do I act on — the one on Cash or the one on Scenarios? Neither page
  mentions the other, and neither states its opening basis.
- Why is EBITDA not in the queue when the tile above the queue flags it material? And is "9
  items" nine, or nine of fifteen?
- What do I actually *do* here? Not one page tells me that the product is read-only until I
  have drilled into a commentary card and read the small print under a greyed label.
- Does anything I change persist? The scenario page answers this well; nothing else does.
- Who has to give me an API key, and what breaks without one? The README says nothing
  breaks. A quarter of the twelve stops does.

## What I made of the product after driving it

I walked it the way I would on a Monday after close. Landing page → Overview → the four
headline tiles → Analyse on gross margin → Performance → Commentary & evidence on Projects →
the drivers → the source rows → back to the queue → the £212k unmapped → Controls → the £48k
intercompany check → Cash → the week-9 breach → "Stress the cash floor" → Scenarios → moved
the collections lever → Year to Go → Forecast → Quality → KPIs → People → Capex →
Explore → the cell drill → the CSV → Ask.

What worked. The evidence chain, every time, on every measure I tried. The role switch
(four personas, five states, every combination correct, including the empty-scope refusal).
The permission 403s on both APIs. The scenario levers genuinely recompute — collections +10
days moved the low point from £2.6m to £167k and produced two dated decisions with owners,
which is real machinery and not a lookup table. The bridges reconcile to £0k residual on all
three. The CSV is a working artefact. Roughly 120 page fetches; after a clean restart every
page rendered in about a second.

What did not. Ask: 36 posts, 36 refusals, and the four chips are dead. Commentary: zero
buttons, eight cards, every affordance a label. The cash contradiction, which I hit exactly
where a user hits it — by clicking the app's own "Stress the cash floor" link from a
finding that says £760k in week 9, and landing on a table that says the floor holds. The
queue that says nine and means fifteen, and that never mentions the £276k EBITDA miss its
own headline flags as material. The period chips, four of which produce two answers. And
the crash: after about 200 sequential page requests the original server stopped answering
entirely (empty replies, then connection refused) and had to be restarted — which is how I
discovered that the instance I had been reviewing for an hour was several material figures
away from the repo.

Where the demo disagreed with the deck. Slide 4's screenshot, shot today, says EBITDA
−3.0% and cash −18.4%. The app says −11.6% and −20.4%. Slide 6's claims about the drill —
five entities, the elimination named as its own line at −£855k, the parts summing exactly —
are all honoured, and I checked each one. It is the numbers on the flagship slide, not the
architecture, that the running product no longer supports.

The first thing that would have to change before I used this on a real day: make the two
cash horizons agree, or make each one name its basis on the page and reconcile to the
other. Second: put EBITDA in the queue and make the count match the boards. Everything else
I could live with for a month. Those two I could not live with for a morning, because they
are the two places where the product would have made me say something wrong out loud.
