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
