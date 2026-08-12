# The deck

`pnpm deck:pdf` writes `demo.pdf` here, printed from `web/public/deck.html` at 1600×900 so
one slide is exactly one page.

**Commit the PDF once the demo's content is real.** It is an artefact a reader is given
rather than a build product, and a deck that only exists on the machine that made it is a
deck nobody can send. Its page count should equal the deck's slide count; if it does not,
`deck pdf` printed something other than the deck.

The screenshots inside it are not committed — `web/.gitignore` excludes `public/shots/` —
because every one of them is reproducible with `pnpm deck:shoot` against the running demo,
and a committed screenshot is a screenshot that goes stale without anyone noticing.
