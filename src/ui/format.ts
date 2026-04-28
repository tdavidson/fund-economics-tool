/**
 * Formatting helpers shared across components. Match the Hemrock
 * design-system conventions: monospace tabular numbers, compact $/% rendering.
 */

export type Scale = 'units' | 'thousands' | 'millions' | 'billions';

export interface DisplayOptions {
  /** Currency symbol or label, e.g. "$" or "€" or "USD". Default "$". */
  currency?: string;
  /** Scale hint. Default 'units' (raw values); any other value triggers
   *  auto-picking the best unit per value (k / MM / B). */
  scale?: Scale;
}

const SCALE_DIVISOR: Record<Scale, number> = {
  units: 1,
  thousands: 1_000,
  millions: 1_000_000,
  billions: 1_000_000_000,
};

const SCALE_SUFFIX: Record<Scale, string> = {
  units: '',
  thousands: 'k',
  millions: 'MM',
  billions: 'B',
};

/**
 * Pick the best display scale for a given value. When the caller's mode is
 * 'units', values stay raw. Otherwise the scale is chosen per value so a
 * $25MM fund reads as "$25MM" but $150k in expenses reads as "$150k"
 * rather than "$0.15MM".
 *
 * For a zero value we fall back to the caller's preferred scale so the unit
 * hint is still visible (e.g. an empty mgmt-fee field in millions mode
 * displays "0 MM", letting the user know their input will be scaled).
 */
export function pickDisplayScale(value: number, mode: Scale): { divisor: number; suffix: string } {
  if (mode === 'units') return { divisor: 1, suffix: '' };
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return { divisor: 1_000_000_000, suffix: 'B' };
  if (abs >= 1_000_000) return { divisor: 1_000_000, suffix: 'MM' };
  if (abs >= 1_000) return { divisor: 1_000, suffix: 'k' };
  if (abs === 0) {
    return { divisor: SCALE_DIVISOR[mode], suffix: SCALE_SUFFIX[mode] };
  }
  return { divisor: 1, suffix: '' };
}

export function formatMoney(n: number, opts: DisplayOptions & { compact?: boolean } = {}): string {
  if (!Number.isFinite(n)) return '—';
  const currency = opts.currency ?? '$';
  const scale = opts.scale ?? 'units';

  // Auto-pick when the caller has a non-units scale OR explicitly asks for compact.
  const useAutoPick = scale !== 'units' || !!opts.compact;

  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (!useAutoPick) {
    return `${sign}${currency}${Math.round(abs).toLocaleString('en-US')}`;
  }

  if (abs >= 1_000_000_000) return `${sign}${currency}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${currency}${(abs / 1_000_000).toFixed(1)}MM`;
  if (abs >= 1_000) return `${sign}${currency}${(abs / 1_000).toFixed(0)}k`;
  return `${sign}${currency}${Math.round(abs).toLocaleString('en-US')}`;
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
