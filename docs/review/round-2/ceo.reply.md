Verdict: no

The headline, said plainly and first: **the deck says "The workbench is built" and "Twelve weeks from your ledgers to a close run on it," and the running product cannot read a ledger.** There is no connector, no upload, no database, no identity, no persistence anywhere in the repository — and the product nonetheless shows a Sources table naming four live ERP feeds with ingestion mechanisms and load timestamps. That is the demo and the deck disagreeing about what exists.

My second reason for a no is cheaper to fix than the product and is invisible from inside: **the ask is wrong.** I drove this for two hours and I still cannot write the sentence "I am approving X for Y." The deck asks for an hour, tags a US$185K engagement as "this deck", and spends seven slides selling a twelve-week programme, and it names no revenue of any kind after week 12.

## Blocking

- **Critical** — The deck claims a built product that can be on a customer's ledgers in twelve weeks. What exists is a presentation and computation layer over a synthetic generator, and the product overstates its own connectivity.
  - `web/package.json` declares `next`, `react`, `@anthropic-ai/sdk` and workspace packages. No database driver, no HTTP client for a source system, no file upload, no auth provider, no queue. `/api/health` returns `"tier":"memory"` — nothing is persisted between requests.
  - Every figure in the demo derives from a 2,200-line deterministic seed (`packages/model/src/seed.ts`).
  - `/app/controls` presents a "Sources" table: `SAP S/4HANA — UK ledgers · gl · universal journal cds · 2026-08-04 03:12 UTC · accepted with exceptions`, plus Oracle Fusion via "bi cloud connector", D365 F&O via "lake link", NetSuite via "rest api". None of those four ingestions exists in code. The same page is scrupulous about a smaller claim — "No message is sent. This demo dials no mail server and holds no mailbox... a demo that appeared to send email would be making a claim about a system nobody has built" — and then makes exactly that claim about four ERP integrations without the disclaimer.
  - What I would have to see instead: the deck stating what is built and what is not, and a costed plan for ingestion, persistence, identity and tenancy. That work is 100% of what a customer needs and 0% of what is quoted. Four ERPs plus consolidation plus permissions plus audit controls plus training, at a first customer, for a US$185K fixed price in twelve weeks, is not a number I would defend.

- **Critical** — Every interactive control on three of the twelve surfaces is a dead link, including the one control the guided tour instructs a viewer to click.
  - `/app/scenarios`: all 25 assumption-step links point at `/scenarios?volume=0.9`, `/scenarios?dsoDays=10` and so on. `curl` confirms `/scenarios` and `/scenarios?volume=0.9` both return **404**; `/app/scenarios?volume=0.9` returns 200. Every lever on the surface is unusable by clicking.
  - `/app/commentary`: the six approval-state chips — All, Draft, In review, Approved, Published, Rejected — point at `/commentary?state=approved` etc. `/commentary?state=approved` → **404**; `/app/commentary?state=approved` → 200.
  - `/app/forecast`: the three version-comparison chips (Forecast v4 / v5 / v7) point at `/forecast?from=v5`. **404**. `/app/forecast?from=v5` → 200.
  - Guided tour step 8 is titled "Move an assumption; move the cash line" and embeds `/app/scenarios?view=inner&focus=section-effect&dsoDays=10` in the device frame. Every lever inside that iframe resolves to `/scenarios?view=inner&focus=section-effect&dsoDays=10&price=1.02`. A prospect who does the one thing the tour tells them to do gets a Next.js 404 inside the phone.
  - The scenarios page prints, as its own governance record: "The audit record for a scenario on this tier is its address: `/scenarios?volume=0.9&subcontractRate=1.04`". That address 404s. A governance product whose stated audit record is a dead link is saying something untrue on the surface whose whole subject is defensibility.
  - This is critical rather than cosmetic because the computation behind the broken door is the best thing in the product. Reached by hand-editing the URL, `/app/scenarios?volume=0.9&subcontractRate=1.04` recomputes properly (revenue £11.8m → £10.6m, cash and working capital moving with it) and the "Against precedent" panel says "0.851 is below anything any stored version has assumed — the lowest is 0.938 in Budget FY26" and refuses to print a probability from five versions. The single most saleable idea here is the one nobody clicking can reach.
  - Source of the fault, so it is not mistaken for an environment problem: `web/lib/scenario.ts:596`, `web/lib/commentary.ts:209` and `web/app/app/forecast/page.tsx:79` each return a bare logical path instead of routing through `productPath()` (`web/lib/world.ts:539`), which is the one function that mounts the product at `/app`. `web/lib/permissions.test.ts:163` asserts the broken form, so the test suite pins the bug in place.

- **High** — I cannot say back in one sentence what I am approving, because the deck asks for three different things and completes the price of none of them.
  - Slide 10, headed "The Ask": "Bring us one problem... an hour with whoever owns it, and a written verdict."
  - Slide 9 tags Accelerate "This deck" at "From US$185K · one workflow, live".
  - Slide 7: "Twelve weeks from your ledgers to a close run on it."
  - There is no total price, no scope boundary on the word "from", and — the part that decides my answer — **no revenue line of any kind after week 12**. No licence, no subscription, no per-seat, no hosting, no support, no renewal. A twelve-surface governed platform is handed over inside a one-off services fee.
  - What I would have to see: one ask, one price, and the year-two invoice.

- **High** — On the deck's own two promises the ceiling is roughly nothing, and the deck never states a market.
  - "From US$185K" fixed price, and "The same four from the first conversation to a live close. Nothing handed over a wall." Four C-level founders on a twelve-week fixed-price build is at best break-even on cost, and it caps throughput at what four people can run concurrently — realistically four to eight engagements a year, on the order of US$0.7–1.5m of revenue, with the entire executive team fully consumed and nobody left to sell the next one. The non-scalability is not an oversight in the deck; it is printed as a feature.
  - Nowhere does the deck say who buys this, how many of them there are, what they pay recurring, or what the company looks like if it wins.
  - What I would have to see: buyer population and count, recurring price, gross margin per customer, and a delivery model that is not the four people on slide 8.

- **High** — The slide headed "Why Now" does not answer why now.
  - Its title is "Keep the accounting system. The gap is the layer above it." That is where the gap is, not what changed. The only temporal claim on the slide is "can now take on", asserted and unevidenced.
  - Everything demonstrated — deterministic consolidation, variance bridges, a versioned materiality policy, an evidence chain to source rows, vintage-based restatement — was buildable in 2015 and would have been equally sensible then.
  - The one thing that genuinely is new, a language model phrasing bounded commentary, appears nowhere in the deck. The product logs it ("Authored by model · Model claude-opus-5 · Prompt commentary-headline-v1") and the deck does not mention AI once.
  - What I would have to see: one specific thing that became true in the last eighteen months and was not true before.

- **High** — The demo's flagship screens carry visible copy and formatting defects, and the deck's own hero screenshot carries one of them.
  - "...and not every posting carries **a entity**." Three times on `/app`, and legible in body text in `web/public/shots/july-position.jpg` — the image printed on deck slide 4, the slide headed "Every figure on this screen opens into the working behind it."
  - Currency formatting collapses below roughly £10k. On `/app`, the EBITDA-by-entity table reads `£115k`, `−£102k`, `−£71k`, then **`−£5,886.36`**. On `/app/commentary`, capital spend moves **`+£366.31`**. On `/app/performance` and in the `/app/controls` GL-code table, **`+£0.00`** and **`£0.00`**. In the evidence panel the deck calls "the same object as the answer": `+£335k`, `+£240k`, **`+£6,491.34`**, **`+£9,749.37`**, **`+£2,613.60`**, **`+£172.92`**, **`−£45.23`**.
  - The seven-paragraph board narrative on `/app/commentary` — the artefact the entire pitch is about — is missing a verb in **every** paragraph: "Against Forecast it £618k higher", "it £588k higher", "it 194bps lower", "it £94k higher", "it £64k lower", "it £92k lower", "it £1.1m lower". The page's own footnote says "this reads like a controller rather than a writer, which is the right trade". It does not read like a controller. It reads unfinished.
  - "the £2.5m floor **set in** Group Treasurer, per board minute" — a broken template, on `/app`, `/app/cash` and `/app/scenarios`.
  - "10 consolidated line **s**", "6 governed measure **s**", "2 unmapped account **s**".
  - The Ask input is unedited kit-template copy: placeholder "Ask about **a site**, a month, or a comparison" — this group has legal entities, not sites — with the aria-label "Ask a question about **this demo**". `web/components/Ask.tsx:81-82` is byte-identical to `vendor/demo-kit/template/web/components/Ask.tsx:71-72`.
  - Why this blocks rather than irritates: the product's whole claim is that a figure is defensible because you can read what produced it. A group financial controller who finds a penny-precise number sitting in a £k column and a missing verb in the board paragraph stops trusting the arithmetic, and stops for a good reason. I would not put this in front of a CFO in this state.

- **High** — Named-client metrics with no visible consent and no source, on a slide I would personally have to defend.
  - "ADCB · tier-1 UAE bank... Analytical processing 72h to 15min · data quality 67% to 95% · 2,000+ users on self-service"; "EWEC · national energy buyer"; "1,300+ models... under the UAE central bank (CBUAE) and inside ADGM under its regulator."
  - What I would have to see before this deck leaves the building: written sign-off from each named institution for the use of its name and each figure, and a defensible source for the 1,300 count and the 67%→95% figure.

- **High** — Nobody outside this building has said yes, and the demo itself shows who will have questions.
  - The **external auditor**. Deck weeks 4–8 promise a back-test "against closes your controllers already stood behind — naming where it reproduces them and where it does not." No tolerance, no remedy, and no statement of whose number wins when the workbench disagrees with a signed account. That is the single largest uncosted obligation in the deck.
  - The **group financial controller**, whose team's monthly work this displaces and whom the deck simultaneously casts as owner of the materiality policy and the mapping set.
  - The **CIO/CISO**, who must approve read access from SAP, Oracle Fusion, D365 and NetSuite into a third-party layer. Nothing in the deck or product addresses security posture, certification or hosting.
  - **Legal/DPO**: a DIFC-based vendor holding a UK plc's general ledger. Data residency and transfer basis appear nowhere.
  - What I would have to see: for each of these four, the specific question they will ask and the answer, in the deck.

- **Low** — Provenance is claimed on the title slide and is not on it. The deck's own source comment states "Provenance is said once, on the title slide" and "The group is synthetic and every figure derives from one fixed seed." Slide 1's visible text says neither; its foot carries Deeplight's credentials instead. "Kestrel Industrial Group plc · £12.4m" then appears on slides 4, 5 and 6, and the word "synthetic" reaches the reader only in slide 3's footer. A skim-reader can take Kestrel for a reference customer, and that is a mistake I would be the one correcting in a room.

## Would improve

- The Explore grid shows Forecast identical to Actual with "+0.0%" variance for four consecutive months (Feb–May 2026), with nothing on the surface explaining it. It is correct by construction — a forecast version carries actuals up to its `actualsThrough` month (`packages/model/src/seed.ts:1628`) — but to a CFO it reads as fabricated data, and it means the entire variance story in the demo rests on one month. Say it on the grid.
- `/app` states "Until they are mapped that value is outside the reported profit and loss" about £212k, while `/app/performance` lists "Unmapped operating expense £212k" inside "Total operating expense £3.1m". Both cannot be true of the same £212k.
- On `/app/commentary`, the Price driver and the Mix driver carry the identical explanation — "Operational factor moved from £721.26 to £721.45" — with opposite signs. A reader asking what caused mix is told what caused price.
- On `/app?as=gulf-controller&entity=manufacturing` the refusal is handled well and then over-narrated: "Access refused for Business-unit controller..." followed by "Part of this address could not be read, so a default was used." Nothing in the address was unreadable; the entity was refused.
- The commentary provenance panel reads "Authored by model · Model claude-opus-5" on a server where no model is running. It is hardcoded seed data (`packages/model/src/approvals.ts:244-245`) and would read identically with a key. For the one product whose selling point is provenance, a provenance record indistinguishable from a fixture is the wrong thing to be relaxed about — a buyer will ask to see one generated live, and there is nothing to show.
- Deck numbering is internally inconsistent: the source comment specifies "Eleven numbered slides... folios read `n/11`" while folios read 1/10 to 10/10; the declared arc ends "…credentials · team · next · close" and there is no team slide and no close slide; both dividers carry the eyebrow "03" although the contents page numbers The Solution as 02; and the slide headed "How We Work" is listed in the contents as "Engagement".
- The first thing a buyer meets at the URL is a device-frame and theme picker — Desktop / iPad Pro / iPhone / iPhone Pro Max, Default / Deeplight / Keel / Slate / Signal / Ember / Aurora / Drift, and a `9:41` status bar. That frames the whole thing as a marketing artefact before a single number is seen.

## What it gets right

- **The numbers reconcile, deck to demo, exactly.** Every figure on slides 4, 5 and 6 matches the running product: revenue £12.4m / +5.2%, gross margin 41.8% / −194bps, EBITDA £2.1m / −3.0%, cash £4.8m / −18.4%; the bridge at £582k volume, £22k price, −£19k mix, £83k unmeasured units, −£50k intercompany; £12.4m in month, £90.2m YTD, £63.1m remaining; the entity drill at £5.3m / £3.0m / £2.7m / £1.5m / £730k with the −£855k elimination named as its own line. I checked the driver contributions add up and they do (£581.5k, £21.6k, −£18.9k). Deck-to-demo numerical fidelity is the thing that most often fails a review like this, and it did not fail here.
- **It is unusually honest about its own limits, in places.** The £212k of unmapped accounts and the £48k intercompany break are surfaced rather than netted; the control alert states "No message is sent. This demo dials no mail server"; the keyless Ask panel refuses in plain English, identically, six times out of six, rather than inventing an answer; permission refusal names the persona, states the reason and shows the permitted entity instead of failing.
- **The "Against precedent" panel is the most commercially convincing thing in the product** — telling me an assumption sits outside the range any stored version has ever assumed, and explaining in one sentence why it will not print a probability from five versions. If there is a product here, that is what it is made of.

## Questions it failed to pre-empt

- What does the customer pay in year two?
- Who buys this, how many of them are there, and what is the total price of a twelve-week programme when the answer is not "from"?
- After week 12, who operates it — us or them — and at what cost?
- What happens when the reproduction of a close disagrees with the close the auditor signed? Whose number wins, at what tolerance, and who carries the difference?
- Where does the data live, under what certification, and who has approved a DIFC-based vendor holding a UK plc's general ledger?
- What does one customer cost to run per month, including model calls, monitoring and the "model documentation, evaluation evidence, control mapping" the deck promises as a free by-product of the build?
- What became true in the last eighteen months that makes this the quarter?
- Does ADCB know those four figures are in this deck?
- Why does the deck not mention AI at all when the product logs a model as the author of board commentary?

## What I made of the product after driving it

I fetched all fourteen app routes plus the landing page and the deck; all returned 200, several after a ~30s first compile. I read the rendered HTML of each, and the deck's hero screenshot as an image.

**Where the deck and the demo disagreed.** Not on numbers — on what exists. The deck says the workbench is built and twelve weeks puts it on your ledgers; the repository has no ingestion, no persistence and no identity, and `/api/health` reports `"tier":"memory"`. The controls surface lists four named ERP feeds with ingestion mechanisms and load timestamps that no code implements, on the same page that carefully disclaims a mail server it also does not have. And the product's own front door describes itself as "a synthetic multi-entity finance group built to show how an executive answer, an analyst drill and a controller evidence chain can remain the same computation" — an illustration, honestly labelled. The deck sells it as a product. Both halves are internally consistent; the pair is not.

**What I clicked that worked.** I walked the guided tour listing (twelve stops), the overview, performance, commentary, controls, quality, explore, year-to-go, people and scenarios. The materiality policy is versioned and owned; the nine findings are partitioned by direction and horizon; the revenue bridge separates currency first; the drill to five entities plus a named elimination ties exactly. I switched persona and entity to `?as=gulf-controller&entity=manufacturing` and the refusal was clean and explained. I hand-edited `/app/scenarios?volume=0.9&subcontractRate=1.04` and the model genuinely re-ran — revenue £11.8m → £10.6m with cash and working capital following, and the precedent panel flagging that a −10% volume step is outside anything five stored versions have assumed.

**What did not work.** I clicked scenario levers first, before hand-editing anything, and got a 404 — then found all 25 of them, all six commentary state chips and all three forecast version chips point at paths missing the `/app` prefix, verified by curl against both forms. Guided tour step 8 tells the viewer to move an assumption; every lever inside that iframe 404s. The scenarios page names its own audit record as a URL that does not resolve.

**What I typed.** The Ask box, and then `POST /api/ask` six times — my own question about gross margin, the four questions the product itself suggests, and one trivial one ("What is revenue?"). Six identical `unavailable / no_client` responses: "The answer service is not running here, so nothing could be looked up. The figures shown in the demo itself are unaffected." An empty body returned a clean 400. That is well-built failure, and it is deterministic rather than a distribution — I could not make it lie. But the README's claim that without a key "the demo is whole" does not survive the buyer in my brief. On this server, the surface named "Explore & Ask" cannot answer a single question, the input asks about "a site", and the commentary provenance asserts a model authored text no model wrote. I could not evaluate the one component that carries a per-use cost and an accuracy obligation, and it is also the one component the deck never mentions. A CFO shown this would conclude that the AI is either not the point or not ready, and the deck does not tell them which.

**Net.** The arithmetic and the intellectual discipline in this product are better than most things that reach my desk. The commercial case around it is not built at all, and the interaction layer breaks on the third click. Fix the ask and the ceiling and I will look again; fix the 404s and the copy before anyone outside sees it.
