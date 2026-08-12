/**
 * The shot manifest — what `deck shoot` photographs, and what `deck aspects` stamps into
 * the deck. It belongs to the demo, not to the kit: which pages are worth showing is the one
 * thing a screenshot tool cannot work out for itself.
 *
 * Run against a demo that is actually up:
 *
 *   pnpm dev                          # in another terminal
 *   pnpm deck:shoot                   # photograph the product
 *   pnpm deck:aspects                 # stamp each shot's true shape onto its frame
 *   pnpm deck:slides                  # render every slide to look at, and flag overflow
 *   pnpm deck:pdf                     # print it, one slide to one page
 *
 * **Use `pnpm dev`, not `pnpm start`, for this.** `shoot` writes the JPEGs into `public/`,
 * and `next start` reads that directory once at boot — so a production server started before
 * the shoot serves 404 for every image, `slides` renders a deck of broken frames, and
 * `aspects` has stamped correct ratios onto pictures nobody can see. The dev server reads
 * `public/` per request and has no such gap.
 *
 * With `DEMO_PASSCODE` set the demo is gated and every subcommand needs the cookie:
 * `GATE=1 pnpm deck:shoot`. Locally, with no passcode, there is no gate and no flag.
 *
 * Relative paths resolve against this file. Every shot declared here appears in the deck —
 * a manifest that photographs things no slide shows is a manifest nobody maintains.
 */

export default {
  base: 'http://localhost:3000',

  /* The sentinel, and it is not optional. Chrome's error page and the passcode gate both
     answer a `body` selector, so without a marker that only the product renders, a dead port
     or a moved route is photographed over a committed deck asset without a word. `#product`
     is the id on the product page's <main>. */
  root: '#product',

  out: 'public/shots',
  deck: 'public/deck.html',
  deckUrl: 'http://localhost:3000/deck.html',
  pdf: '../docs/deck/demo.pdf',

  /* Shooting a hosted demo means presenting the passcode cookie. Locally, with no
     DEMO_PASSCODE set, there is no gate and this is unused. */
  gateCookie: 'demo_gate',

  shots: [
    {
      /* Captured at roughly the width it is SHOWN at on the slide — about 1150px in a
         1600px-wide deck. A 1400px capture displayed in a 700px column puts the app's 13px
         type on the page at 6px, which is not type any more. */
      name: 'series',
      url: '/app?view=inner',
      w: 1100,
      h: 1000,
      sel: '#section-series',
      pad: 12,
    },
    {
      /* The phone, at its true logical viewport — the same number the tour's device window
         renders at, so a slide and the tour cannot disagree about what a phone shows. */
      name: 'phone',
      url: '/app?view=inner',
      w: 402,
      h: 781,
      sel: '#product',
      viewportOnly: true,
    },
  ],
};
