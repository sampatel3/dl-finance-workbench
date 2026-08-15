/*
 * The live embed — the deck's only script, and nothing depends on it.
 *
 * A frame declares a route and a viewport. The iframe is laid out at exactly that viewport —
 * so the app's own media queries resolve at the real width, which is the whole reason this is
 * an iframe and not a scaled picture — and then scaled to whatever width the frame has on the
 * slide.
 *
 * If the app is not reachable — the file opened from disk, the server down, the route moved,
 * the sentinel absent because Chrome served its own error page — the frame simply never goes
 * live and the captured still is what shows. That is the fallback, and it needs nobody to
 * remember to switch anything.
 */
(() => {
  const sentinel = document.querySelector('.deck')?.dataset.liveRoot ?? '';
  const live = sentinel.startsWith('[[') ? '' : sentinel;

  for (const frame of document.querySelectorAll('.frame[data-route]')) {
    const iframe = frame.querySelector('iframe');
    const route = frame.dataset.route ?? '';
    const [vw, vh] = (frame.dataset.viewport ?? '').split('x').map(Number);
    if (!iframe || !vw || !vh || route.startsWith('[[') || !location.protocol.startsWith('http')) {
      continue;
    }

    const fit = () => {
      iframe.style.width = `${vw}px`;
      iframe.style.height = `${vh}px`;
      iframe.style.transform = `scale(${frame.clientWidth / vw})`;
    };

    iframe.addEventListener('load', () => {
      /* Chrome's error page and a passcode gate both answer `body`, so a load is not proof the
         product is what loaded. Same guard `deck shoot` applies before it captures. */
      let doc;
      try {
        doc = iframe.contentDocument;
        if (!doc || (live !== '' && !doc.querySelector(live))) return;
      } catch {
        return; // cross-origin, which means it is not this demo
      }

      /* The other two halves of inert, and both need the document itself.

         `inert` on its root takes every control the product has out of the tab order: an
         iframe is focusable, its contents are reachable by keyboard, and `tabindex="-1"` on
         the frame only stops the frame taking a stop of its own. It goes on the embedded
         document rather than on the iframe or the .frame so the iframe's own `title` and the
         still's `alt` stay in the accessibility tree — an inert element is not exposed to a
         screen reader, and a frame nobody can read is not an improvement on a frame nobody
         can scroll.

         `overflow: hidden` is what stops it scrolling at all. The app is laid out at the
         frame's viewport and the page is usually taller than that, so without this the frame
         carries a scrollbar: something to drag, and a gutter that lays the app out narrower
         than the width the still was captured at. The scroll position the route's hash put it
         at is kept — this stops scrolling, it does not rewind it. */
      doc.documentElement.inert = true;
      doc.documentElement.style.overflow = 'hidden';

      fit();
      frame.dataset.render = 'live';
    });

    iframe.tabIndex = -1;
    new ResizeObserver(fit).observe(frame);
    iframe.src = route;
  }
})();

/*
 * The treatment control — the same two axes the product carries, on the deck.
 *
 * The product has had these toggles for a while and the deck has not, which meant the deck was
 * the one surface where a scheme had to be chosen by editing an attribute in the file. That is
 * backwards: the deck is the artefact you are most likely to be showing to somebody when you
 * discover it should have been in their colours.
 *
 * The two axes are the ones defined in deck.css, and they are independent: `data-style` picks
 * the design system, `data-scheme` picks the brand. Both go on `.deck`, which is the ancestor
 * of every slide — a scheme sets `--brand-*` and the ground blocks read those, so the deck
 * repaints from the attribute alone with no second copy of the palette anywhere.
 *
 * It is not in the PDF: `@media print` drops it, and `deck pdf` prints. So it is a thing you
 * can reach while presenting and never a thing that ships in the file you send afterwards.
 *
 * IT DELIBERATELY DOES NOT REMEMBER, and that is the important part.
 *
 * The first version saved the choice to localStorage and restored it on load. `deck shoot`,
 * `slides` and `pdf` all drive Chrome with a REUSED profile in tmpdir, and the restore ran
 * before every render — so rendering the Deeplight deck wrote "deeplight" into that profile,
 * and the next deck rendered came out in Deeplight no matter what its own file said. A deck's
 * committed `data-scheme` is its identity, and a control for presenting must not be able to
 * quietly repaint an exported PDF.
 *
 * So the file wins on every load, always. The toggle changes the live page and nothing else;
 * reload and you are back to what the deck actually is. To change a deck's scheme for good,
 * change the attribute — which is a diff somebody can review, unlike a value in a browser.
 */
(() => {
  const deck = document.querySelector('.deck');
  if (!deck || !location.protocol.startsWith('http')) return;

  const SCHEMES = ['default', 'deeplight', 'slate', 'signal', 'ember'];
  const STYLES = ['mesh', 'soft'];

  let scheme = deck.getAttribute('data-scheme') ?? SCHEMES[0];
  let style = deck.getAttribute('data-style') ?? STYLES[0];

  const apply = () => {
    deck.setAttribute('data-scheme', scheme);
    deck.setAttribute('data-style', style);
    for (const b of bar.querySelectorAll('[data-scheme-pick]')) {
      b.setAttribute('aria-pressed', String(b.dataset.schemePick === scheme));
    }
    for (const b of bar.querySelectorAll('[data-style-pick]')) {
      b.setAttribute('aria-pressed', String(b.dataset.stylePick === style));
    }
  };

  const bar = document.createElement('div');
  bar.className = 'deck-treat';
  bar.setAttribute('aria-label', 'Deck appearance');

  for (const s of SCHEMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'deck-sw';
    b.dataset.schemePick = s;
    /* The swatch paints ITSELF from the scheme it selects — the attribute goes on the button,
       so theme.css answers it there. A legend that cannot disagree with the palette. */
    b.setAttribute('data-scheme', s);
    b.title = s[0].toUpperCase() + s.slice(1);
    b.addEventListener('click', () => { scheme = s; apply(); });
    bar.append(b);
  }

  const sep = document.createElement('span');
  sep.className = 'deck-treat-sep';
  bar.append(sep);

  for (const s of STYLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'deck-st';
    b.dataset.stylePick = s;
    b.textContent = s;
    b.addEventListener('click', () => { style = s; apply(); });
    bar.append(b);
  }

  document.body.append(bar);
  apply();
})();
