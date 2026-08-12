# Dl Finance Workbench — build plan

**A promise until it is a record.** This file is written before the work, which makes it the
weaker kind of document. What converts it: every change lands as a PR whose description says
where reality differed from this plan, and the last wave rewrites all four of these docs to
match what was actually built — filling the "Defects found and fixed" section of
`02-verification.md`, which is empty today. **An empty findings section means verification
has not happened.**

The convention is inherited from demo-kit, which inherited it from the demo before that.
Keeping it costs an hour per wave and is the only reason anyone can answer "why is it like
this?" six months later.

## What is being built

<One paragraph. What a visitor sees, who they are, and what the demo is claiming. Then one
sentence on what it is NOT, because that sentence is what stops a demo becoming a promise.>

## The data

<Where the figures come from. If they are generated — and in the memory tier they are — say
so here and say it on the gate page too. Name the seed, the entities, the period, and the
conditions deliberately planted in it. Name the healthy fixture and what it proves.>

## Waves

### Wave 0 — <name>

**Owns** <paths> · **After** <nothing | wave n>

**Why.** <What this unblocks.>

**How.** <What is built, in enough detail that someone else could build it.>

**Gate.** <A command and its expected result. If it cannot be checked mechanically, the wave
is not done.>

## Ground rules

- One branch, one PR, CI green before merge.
- A wave owns the paths listed under **Owns** and may not touch another wave's.
- `pnpm-lock.yaml` conflicts are resolved by re-running `pnpm install`, never by hand.
- Every PR description records deltas from this plan.

## What is not built

<The list that keeps scope honest. Anything a reader might reasonably assume is here and is
not — say it here rather than letting them find out in a meeting.>
