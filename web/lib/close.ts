/** Finance-native close status copy shared by every completeness banner. */
export interface CloseStatusCopy {
  readonly summary: string;
  readonly detail?: string;
  readonly final: boolean;
}

export function closeStatusCopy({
  closed,
  total,
  openNames,
}: {
  readonly closed: number;
  readonly total: number;
  readonly openNames: readonly string[];
}): CloseStatusCopy {
  const final = total > 0 && closed === total && openNames.length === 0;
  const noun = total === 1 ? 'ledger' : 'ledgers';
  const summary = `${closed}/${total} ${noun} closed — period ${final ? 'final' : 'not final'}.`;

  if (final || openNames.length === 0) return { summary, final };

  return {
    summary,
    detail:
      `Outstanding: ${openNames.join(', ')} ` +
      `${openNames.length === 1 ? 'has' : 'have'} submitted but not closed.`,
    final,
  };
}
