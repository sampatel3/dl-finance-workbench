# Deck review — dl-finance-workbench, round 1

You are reviewing a product demo, adversarially. You have this brief and nothing else: no
other reviewer's findings, no notes from earlier rounds, no summary of what the team believes.
That is deliberate — if you were shown the others, your verdict would be a reaction to theirs.

## What you are reviewing

| | |
| --- | --- |
| Demo | **dl-finance-workbench**, review round 1 |
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

The person the deck is aimed at, reading it alone, with nobody in the room to explain it. You
have been handed it and nothing else. You did not attend the meeting where it was presented,
you cannot ask its author what a slide meant, and you will make up your mind before anyone
offers to walk you through it.

**You are the one reviewer who does not open the product.** Do not follow the URL in the
coordinates above. Everyone else on this round drives the demo, and their answers are
inseparable from having driven it — which is precisely why the deck has never been judged as
the thing it actually is: an argument that has to stand up on its own, in an inbox, after the
call.

## The question you answer

**Having read only this deck, do you know what is being asked of you, and would you say yes?**

Yes or no.

## What to press on

**The argument, read headline to headline.** Read only the headlines, in order, and write down
the argument they make. That is what a skimming reader gets, and most readers skim. If the
headlines are topic labels — "The engagement model", "Our approach", "Next steps" — say so:
a headline that names the subject instead of stating the claim makes the reader read the slide
to find out what they are looking at, which is the opposite of what a headline is for.

**The section and its headline.** Every slide carries a section name. That name is a question
— **The Cost** asks what it costs, **The Risks** asks which ones stand, **Traction + Proof**
asks what the evidence is — and the headline under it has to answer THAT question. Flag every
one that answers a different question, or none.

**The ask.** What are you being asked for, concretely? What would you be signing off on: what
does a yes commit to, what would it take to reach production, what does it land on first? An
ask that gives only a verdict, or only a cost, has withheld the thing you are there to weigh.

**Unsupported claims.** Take the three strongest claims in the deck and find what backs each.
A figure with no source, a comparison with no baseline, a capability with no evidence it
exists — name them. The deck is a claim about a product you cannot see; that is the whole
reason you were asked not to open it.

**What is missing.** What question did you finish the deck still holding? A deck that leaves
its reader with an obvious question has a hole in it whether or not the answer exists
somewhere.

## What you are not judging

Slide copy rules, overflow, spelling and the design system are checked mechanically by `deck
lint` and `deck slides` before you ever see it. Do not spend your round there. You are judging
whether the argument is any good — nothing else in this loop does.

## What to write, and where

Write your answer to **`docs/review/round-1/deck.reply.md`**, in exactly this shape.

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
