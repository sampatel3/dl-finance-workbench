import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const productDeck = resolve(here, '../public/deck.html');
const companyDeck = resolve(
  here,
  '../../vendor/demo-kit/packages/deck/standard/deeplight/company.html',
);

const sharedDeeplightCopy = [
  'Case Study 01 &middot; Banking',
  'Case Study 02 &middot; Energy',
  '2,000+ users',
  '3 models live',
  'Senior accountability. Squad delivery.',
  'Three programmes, chosen by what you already know',
  'Eight weeks &middot; when the roadmap does not exist yet',
  'From $185K &middot; gate outcome: proceed, rescope or stop',
  'Time and materials &middot; when the programme already exists',
  'Bring one problem.<br>Leave with a written verdict.',
  'Fit verdict &middot; recommended route &middot; first scope &middot; success measure &middot; next step',
];

describe('Finance Workbench deck alignment', () => {
  it('keeps copied Deeplight company language aligned to the reference deck', async () => {
    const [product, company] = await Promise.all([
      readFile(productDeck, 'utf8'),
      readFile(companyDeck, 'utf8'),
    ]);

    for (const copy of sharedDeeplightCopy) {
      expect(product, `product deck is missing: ${copy}`).toContain(copy);
      expect(company, `company deck is missing: ${copy}`).toContain(copy);
    }
  });
});
