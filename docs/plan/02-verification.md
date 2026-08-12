# Verification

This document is written in the future tense, as a commitment: it says what will be checked and how,
before most of it has run. Its convention comes from demo-kit, which inherited it from the demo
before that, and with it comes the rule that gives the last section its teeth — findings are listed
because **a verification note with no findings did not verify anything**. The findings section at the
foot is therefore short today and grows with every wave. If the build closes with it empty, the build
did not verify anything and is not closed.

## The invariants

The properties every other claim in this repo rests on. Each is stated as something that can fail.

| Invariant | Why this is the one to test |
| --- | --- |
| The same seed produces an identical world, across reloads, processes and machines. | Every other artifact silently assumes it: the screenshots, the deck, the tour's month walk, the committed narration, every test. A demo that reshuffles itself between reloads is not a demo. |
| Assets equal liabilities plus equity, to the cent, every month, for every entity and consolidated. | It is the first thing a controller checks, and it takes them thirty seconds. A model that fails it cannot be trusted about anything else on the screen. |
| Children sum to their parent exactly: cost centres to the entity, segments to revenue, entities to the group after eliminations. | A segment table whose margins do not roll up to the income statement above it is the defect that ends a demo, and it cannot be found by looking at one number. |
| A quarter equals the sum of its months for a `flow` account and its closing month for a `balance` account; likewise a half-year over its quarters. | This is the basis rule, and a basis error is silent — a flow mislabelled as a balance produces a figure that looks like a figure. |
| A missing month returns `null`, never `0`, and renders as `—`. | A missing month and a genuine zero are different things, and a product that renders them identically will eventually tell a CFO their cash is zero. |
| Constant currency differs from reported for the EUR and USD entities and does not for the AED one. | AED is dollar-pegged, so this asserts the translation is actually running on rates rather than on a constant. The cheapest possible test of the whole currency model. |
| Every bridge's bars sum to its total, on every scope and both comparators. | A decomposition that does not add up has explained nothing, and the residual is where an unstated attribution convention hides. |
| Every finding lands in exactly one priority board, and all four boards are non-empty on the demo's own world. | The boards are a partition by direction × horizon. If an item can land in two or in none, the classification is an opinion and the executive surface is not reproducible. |
| Every detector returns nothing on the healthy twin. | A false positive in front of a CFO discredits every other number on the screen. A detector proven only to fire is half-proven. |
| Every numeral in a live answer appears in tool output the model was shown. | Hallucinated figures are the one failure that destroys trust permanently. The check converts it into a named, testable refusal. |
| With no API key, every page renders and chat degrades to a named state. | Demos get shown from machines with no secrets. A blank state on stage is how a demo dies. |
| Expanding a commentary headline leaves the period, version and comparator byte-identical. | `FW-AI-004`'s acceptance criterion, and the reason drill is a property of a computed figure rather than a page that refetches. |
| As the Gulf business-unit controller, no group figure is reachable on any surface **and** the chat refuses a group question. | Row-level access that stops at the page is not access control; a chat that reaches past it *is* the way around it. |
| Passcode unset ⇒ no gate; passcode set ⇒ every route and every `public/` asset gated, except the exact-match PWA exemptions. | Both directions have bitten before: under-gating leaks the demo, over-gating broke the manifest on every page load. Inherited from the kit along with its test. |
| A deploy is not done until `/api/health` reports the exact commit that was deployed. | A CLI reporting SUCCESS for a stale build is a recorded burn, not a hypothetical. |
| The deck captures nothing until the sentinel renders; no slide overflows; the PDF has one page per slide. | Deck assets reach client-facing documents unreviewed. The sentinel is what stops a Chrome error page shipping as a slide. |

## The gates

| | Command | Expected |
|---|---|---|
| Types | `pnpm -r typecheck` | exit 0 |
| Tests | `pnpm -r test` | exit 0 |
| Build | `pnpm --filter web build` | exit 0 |
| Determinism | `git grep -nE 'Math\.random\|Date\.now\|new Date\(\)' packages web/lib` | no matches |
| Deck | `pnpm deck:slides` | no slide overflows |
| Health | `curl <url>/api/health` | `.commit` equals the deployed SHA |

## How each wave proves itself

Gates in full are in [`00-build-plan.md`](00-build-plan.md); this is the index.

| Wave | Proof |
| --- | --- |
| 0 scaffold | Install, typecheck and test green with no manual edits; `git grep -n 'TODO\|{{'` exits 1; the first commit is `scaffold: create-demo <sha>` |
| 1 model | Balance-sheet identity, child sums, seed determinism twice over, the healthy twin free of all twelve conditions, no `Math.random` and no wall clock |
| 2 measures | Golden measures at four scopes and two currencies; the five comparators; denominators asserted individually; polarity on a rising cost; `null` never `0` |
| 3 analysis | Every bridge sums; the v6→v7 diff round-trips; the cash floor breach at week 9; bias across v4/v5/v6 and absent on the twin; four non-empty boards with exactly one home per finding |
| 4 executive | Freshness test keyless; the four PRD questions answered with citations; a forecast question refused in words; a fabricated numeral rejected; `deck shoot` writes JPEGs |
| 5 analyst | A three-dimension pivot totals to the same measure computed directly; drill sums to its cell; any view's URL reproduces it in a clean browser |
| 6 governance | Headline expansion leaves the URL parameters identical; the intercompany check fails by name; the unmapped total closes the gap to the trial balance; the Gulf controller's refusal |
| 7 ship | Live URL 307s to `/gate`; `/api/health` `.commit` equals `main`; deck PDF pages equal slides; every tour step's `href` lands on what it describes |

## Accepted weaknesses

Things that are wrong and are staying wrong, with the reason. A weakness written down is a decision;
a weakness nobody wrote down is a surprise.

- **The passcode gate is not authentication.** One shared secret, a cookie whose value is `1`, and no
  users. Inherited from demo-kit deliberately: a demo has a passcode, not accounts.
- **The attempt limiter is per-instance memory**, so serverless fan-out weakens it. Inherited with the
  same acknowledgement the kit makes.
- **Nothing a visitor does persists.** A saved scenario and a visitor's approval do not survive a
  reload; the seed carries a scenario library and a commentary queue across every approval state
  instead, and a visitor's own approval is labelled as not persisted. The cost of the tier, argued in
  [`01-decisions.md`](01-decisions.md) §1.
- **Ingestion is modelled, not real.** Sources, loads, vintages, validation results and unmapped
  accounts are seeded. The demo dials no customer system, and the Controls surface says so.
- **The drill terminates in seeded rows.** They are shaped like ledger lines and are not ledger lines.
- **Trend is a fit, not a plan.** Excluded from materiality for that reason; it can inform a reader and
  cannot raise a priority-board item.

## What could go wrong that no test will catch

Named now, because a verification note that lists only what it covers is advertising.

- **A seed tuned toward its answer.** The four headline figures are tuned to match the concept deck.
  The containment is that every reconciliation identity in wave 1 is asserted independently of them —
  but a seed can satisfy every identity and still describe a business that would not exist.
- **Prose quality.** The freshness test pins the figures and lets the sentences float. Stale, clumsy
  or subtly-off narration passes every automated check. Only reading catches it.
- **The attribution convention.** The bridge is tested to sum, which does not make its price/volume
  ordering the right one. A different convention produces different bars that also sum.
- **Materiality changed mid-walkthrough.** Moving the policy moves the findings, which is correct and
  is also how one demo tells two stories. The tour never changes it; nothing stops a visitor.
- **Grounding exemptions.** Small integers and year-shaped tokens are exempt by design, so a
  fabricated small integer passes the check. Inherited from the kit knowingly.
- **The transpile chain.** TypeScript-source packages via `transpilePackages` and Node's type
  stripping are proven on today's pinned Next and Node 24. A future minor of either can break the
  no-build-step workspace in ways only an upgrade attempt reveals.

## What is verified by looking

Some checks have no assertion and are still real. The kit's convention legitimises this explicitly and
points at the tooling that makes looking cheap.

- The tour, walked step by step, each `href` landing on what its note describes.
- Deck slides: `deck slides` flags overflow mechanically, then a person looks at each frame for
  hierarchy, crop and legibility at displayed width.
- Any UI change: `deck page <name> <url>`.
- Whether the four priority boards read as a *scan*. The point of the surface is that an executive
  sees the shape of the month without reading it. No test can tell you whether they do.
- Whether the whole thing feels like a product or like a scaffold. Closing the build requires a person
  to say so.

## Defects found and fixed

Each entry names what found it — which gate, which command, which pair of eyes — and what fixed it.

| # | Found by | Defect | Fix |
| --- | --- | --- | --- |
| 1 | Reviewing the revised PRD against the plan | The seed's eleven planted conditions covered adverse, favourable and risk and contained **no opportunity** — so `FW-DASH-001`'s Opportunities board would have rendered empty on the demo's own world, which is the one board a demo cannot afford to have empty. | Condition 12 added: CRM pipeline conversion running above assumption, worth roughly £0.8m of full-year revenue, carrying a *run scenario* action. The wave-3 gate now asserts all four boards are non-empty, so the class of defect cannot recur silently. |
| 2 | Running `demo new` for real | The build machine's default Node is 22. The kit requires 24 and its no-build-step mechanism depends on Node 24's type stripping, so the scaffold would have failed at install with an error about neither. | Node 24 installed before scaffolding, and `.nvmrc` committed in wave 0 so the next machine is told rather than surprised. |
| 3 | Running wave 0's own gate | **A demo-kit defect.** The gate `git grep -n 'TODO\|{{'` cannot pass on any scaffold that contains JSX or a GitHub Actions workflow: `style={{` and `${{ secrets.… }}` both match, and the fresh scaffold produces sixteen hits before anyone has written a line. A gate that fails on correct output is a gate nobody will run twice. | The check here is narrowed to what it was actually for — an unsubstituted template placeholder, which is a `{{` followed by a word and `}}`, and the literal `TODO`: `git grep -nE 'TODO\|\{\{[a-zA-Z_]+\}\}' -- . ':!vendor' ':!docs'`. Reported upstream; the kit's own traceability row needs the same narrowing. |
| 4 | Changing the seed on a machine with no API key | **A demo-kit defect, and the freshness test working exactly as designed.** Changing `DEMO_SEED` moved every figure, so the committed narration went stale and `narration.test.ts` failed — correctly. But `pnpm narrate` with no key *keeps* the committed file, for a good reason (a keyless CI run must not overwrite a model's prose with the fallback), and its only exception is a file that does not exist. So a keyless machine is left with a failing test, a correct diagnosis, and no remedy it is told about. | Locally: delete `web/lib/narration.generated.ts` and re-run `pnpm narrate`, which is the path the script's own header sanctions. Upstream the fix is to compare the pinned projection first and regenerate when it no longer matches — the fallback is deterministic, so there is nothing to lose — or at minimum to print the remedy instead of a reassuring line. This is a good candidate for the wave-7 gate that requires one kit fix to have propagated through `demo update`. |

*Waves 1–7 append here as they land.*

## Live smoke

*Empty until wave 7.* The transcript of the run that proved it — provision, deploy, verify, and the
health document the live URL returned — pasted rather than summarised, because a summary of a
transcript is a claim and the transcript is the evidence.
