/**
 * Formatting helpers shared across components. Match the Hemrock
 * design-system conventions: monospace tabular numbers, compact $/% rendering.
 */

export function formatMoney(n: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (opts.compact) {
    if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  }
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

export function formatPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatMultiple(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}x`;
}

export function formatNumber(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
