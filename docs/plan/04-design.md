# Design

The visual language is the [Deeplight design system](https://deeplight.ae), not a scheme invented for
this demo. This document records the decisions made in applying it — the places where a product
surface needs something the brand system does not say, and the places where the brand and the
demo-kit template disagreed and one of them had to give.

The values live in `web/app/globals.css`, expressed in the token names `@demo-kit/shell` reads, so the
tour furniture and the product share one system rather than two.

## What the brand fixes, and is not re-argued here

Dark-first near-black surfaces. One amber accent, `#F2A900`, reserved for action. Sentence-case
grotesk headings, tightly tracked, no uppercase display. 4px on controls and 8px on cards, no pills.
Flat: depth comes from surface lightness plus a hairline, never a shadow. Numbers lead. Restrained
motion — an opacity dip or a 2px translate. No gradients, no emoji, no hype.

## The decisions

### 1. Dark is the product; light is paper

The brand's light palette is scoped, in its own words, to "documents and print only". The kit gives a
demo two treatments chosen by a cookie read on the server, and its convention is that **light** is the
bare page and dark adds a class — because a stylesheet naming both treatments in every rule states
every colour twice and drifts the first time one is edited.

Both are right, so this demo inverts which one is bare: `:root` is the product's dark treatment and
`.skin-light` is the paper one, for a reader about to print a board pack.

Two consequences, handled in `web/app/layout.tsx` rather than by changing the kit — light-as-default is
correct for every other demo:

- The raw cookie is read instead of `resolveSkin`, because that helper folds "no cookie" and "cookie
  says light" into one answer, and here they differ: an unset preference must mean the product's own
  treatment.
- The class is rendered onto `<body>` on the server instead of through `SkinBody`. That component
  mirrors the treatment in a layout effect, which is right when the class is `skin-dark` — but the only
  class it can add is `skin-dark`, so in paper mode every portalled surface would have stayed dark.

### 2. Amber is interactive; direction gets the GO/NO-GO pair

The brand asks for one amber highlight per screen and treats amber as the action colour. A finance
product needs more than that: a figure can be favourable or adverse, and without colour a reader has
to read every number to find the bad one.

The brand reserves green and red for GO/NO-GO decisions, which is the same shape of judgement, so
`--pos` and `--neg` take `--dl-success` and `--dl-danger`. Amber then stays strictly interactive —
links, the active control, the primary button, a finding's action — and **never lands on a value**. A
palette where the accent also means "good" cannot say "this good thing is clickable".

Priority chips carry no colour at all, for the same reason: the board an item sits on already says
whether it is good news, and a red chip on the favourable board would be the colouring-by-sign error
one level up.

### 3. Data is mono; prose is not

The kit's template argued figures should be set in the text face with tabular numerals, because "a
reader scanning eight figures wants them to read as money" rather than as engineering output.

That is right for eight figures on a card and wrong for this product, which puts columns of figures
next to each other — an entity table, a segment table, a bridge's labels, a finding's evidence. A mono
face makes a column scan. The brand agrees: it lists mono for "data values, annotations, technical
badges". So `--ff-mono` is JetBrains Mono and carries every value, axis tick, owner and threshold;
prose and headings stay proportional.

### 4. Fonts are self-hosted

The brand system specifies them as a Google Fonts `@import`; this uses `next/font`. An `@import` is
render-blocking, leaks a request to a third party from a page shown in a client meeting, and — the one
that would have bitten — the deck tooling screenshots a locally served build, so a font fetched at
render time may not have arrived when the shutter falls, producing slides set in the fallback face.

### 5. Sections get real headings

The template styled a section title as an 11px uppercase grey eyebrow. That is a label, not a heading,
and a page whose every line sits between 11px and 14px gives a reader no hierarchy to use — which is
most of why the first build read as thin regardless of its palette. Section titles are now the display
face at 26px, sentence case; headline figures are 40px. The brand's rule is that numbers lead, and the
figures had been smaller than the headings should have been.

### 6. The period selector is a stepper

Twelve month chips was the widest thing on the page and pushed the controls to four stacked rows: a
reader met a wall of dates before a figure, and the controls were louder than the content they
controlled. It is now two links and the window they move — which is also how somebody moves through
months, one at a time. The ends render as dead arrows rather than disabled links, because a link that
cannot be followed is a control that has to explain itself.

Every selector remains a **link** rather than a `<select>`. The view lives in the URL, so a control
that needs client JavaScript to navigate is a control that can disagree with the address bar.

## Accepted weaknesses

- **The brand's licensed family is unverified.** `colors_and_type.css` flags it: Inter Tight, Inter and
  JetBrains Mono are Google Fonts stand-ins for the live stack. Swap when the real family is known.
- **The bridge's axis is truncated.** Documented in `web/components/Waterfall.tsx` and disclosed on the
  chart itself, with the floor labelled and the terminals drawn as level markers rather than columns. A
  zero-based axis made every contribution a two-pixel sliver; a truncated one with columns made two
  figures 5% apart look like a tripling. Markers on a labelled truncated axis is the honest third
  option, and it is still a chart a reader has to read the floor label to interpret.
- **The logo is type, not the asset.** `assets/logo_white.png` is the relaunch lockup and the mark here
  is a 30px amber `DL` square. A demo's mark should be type per the kit's own convention, and the real
  lockup is wider than the masthead's first column. Worth revisiting with the vector original.
- **Only two surfaces are styled.** Waves 5–7 add the analyst, governance and controls surfaces, and
  each will need components this stylesheet does not yet have.
