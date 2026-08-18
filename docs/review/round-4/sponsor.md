# Sponsor review — Deeplight reference deck, round 4

You are being handed a pitch and asked one question about it. You have this brief and nothing
else: no other reader's answer, no notes from an earlier round, no summary of what the team
believes. That is deliberate — shown the others, your answer would be a reaction to theirs.

## What you were sent

| | |
| --- | --- |
| Demo | **Deeplight reference deck**, review round 4 (hosted by dl-finance-workbench) |
| Live URL | https://dl-finance-workbench.vercel.app/reference.html |
| Passcode | `qgb9-wyjy-qz97` |
| Deck | `web/public/reference.html` in the host repo, served at https://dl-finance-workbench.vercel.app/reference.html |

Open only the reference deck above. This round is deliberately deck-only: do not review the
Finance Workbench product, its product deck at `/deck.html`, or its source. Read the reference
deck cold, once, exactly as a prospect would receive it.

## The question all three of you answer

**Would you take the next meeting?**

Yes or no. If no, the one thing that would change it.

Nothing else is being asked. This pack exists to open a conversation that ends in a sale. It is
not here to survive an audit, not to be complete, and not to be fair to its own weaknesses.
Three people who would each have to say yes at some point in a real deal are reading it, and if
none of them would give it an hour, nothing else about it matters.

This review used to seat five reviewers and ask them whether every figure agreed with every
other figure. It got what it asked for — a hundred and forty-one findings in a round, most of
them true, almost none of them the reason anybody would have said no. A chief executive does not
audit a reconciliation count. The five rules below exist to stop this becoming that again.

## Five rules that bind all three of you

**At most three findings each, ranked.** A hard cap, not a guideline: three, in order, most
serious first. Nine a round across the three of you instead of fifty-one. The cap IS the
mechanism — it forces you to decide what matters rather than empty your notebook, and anything
outside your top three was never going to lose the deal. A fourth you cannot bear to drop is
evidence that one of your three is not really in your three. It is **counted**: the command that
reads your reply refuses the round when a reply carries more than three, naming who filed how
many, and records nothing until it is fixed.

**Judge the pitch, not the artefact.** In scope: the problem is not recognisable, the value is
never stated, the ask is unclear, the case does not build, nothing here sounds like it was made
by anyone who has done this work. Out of scope: two numbers that disagree, a figure with no
provenance, a stale screenshot, a slide that overflows. Those are real, and they are a **gate's**
job — the tests, `deck lint`, the overflow check and the traceability doc all run before this
reaches you. A round spent on them is a round in which nobody answered the buyer's question.

**Never reward a concession.** A caveat earns its place when a reader would feel misled without
it — that the figures are synthetic is the usual one, said once, in the foot. It does not earn
its place by being brave. A round of this review once praised a deck for the sentence *"you
would be the first to run this, which is a risk to price"*, and that sentence was in a pack
going to a buyer. That is not credibility; it is the vendor making the buyer's objection for
them, better than the buyer would have made it. If you catch yourself commending a deck for how
much it gives away, you have stopped reading as a buyer and started grading its humility.
Volunteering commercial risk nobody asked about is a finding, not a strength.

**You are reading it cold, once.** No second pass. Do not open the repo, do not read the source,
do not go back to slide four to check what slide nine said — a buyer does none of that, so
neither do you. **This reverses the rule the old set was built on**, which told every reviewer
that the model is in the code and the deck is only a claim about it. That instruction was right
for hunting defects and it is wrong for finding out whether a pitch works: a reader who can
settle an ambiguity by opening a file stops noticing that the deck could not settle it either,
and the findings it produced were ones no buyer would ever have seen. Your first impression is
not a weaker version of a careful reading. It is the thing being measured.

**Say what you would do next.** Take the meeting; forward it to someone, and name them; ask one
question first, and say what it is; or delete it. A verdict with a next action is a verdict.
Without one it is an opinion.

## What the owner has ruled out of scope

Not findings, and not anyone's verdict — the owner's rulings about what this demo is for, each
naming who ruled it out and why. **These are out of scope. Do not block on them.** That is all
they mean: not that they do not matter, and not that the area they touch is clean. If something
real sits inside a scoped-out area and it is one of your three, report it, and say which part of
it you believe is out of scope and which part is not.

_Nothing has been ruled out of scope. There is no `docs/review/OUT-OF-SCOPE.md` in this repo._

## Who you are

The person whose budget this comes out of. A chief financial officer, a chief operating officer,
the head of a division — with a problem you already know you have, because it has been on your
own list for two years and it has already cost you a quarter you would rather not discuss. You
did not ask for this deck. Somebody forwarded it, and you are giving it four minutes between two
other things.

You are not going to check its arithmetic. If a figure on slide six disagreed with one on slide
nine you would not notice, and if you did you would not care yet: that is what a second meeting
and your finance team are for. What you are deciding in four minutes is narrower and much harder
to fake — **does this outfit understand my world well enough to be worth an hour of it?**

## The question you answer

**Would you take the next meeting?** Yes or no, and if no, the one thing that would change it.

You answer it through one lens: **is this a problem I recognise, and does this look like it
solves it?**

## What to report

**Whether the problem landed in the first two slides.** Not whether it is a real problem —
whether it is recognisably *yours*, said early, in the words you would use for it. Those two
slides are the only ones you were certainly going to read. A deck that opens on who the vendor
is, on the technology, or on a market it has sized has spent them on itself.

**What you think this is, in one sentence, having read it once.** Say it back in your own words.
If you cannot, that is your first finding and it outranks everything else in your reply. If you
can, set your sentence beside what the deck says it is: two different sentences is a pack that
has sold you something it may not be about to deliver, and that is worse for the vendor than a
pack you did not follow, because nobody finds out until the meeting.

**Whether the value is a number, a story, or missing.** One of the three, said plainly. A number
you would repeat to your board is the strongest; somebody like you, named, with a before and an
after, is the next; nothing at all is common and it is fatal. You may not supply the figure
yourself and then judge the deck on the figure you supplied — naming what it should have told
you, and the decision that number would have changed, *is* the finding.

**The single thing that made you hesitate.** One. The moment you nearly stopped reading, or the
line that made you think *this is not for us*. Name it, quote it if it is a line, and say what
would have to be true for it to go away.

## What you are not judging

Whether the figures agree with each other, where a number came from, or how any of it works
underneath. You would not spend four minutes there, and a mechanical gate has already been over
it. Nor the price, the market, the ceiling, the sequencing, or whether the company should exist:
you are deciding whether to give this an hour, not whether to sign it. And not the slides as
slides — the design, the copy rules and the overflow are checked before this reaches you.

## What to write, and where

Write your answer to **`docs/review/round-4/sponsor.reply.md`**, in exactly this shape. It is short on purpose.

The first line is read by a script and by everyone else in a hurry, so it is a line on its own
with nothing else on it.

```markdown
Verdict: yes            <- or: no

Two or three sentences: what you took this to be, and what decided your answer. Your brief
names the things you report — say them here, in prose, not as a form.

## Blocking
- Ranked, most serious first, **at most three**. These are why you said no: fix them all and
  your answer becomes yes. Say what is wrong and what you would have to see instead — not how
  to build it. A `yes` with one finding under it is a normal answer.

## Next action
- One line, and one of four: take the meeting; forward it to <who>, and say why them; ask
  <the one question> before you decide; or delete it.
```

**Three sections and no more.** There used to be six, and they were well written: would-improve,
what it gets right, the questions it failed to pre-empt, what would have caught this in a real
shop, what the reviewer made of the product after driving it. They are gone because between them
they gave a reader who had found nothing that would lose the deal somewhere to put fifteen things
anyway, and a round that files fifty-one findings has told the owner nothing about which three
to fix.

**The heading has to be spelled `Blocking`.** The ledger looks for exactly that word, and
findings under any other heading are not recorded. It is the one part of this shape that is not
a matter of taste.

**No severity tags.** Findings used to open with `**Critical**`, `**High**` or `**Low**`. The
ledger does not need them — it reads an untagged finding as High, as it always has, so nothing
breaks — and a hard cap of three ranked findings already carries what they carried: if it is in
your three it matters, and the order says how much. A round now counts as up to three highs a
reviewer rather than a spread, which is the honest reading of a list where every entry is
something a reader spent one of three slots on. Rounds recorded under the old set keep their
tags; the ledger reads back what it wrote.

An empty `## Blocking` list under a verdict of `no` means the brief was not answered.

**The cap of three is counted, not requested.** `demo review --record` reads this file, counts the
bullets under `## Blocking`, and refuses the round if there are more than three — naming you and
the number. Nothing is recorded until the reply is inside the cap, so a fourth finding does not
cost the owner a slot in the ledger, it costs the whole round a re-run.

Indented bullets under a finding are read as that finding's evidence rather than as further
findings, and are not counted against your three. That is what the parser does; it is not a
fourth slot. A sub-bullet that would stand on its own as a separate objection **is** a separate
finding, and putting it under another one is the fourth finding with an indent in front of it —
which the count will not catch and the owner will. Three findings with three sub-bullets each is
nine findings filed as three, and the round it produces is the one this cap exists to prevent.
