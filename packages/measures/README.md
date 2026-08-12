# @kestrel/measures

The certified measure catalogue, and the drill spine. The middle layer: it reads the model and knows
nothing about the app — no React, no routes, and no formatting decisions beyond the one place
formatting happens.

## The catalogue is the semantic layer

Every measure is declared once, with its formula in words, its unit, its polarity, its owner and its
approval state. Two things read it, and the second is the point:

- the **product**, so a figure on the executive surface and the same figure in the analyst grid are
  one computation rather than two that agree today;
- the **model**, through the chat's tools, so a question about gross margin is answered from the
  definition Finance approved rather than from whatever the model believes gross margin is.

A product where the report is governed and the assistant is not has two versions of the truth, and
the plausible one is on the screen the executive is looking at.

One measure is deliberately `draft`: pipeline coverage comes from the CRM's own weighting and nobody
in Finance owns it yet. A catalogue where everything is approved is a catalogue nobody read.

## The drill spine

A measure definition cannot reach the store. It is handed a `get` and nothing else, so every account
it touches is recorded on the way past — value, months used, row count, contributing loads, and the
same figure per entity. Lineage, the formula popover, the analyst drill and AI traceability are then
one object seen from four places rather than four features that will eventually disagree.

Two paths in, and the difference is on the result so nothing downstream can blur it:

| Path | When | `consolidated` |
| --- | --- | --- |
| Consolidated | no segment or cost-centre filter — translates, eliminates matched intercompany trade, carries the reserve | `true` |
| Sliced | a segment or cost centre is named — translates, no elimination | `false` |

A ratio's entity breakdown is the ratio **recomputed** per entity, never the numerator's share
apportioned: splitting a group gross margin by revenue gives every entity the group's margin, which
is confidently wrong.

## Comparators

Five, and one of them is not like the others.

| Comparator | How | May raise a board item |
| --- | --- | --- |
| Prior period | the preceding window of the same length | yes |
| Prior year | the same window twelve months back, same length | yes |
| Budget | the same window, approved budget version | yes |
| Forecast | the same window, a named forecast version | yes |
| **Trend** | a least-squares line through the 12 months **before** the window | **no** |

Trend is a fit, not a lookup. Its derivation is a choice, so it is stated once, labelled as an
expectation wherever it appears, and excluded from materiality — a comparator nobody can reproduce
should not put something in front of a chief financial officer. It also cannot see seasonality, which
is a second reason and is asserted as expected behaviour rather than filed as a bug.

## Polarity, not sign

`favourable` comes from the measure's own polarity. A cost that rose is a positive movement and
unfavourable news; a product that colours by sign prints a rising expense in the same green as rising
income. A movement in a percentage is expressed in basis points, because "margin fell 2.6%" is
ambiguous between 2.6 points and 2.6% of 41.8% and the two differ by a factor of forty.

## Materiality

A versioned, owned policy object with **two** thresholds, both of which must be cleared. Either alone
fails predictably: relative-only makes every small account scream, absolute-only hides a large miss on
a small line. Every verdict carries its reason, including the negative ones — "why is this *not* on
the list?" is a question somebody asks.

## What holds it together

```
pnpm --filter @kestrel/measures test
```

- a half-year flow equals its two quarters; a half-year balance is the closing month, not a sum
- days sales outstanding reads **average** receivables and the window's **actual** days, proved from
  the recorded inputs rather than from the value
- a cost that rose is unfavourable
- the recorded inputs reproduce the figure they were recorded for
- a count is never translated, so the group has a whole number of people
- trend cannot raise a board item; the same variance against a real plan can
- a missing figure formats as `—`, and a genuine zero formats as `£0.00`
