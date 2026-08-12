# @kestrel/model

The fact store and the world in it. The bottom layer: it knows what is true and nothing about how it
is shown — no formatting, no measure definitions, no analysis, no React.

## The grain

One numeric table. Every figure the product shows resolves to a query over it.

```
entityId · accountId · month · scenario · versionId · costCentreId · segmentId · vintageId
  → amountMinor (signed integer)   quantity (units, or null)
```

Five rules do most of the work, and each is a defect the file exists to make impossible.

1. **Amounts are signed integers in minor units.** A balance sheet that reconciles to the penny
   across five entities and four currencies cannot be built on binary fractions.
2. **A null dimension is the aggregate, and a different row from its children.** So a query for an
   entity total filters on `costCentreId === null`, and no caller can sum both levels. Omitting the
   dimension returns *both*, which is loudly wrong rather than quietly wrong.
3. **`quantity` sits beside `amountMinor`.** Without a volume on the same row, a variance can only
   ever be a delta — price, volume and mix are not derivable from money alone.
4. **Nothing is updated in place.** A correction is a new vintage; the old rows stay, and
   `asOfVintage` reads the world as it stood when somebody approved a figure.
5. **A missing month returns `null`, never `0`.** A product that renders them identically will
   eventually tell a chief financial officer their cash is zero.

## Basis

Each account declares one, and it is the single rule that makes a month, a quarter, a half-year and
a year all correct out of one table:

| Basis | Over a window | Examples |
| --- | --- | --- |
| `flow` | Summed across the months | revenue, cost, tax |
| `balance` | Read at the last month present | cash, debt, equity |
| `avg_balance` | Averaged across the months present | the denominators |

Get it wrong and a quarterly comparison sums three closing cash balances into one number that looks
exactly like a number.

## Currency

Three of them — transaction, functional, presentation — and IAS 21 translation between the last two:
balance sheet at the closing rate, profit and loss at the average rate, and the residual to the
**cumulative translation reserve** inside equity. A model whose reserve is always zero has quietly
stopped translating; a model that translates at two rates without carrying the reserve does not
balance. `identity.test.ts` asserts against both failures.

`constant` currency is the same translation run at the comparative period's rates. That is the whole
mechanism: the rate is a parameter, not a lookup.

## The world

**Kestrel Industrial Group** — five entities, four currencies, 43 closed months to July 2026,
generated month by month from one seed string. It does not exist.

The group consolidates in July 2026 to the four figures on the client's concept slide — revenue
£12.4m, gross margin 41.8%, EBITDA £2.1m, cash £4.8m — as computed results. `world.test.ts` asserts
they still print that way, and asserts that a different seed produces different ones, so a headline
figure cannot quietly become a literal.

Twelve conditions are planted so the analysis has something true to find. Each is marked `PLANTED n`
at the line of arithmetic that causes it. The **healthy twin** (`buildHealthyWorld`) is the same
group from a second seed with none of them present, and its job is to prove the detectors stay quiet:
a detector proven only to fire is half-proven.

## What holds it together

```
pnpm --filter @kestrel/model test
```

- assets = liabilities + equity, **to the penny**, every entity, every month, and consolidated
- segments sum exactly to revenue; cost centres sum exactly to the entity
- the same seed builds an identical world twice
- constant currency moves the euro and dollar entities and not the dirham-pegged one
- the intercompany reconciliation is clean in every month but the one where a break is planted
- the healthy twin has no break, no restatement, no unmapped account
