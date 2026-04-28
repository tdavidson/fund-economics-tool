import type { FundResult } from '../types.js';
import { formatMoney, type DisplayOptions } from './format.js';

interface Props {
  result: FundResult;
  display?: DisplayOptions;
}

interface Row {
  label: string;
  get: (r: FundResult) => { total: number; lp: number; gp: number };
  /** Indented sub-row ("less X" / "plus X"). Muted styling. */
  sub?: boolean;
  /** Hide this row when the predicate is true (e.g. recycling rows when 0). */
  hideWhen?: (r: FundResult) => boolean;
}

const ROWS: Row[] = [
  {
    label: 'Committed Capital',
    get: (r) => r.committedCapital,
    // Only render when called diverges from committed (solve-from-deployment
    // mode). In the default mode the two are identical — one row suffices.
    hideWhen: (r) =>
      Math.abs(r.calledCapital.total - r.committedCapital.total) < 0.5,
  },
  { label: 'Called Capital (Paid in Capital)', get: (r) => r.calledCapital },
  { label: 'less Management Fees', sub: true, get: (r) => r.managementFees },
  { label: 'less Fund Expenses', sub: true, get: (r) => r.partnershipExpenses },
  {
    label: 'plus Recycled Capital',
    sub: true,
    get: (r) => r.recycledCapital,
    hideWhen: (r) => r.recycledCapital.total <= 0,
  },
  { label: 'Invested Capital', get: (r) => r.investedCapital },
  { label: 'Proceeds', get: (r) => r.proceeds },
  {
    label: 'less Recycled Capital',
    sub: true,
    get: (r) => r.recycledCapital,
    hideWhen: (r) => r.recycledCapital.total <= 0,
  },
  { label: 'Carried Interest Paid', get: (r) => r.carriedInterestPaid },
  { label: 'Carried Interest Earned', get: (r) => r.carriedInterestEarned },
  { label: 'Distributions', get: (r) => r.distributions },
];

/**
 * Summary of the fund: Total Fund / LP Only / GP Only columns.
 * Flow-style layout — main totals on their own rows, flanked by indented
 * "less X" / "plus X" lines showing what's deducted or added.
 */
export function FundSummaryTable({ result, display }: Props) {
  return (
    <div className="overflow-x-auto border border-border rounded-sm">
      <table className="min-w-full text-xs md:text-[13px]">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs">Summary</th>
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs text-right">Total Fund</th>
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs text-right">LP Only</th>
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs text-right">GP Only</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.filter((row) => !row.hideWhen?.(result)).map((row) => {
            const cells = row.get(result);
            const labelClass = row.sub
              ? 'pl-10 text-muted-foreground'
              : 'text-foreground font-medium';
            const valueClass = row.sub
              ? 'text-muted-foreground'
              : 'text-foreground font-medium';
            return (
              <tr key={row.label} className="border-b last:border-0 hover:bg-muted/50">
                <td className={`px-4 py-2 ${labelClass}`}>{row.label}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${valueClass}`}>
                  {formatMoney(cells.total, display)}
                </td>
                <td className={`px-4 py-2 text-right tabular-nums ${valueClass}`}>
                  {formatMoney(cells.lp, display)}
                </td>
                <td className={`px-4 py-2 text-right tabular-nums ${valueClass}`}>
                  {formatMoney(cells.gp, display)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
