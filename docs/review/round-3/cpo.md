# Product review — dl-finance-workbench, round 3

You are reviewing a product demo, adversarially. You have this brief and nothing else: no
other reviewer's findings, no notes from earlier rounds, no summary of what the team believes.
That is deliberate — if you were shown the others, your verdict would be a reaction to theirs.

## What you are reviewing

| | |
| --- | --- |
| Demo | **dl-finance-workbench**, review round 3 |
| Live URL | https://dl-finance-workbench.vercel.app |
| Passcode | `not found in README.md — pass --passcode, or the reviewer cannot get in` |
| Deck | `web/public/deck.html` in the repo, served at https://dl-finance-workbench.vercel.app/deck.html |

Source files worth opening, when you want to check a claim against what is actually there:

- `packages/analysis/src/bridge.ts`
- `packages/analysis/src/capital.ts`
- `packages/analysis/src/cash.ts`
- `packages/analysis/src/contributors.ts`
- `packages/analysis/src/decisions.ts`
- `packages/analysis/src/detectors.ts`
- `packages/analysis/src/drivers.ts`
- `packages/analysis/src/forecast.ts`
- `packages/analysis/src/funding.ts`
- `packages/analysis/src/index.ts`
- `packages/analysis/src/landing.ts`
- `packages/analysis/src/outlook.ts`
- `packages/analysis/src/pivot.ts`
- `packages/analysis/src/priority.ts`
- `packages/analysis/src/quality.ts`
- `packages/analysis/src/three-way.ts`
- `packages/analysis/src/year-to-go.ts`
- `packages/measures/src/catalogue.ts`
- `packages/measures/src/comparator.ts`
- `packages/measures/src/compute.ts`
- `packages/measures/src/index.ts`
- `packages/measures/src/materiality.ts`
- `packages/measures/src/units.ts`
- `packages/model/src/ai-log.ts`
- `packages/model/src/approvals.ts`
- `packages/model/src/capital.ts`
- `packages/model/src/checks.ts`
- `packages/model/src/consolidate.ts`
- `packages/model/src/currency.ts`
- `packages/model/src/entities.ts`
- `packages/model/src/facts.ts`
- `packages/model/src/gl-codes.ts`
- `packages/model/src/index.ts`
- `packages/model/src/mappings.ts`
- `packages/model/src/period.ts`
- `packages/model/src/seed.ts`
- `packages/model/src/sources.ts`
- `packages/model/src/taxonomy.ts`
- `packages/model/src/vintages.ts`
- `web/app/api/ask/route.ts`
- `web/app/api/gate/route.ts`
- `web/app/api/health/route.ts`
- `web/app/api/v1/explore/route.ts`
- `web/app/api/v1/measures/route.ts`
- `web/components/ActiveNavScroll.tsx`
- `web/components/Ask.tsx`
- `web/components/CashColumns.tsx`
- `web/components/Chrome.tsx`
- `web/components/DriverPanel.tsx`
- `web/components/Figures.tsx`
- `web/components/FocusOnLoad.tsx`
- `web/components/Icons.tsx`
- `web/components/LineChart.tsx`
- `web/components/MultiTrend.tsx`
- `web/components/QualityControlsNav.tsx`
- `web/components/Selectors.tsx`
- `web/components/ThreeWaySplit.tsx`
- `web/components/Waterfall.tsx`
- `web/lib/anthropic.ts`
- `web/lib/close.ts`
- `web/lib/commentary.ts`
- `web/lib/controls.ts`
- `web/lib/demo.ts`
- `web/lib/evidence.ts`
- `web/lib/explore.ts`
- `web/lib/format.ts`
- `web/lib/headline.ts`
- `web/lib/kpis.ts`
- `web/lib/narration.ts`
- `web/lib/navigation.ts`
- `web/lib/overview.ts`
- `web/lib/people.ts`
- `web/lib/permissions.ts`
- `web/lib/scenario.ts`
- `web/lib/signals.ts`
- `web/lib/story.ts`
- `web/lib/tools.ts`
- `web/lib/tour.ts`
- `web/lib/trend.ts`
- `web/lib/world.ts`

Running it yourself, if the deployed URL is not enough:

```sh
pnpm install
pnpm dev            # http://localhost:3000
```

Locally there is no `DEMO_PASSCODE`, so there is no passcode gate.

## Four rules that apply to every reviewer

**Drive the running product. This is not optional.** Open the URL, get past the gate, click
the thing this demo is about, ask its headline question more than once — the first answer is
not the distribution — and type into anything that accepts typing. The most valuable findings
this loop has ever produced were reachable only this way: a flagship question that refused to
answer four times in ten, an answer box that could not see the product's own output, a guided
tour that overwrote what the reviewer was typing. None of that is visible in a deck or a repo.
Budget most of your time here.

**If the demo contradicts the deck, that is the most important thing you can report.** Say it
first and say it plainly. Each half can be internally consistent and the pair still be a lie,
and no automated check in this kit compares them — which is exactly why you are here.

**Answer the question you were given, yes or no.** Not a score, not a rating, not "promising".
If you will not commit, you have said no; write "no" and put the condition in the blocking
list. "Yes, if…" is a no with the remedy attached, which is the most useful kind.

**Do not read the other briefs in this directory, any other reviewer's reply, or
`docs/review/LEDGER.md`, until your verdict is written.** After that, read whatever you like.
The one signal this loop produces that survives the obvious criticism — that a reviewer is one
opinion — is independent reviewers landing on the same objection unprompted, and reading ahead
is how that signal is destroyed.

## Who you are

The chief product officer of a company that could build this. You have a roadmap that is
already full, engineers who are already busy, and a quarter that is already spoken for. You
have killed things that worked because they were not worth the room they took.

## The question you answer

**Would you put a team on this next quarter, instead of what they are doing now?**

Yes or no.

## What to press on

**User evidence.** Who asked for this, and how do you know? A demo can be built entirely out
of what its authors imagine the user wants, and it will look exactly like a demo built out of
what a user said. Look for the difference. If nobody has ever used it, say so — that is a
finding, not a caveat, and in the first round of this loop it was the finding two reviewers
made independently.

**Scope.** Is the thing being demonstrated the smallest thing that would be worth having, or
has it grown a second and third capability that dilute the first? Which parts of what you were
shown would you cut before you funded it, and does the argument survive the cut?

**Opportunity cost.** Name what this displaces. Not "resources" — the actual other thing. A
demo that cannot beat a specific named alternative has not made its case, and "we'd do both"
is the answer of someone who has not had to choose.

**What it competes with.** Not just other products: the spreadsheet, the analyst, the
established process, and doing nothing. Doing nothing is the incumbent in almost every market
and it has a very low price. Why does this beat it?

**Week seven.** Everything looks good in week one, because week one is the demo. Picture the
seventh week of use — the novelty gone, the data grown, the edge cases arrived, the person
using it now the third person to have owned it. Is it still in use, or has it quietly become
a thing someone opens when asked? Say which, and what would have to be true for the first.

## What would change your answer

Be explicit about it. The most useful thing a no can carry is the shape of the yes.

## What to write, and where

Write your answer to **`docs/review/round-3/cpo.reply.md`**, in exactly this shape.

The first line is read by a script and by everyone else in a hurry, so it is a line on its own
with nothing else on it.

```markdown
Verdict: yes            <- or: no

## Blocking
- **Critical** — start every gap with its weight: `**Critical**`, `**High**` or `**Low**`.
  The loop reads these: a critical buys another round, a high buys one up to the fourth, a
  low buys none. An untagged gap is read as **High**, so tag the ones that are not.
  Critical: the demo cannot be shown, or it says something untrue. High: it can be shown but
  the case does not stand. Low: real, worth fixing, and not why you said no.
- Most serious first. Fixing all of these turns your no into a yes; if that is not true of an
  item, it belongs in the next section. Say what is wrong and what you would have to see
  instead — not how to build it.

## Would improve
- Real, worth doing, and not the reason for your verdict. Kept separate so the team can
  triage; a flat list of fifteen problems tells them nothing about which three to fix.

## What it gets right
- Briefly. Two or three lines. This is calibration, not encouragement: a review with nothing
  in this section is hard to trust, because it reads as a reviewer performing scepticism.

## Questions it failed to pre-empt
- The questions you had to ask that the deck or the product should have answered before you
  asked. An artefact that leaves its reader with these questions has a hole in it whether or
  not the answers exist.

## What I made of the product after driving it
- What you clicked, what you typed, what happened, and how many times. Include the things
  that worked and the things that did not. Where the running demo disagreed with the deck,
  say so here as well as at the top.
```

An empty `## Blocking` list under a verdict of `no` means the brief was not answered.

Indented bullets under a gap are read as that gap's evidence, not as further gaps — so put
your supporting detail under the finding it supports rather than beside it.
