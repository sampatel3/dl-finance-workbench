# Decisions

Each entry is a decision that could reasonably have gone the other way, recorded as **Why.** /
**The cost.** — a decision recorded without its cost is advocacy rather than a record. The
convention comes from demo-kit, which inherited it from the demo before that. Where a decision is
demo-kit's already, the adoption is marked rather than re-argued. These are plan-time decisions; the
final wave annotates any that reality forced open.

---

## 1. Memory tier, with scenario state carried in the URL

**Why.** A scenario is defined as a base version plus a set of assumption deltas and nothing else,
which makes it a pure function — so it can live entirely in a query string and recompute
deterministically on the server. That buys the visitor a scenario that is shareable as a link,
reproducible on any machine and screenshotable, and it buys the demo no database, no migrations, no
Railway bill, one CI path and no possibility of two prospects treading on each other's world. It
also puts the demo's own state architecture in agreement with demo-kit's decision §16 — state that
must survive a link lives in the URL — and with the product definition, where a scenario's identity
*is* its delta set.

**The cost.** Two things need persistence and will not have it: a scenario the visitor saves under a
name, and an approval the visitor makes. Both are handled honestly rather than faked — the seed
ships a scenario library and a commentary queue spread across every approval state, and a visitor's
own approval is a labelled client-side act — but a client who asks "can I save this and come back
tomorrow?" gets "not in the demo". The trigger to reverse this is that question being asked twice;
the reversal is a re-scaffold on the postgres tier, not a flag, and it costs the migration and
provisioning surface demo-kit's decision §1 describes.

## 2. The demo grows its own packages

`packages/{model,measures,analysis}` beside `web/`, layered `model → measures → analysis → web`,
strictly acyclic.

**Why.** demo-kit's decision §17 keeps layering to convention and names the condition under which a
demo should layer anyway: when it grows layers worth enforcing. A fact store with a declared grain,
a measure catalogue that is also a semantic layer, and three analysis engines are that condition.
Putting them in `web/lib/` makes the boundary between "what is true" and "what is drawn" a naming
convention, and that boundary is the product's whole claim. Separate packages also mean the model
and the engines are testable with no Next runtime, which is what lets the wave gates be commands.

**The cost.** A hand-edit to the scaffolded `pnpm-workspace.yaml`, which the kit did not write and
will not maintain — safe across `demo update`, which never touches that file, but a thing to
remember. Four packages to typecheck instead of one. And the layering is enforced by package
dependencies and review only: nothing stops `analysis` importing from `web`, and nothing will
complain if somebody does.

## 3. The fact grain carries `quantity` beside `amountMinor`

**Why.** Without a volume on the same row as the value, a variance can only ever be a delta. Price,
volume and mix are not derivable from money alone, and the three findings printed on slide 5 are all
statements about them — "driven mainly by volume" most explicitly. This is the single field the
PRD's data model is missing that most changes what the product can do.

**The cost.** Every seeded row now has to have a defensible volume behind it, including rows where
volume is a modelling fiction — an overhead recharge has no natural quantity. Those carry null, and
the bridge then reports a rate effect rather than a price/volume split for them, which is correct
and is one more branch in the decomposition. It also roughly doubles the seed's own arithmetic,
because volume and value have to stay consistent with the unit price the driver graph declares.

## 4. Basis is a property of the account, not of the query

`flow` summed, `balance` read at the last month present, `avg_balance` averaged.

**Why.** It is the one rule that makes month, quarter, year-to-date, fiscal year and trailing twelve
months all correct out of a single fact table. The alternative — the caller deciding how to
aggregate — is the defect that ships a plausible wrong number: three closing balances summed into a
quarter, or a margin divided by a month-end balance where the correct denominator is an average. The
reference demo proved the rule at 42 months and seven org units, and the PRD has no equivalent
concept at all.

**The cost.** Every new account has to declare its basis, and getting it wrong is silent — a flow
mislabelled as a balance produces a figure that looks like a figure. The mitigation is that the
golden-measure tests assert at three scopes, where a basis error shows up as a quarter that does not
equal the sum of its months.

## 5. Currency translation lives in the model, not in a report

Functional and presentation currencies, a versioned rate table with a source, IAS 21 translation,
and constant currency as the same translation run at like-for-like prior-year rates.

**Why.** "How much of that is FX?" is the first question a group CFO asks about any variance, and it
cannot be answered by a report that receives already-translated numbers. Constant currency has to be
a lens on the model, and FX has to be available as a bar in the bridge rather than as an
unexplained residual. Making the rate table versioned data with a source is what makes a variance
reproducible: a variance computed on a re-keyed rate is a variance nobody can check.

**The cost.** Every measure computation now has a currency context, and every test has to state one.
The cumulative translation adjustment has to be carried and has to reconcile, which is real
arithmetic in the seed rather than a plug. And the demo takes on a small amount of accounting the
audience may not want to see — the mitigation is that the CTA lives in the Controls surface where a
controller looks for it, not on the executive Overview.

## 6. "Cash £4.8m · 13 weeks" is read as the 13-week forecast, not as 13 weeks of cover

**Why.** Read as cover it is arithmetically odd against a business doing £12.4m of revenue a month,
and it would put a number on the executive surface that a CFO can falsify in ten seconds. Read as
the 13-week direct forecast it is the treasury standard, it is what makes the PRD's own example
question — "what happens to cash if revenue falls 8%?" — answerable at all, and it turns one
ambiguous card into the demo's strongest surface.

**The cost.** It is an interpretation of a client artifact, not an instruction from one, and it needs
saying out loud in the first demo conversation rather than discovered on a slide. If the client
meant cover, the card changes and the cash surface stays — which is the reason to record the reading
here rather than quietly implement it.

## 7. Three surfaces on one model, not one dashboard with a detail toggle

Executive, Analyst, Controller — three front doors, one measure model.

**Why.** The brief is explicit that executives and finance users both use this, and the PRD answers
that with a single dashboard. The two jobs have opposite design postures: an executive surface earns
its keep by removing figures, an analyst surface by admitting them, and a control built to satisfy
both satisfies neither. Three surfaces over **one** model is the only arrangement in which a board
pack cannot disagree with the drill-down that produced it — three models is exactly how that
disagreement happens.

**The cost.** Ten routes instead of one, and three navigation vocabularies to keep coherent. More
seriously: three surfaces is three places for a design inconsistency to hide, and the analyst grid
is the single largest piece of UI in the demo with the least glamour attached to it. It is also the
piece most likely to be cut under time pressure and the piece whose absence would make the word
"Workbench" a lie.

## 8. The bridge must sum to the total, under a stated attribution convention

**Why.** A decomposition whose bars do not add up has explained nothing, and the residual is where
an unstated convention hides. Price, volume and mix cannot be separated without choosing an order of
attribution, and the choice changes the answer — so the convention is written down, tested, and
shown in the formula inspector. The summing constraint is also what makes each bar assignable to an
owner, which is what turns a variance into an action.

**The cost.** Real arithmetic on data with mix shifts and FX in it, and the honest outcome is that
some scopes still leave a residual. The rule adopted is that the residual is a named bar and the
test asserts it is smaller than the smallest real bar on the demo's own data — which is a
demo-grade guarantee, not a product-grade one. A pilot with messier data will have a larger
residual, and the product will have to say so rather than absorb it into "other".

## 9. Materiality is a versioned policy object with two thresholds

An absolute floor **and** a relative threshold, per statement and account group, owned and
versioned.

**Why.** The PRD's open question 4 asks what makes a variance material. The answer belongs in the
product where it can be governed, not in a constant where it cannot be discussed. Two thresholds
because one of each fails: relative-only makes every small account scream, absolute-only hides a
40% miss on a small line. Making it versioned and owned means "why did this appear?" has an answer
that names a policy and a person.

**The cost.** One more governed object to seed, render and explain, and a materiality change now
moves the findings — which is correct and is also a source of confusion when a demo is walked
twice with different settings. The tour therefore never changes it mid-walk.

## 10. Drill is a property of a computed figure, not a screen

Every computed value carries its inputs and its children; recursion terminates in source rows with
their vintage.

**Why.** Lineage (`FW-DATA-004`), AI traceability (`FW-AI-003`), the formula popover, the analyst
drill and the citation under a board-pack figure are the same mechanism seen from five places. Built
once, they cannot disagree. Built per screen, they will — and the disagreement will be found by a
customer, in front of an audience, on the one figure that mattered.

**The cost.** Every measure computation carries provenance it usually does not need, which is memory
and a slightly heavier return type everywhere. And the drill is only as deep as the model: it
terminates in seeded source rows, which look like GL lines and are not — a distinction the demo has
to make in words on the Controls surface.

## 11. Forecast quality ships in the MVP, not in a later phase

Error by horizon, bias, and value added against a naive baseline.

**Why.** A product that generates forecasts and never scores them is asking for trust it has not
earned. Shipping the scoring is the strongest credibility move available and the cheapest — the data
is already there, in the versions the product keeps — and it is the honest counterweight to the AI
framing. Bias in particular is the useful one: a same-direction miss across consecutive versions is
an assumption to fix, and no other surface in the product will find it.

**The cost.** It is a feature whose entire purpose is to show the product's output being wrong, in
front of a buyer, and the seed therefore has to plant a genuine bias (condition 9) for it to have
anything to say. Some audiences will read it as weakness. The answer to that is a sentence in the
tour, not a smaller feature.

## 12. Commentary is anchored to a figure; approval pins a vintage

**Why.** Unanchored prose per pack is a Word document with extra steps — it cannot be reused,
cannot be checked against the number it describes, and cannot support the most valuable thing a
workbench can say next month: *you said the shortfall was contractor rates; here is what happened.*
And an approval that does not pin the data vintage approved nothing, because the pack can change
underneath it. Both are small mechanisms with large consequences.

**The cost.** Anchoring means commentary cannot be free-form: a draft belongs to a figure, and prose
that spans four figures needs four anchors or a composite one. That is a constraint on the writer,
and some genuinely good commentary does not fit it. The vintage pin means a published pack can look
stale beside a refreshed dashboard — correct, and confusing the first time somebody sees it, which
is why the published view says which vintage it is pinned to.

## 13. Row-level permissions are demonstrated, and they bind the chat

**Why.** Role-based access that stops at the page is not access control, and for a group product the
binding requirement is the entity subtree. The part worth demonstrating is the chat: if a question
asked by a business-unit controller can be answered from data they cannot open, the chat is the way
around the permission model. Showing the refusal is more persuasive than showing the grid.

**The cost.** Every tool the chat exposes has to take a principal and filter on it, which is a
parameter on every signature and a test per tool. Personas also add a dimension to every screenshot
decision — the deck has to say which persona each shot was taken as, or the figures across slides
will not tie.

## 14. The four headline figures reproduce slide 5, as computed outputs

**Why.** Reproducing the client's own concept from a live model is the most persuasive single thing
the demo can do — and it is the exact move the reference demo made against its Figma predecessor,
whose period tabs relabelled and whose every value was a typed string. Tuning the seed so revenue,
gross margin, EBITDA and cash land on the illustration costs a day and buys the moment where the
slide becomes real.

**The cost.** The four figures are now outputs of a seed, which means a threshold, a rate or a seed
change moves them away from the deck. That is a feature — the freshness test says so out loud rather
than letting them drift — but it is a maintenance obligation, and anybody who edits the seed has to
know the deck depends on it. It also risks the seed being tuned toward the answer, which is why
every reconciliation identity in wave 1's gate is asserted independently of the headline figures.

## 15. Unmapped accounts are a visible line, not a rounding

**Why.** A new GL account appearing in a load with no mapping is the most common real failure of a
governed finance layer, and it is silent: the balance simply leaves the P&L. Showing it — with its
value, on the Controls surface, and as a reconciling line between the mapped P&L and the trial
balance — is a small feature that tells a controller this product was built by somebody who has
done a close.

**The cost.** The demo's own P&L now has a line nobody wants on a slide, and it has to be explained
every time somebody asks why the numbers do not quite tie. That explanation is the point, and it
still costs thirty seconds of every walkthrough.

## 16. No charting library; the charts are hand-written SVG

(adopts demo-kit's decision §16.)

**Why.** The reference demo shipped a client-grade UI with zero UI dependencies, and the charts this
demo needs are not generic: a waterfall whose bars must sum, a weekly cash column chart with a floor
line and a named breach, a bridge that has to be readable at slide width. A library's component
cannot be adjusted to say the thing the slide says, and adjusting it costs more than writing the
sixty lines.

**The cost.** Five chart components to write, and accessibility, dark treatment and small-screen
behaviour to get right by hand in each. No animation vocabulary. And a genuinely new chart type
later is a day rather than an import.

## 17. Narration is generated at build time, cached in a committed file, guarded by a freshness test

(adopts demo-kit's decision §8.)

**Why.** A page load never waits on a model; a deploy is reproducible; a keyless build still ships
prose written by code, which is the designed fallback rather than a degraded mode. The freshness
test pins every deterministic figure and lets only the sentences float, so stale figures are a
failing test rather than a quiet lie.

**The cost.** Regeneration needs a key at build time or template prose ships. The generated file
bloats diffs. And the test guards structure, not quality: stale, clumsy or subtly-off narration
passes every automated check, and only reading catches it.

## 18. The action ladder is a product control, not a principle

Explain (free) · Propose (writes a draft, changes nothing) · Change (requires a named approval) ·
Post (no capability exists).

**Why.** "AI assists; Finance decides" is correct and, as a sentence in a document, does not hold.
Four rungs with a gate on each is enforceable, testable, and answers the only question an audit
committee actually asks. It is also the posture the market has converged on — the rules in the
system, versioned, rather than in the prompt — and it structures the UI for free: anything the model
produced is visibly a draft until a person moves it.

**The cost.** Every AI-touching feature now has to declare its rung, and the honest consequence is
that the demo's most impressive-sounding capabilities all sit on rungs one and two. Somebody will
ask why the product cannot just update the forecast, and the answer is a design position rather
than a limitation — which is a harder sentence to deliver than a demo.

---

*The two decisions below were added after the revised PRD of 12 August. The review of that revision
is [`00-source-review.md`](../review/00-source-review.md) §7.*

## 19. The commentary detail level is written by code; only the headline is narrated

`FW-AI-005` asks for commentary across four reporting periods and five comparators, and `FW-AI-004`
asks for two levels of it per material movement. Taken literally that is twenty narrations per item.

**Why.** The detail level is not prose — it is an evidence chain: the movement, its decomposition
into drivers with amounts, the accounts and operational factors behind them, and the source rows.
Code already holds all of that and code writes it better than a model does, because it cannot get a
number wrong. So the model writes only the headline, the default period-and-comparator pair is cached
at build time, and every other combination renders the deterministic sentence code wrote — with a
narrated headline generated on demand where a key is available. That satisfies the requirement,
keeps a keyless build whole, keeps the committed cache and its freshness test to a size a person can
read, and holds the line that code decides and the model phrases.

**The cost.** The non-default combinations read in a plainer voice than the default one, and a
visitor who switches from month-against-budget to half-year-against-prior-year will notice the
register change. It is honest — the plainer sentence is the one code wrote — but it is a visible
seam, and a client who wants uniform prose across all twenty combinations is asking for a build that
narrates all twenty and a freshness test nobody will read.

## 20. The four priority boards are a 2×2 of direction × horizon, not four peers

**Why.** The revised PRD lists Adverse, Favourable, Risks and Opportunities as four boards. They are
two axes: a risk is a forward-looking adverse, an opportunity is a forward-looking favourable.
Naming that makes the partition exhaustive and mutually exclusive — every finding lands in exactly
one board by construction, from two fields on the finding rather than from a judgement call each
time — and it makes the classification testable, which four peers never could be. It also tells the
detector suite what balance it owes: a product whose only forward-looking finding is a risk has an
empty Opportunities board, which is how the demo's twelfth planted condition came to exist.

**The cost.** It is a reading of the client's artifact rather than the artifact itself, and the grid
is one more concept to explain in a walkthrough — though it explains itself faster than four
unrelated lists do. And it forecloses a board that is genuinely neither: an item that is material and
directionless (a mix shift that is neither good nor bad yet) has nowhere to go, and will be filed
under whichever direction its measure's polarity implies, which is occasionally the wrong answer.
