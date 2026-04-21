import type { FundResult } from '../types.js';
import { formatMoney } from './format.js';

interface Props {
  result: FundResult;
}

interface Row {
  label: string;
  get: (r: FundResult) => { total: number; lp: number; gp: number };
  /** Indented sub-row (e.g. "of which recycled"). */
  sub?: boolean;
}

const ROWS: Row[] = [
  { label: 'Called capital (paid in capital)', get: (r) => r.calledCapital },
  { label: 'Management fees', get: (r) => r.managementFees },
  { label: 'Partnership expenses', get: (r) => r.partnershipExpenses },
  { label: 'Invested capital', get: (r) => r.investedCapital },
  { label: 'of which recycled', sub: true, get: (r) => r.recycledCapital },
  { label: 'Proceeds', get: (r) => r.proceeds },
  { label: 'Preferred return', get: (r) => r.preferredReturn },
  { label: 'GP catchup', get: (r) => r.gpCatchup },
  { label: 'Carried interest paid', get: (r) => r.carriedInterestPaid },
  { label: 'Carried interest earned', get: (r) => r.carriedInterestEarned },
  { label: 'Distributions', get: (r) => r.distributions },
];

/**
 * Summary of the fund: Total Fund / LP Only / GP Only columns.
 * Matches the Hemrock Fund Economics screenshot layout.
 */
export function FundSummaryTable({ result }: Props) {
  return (
    <div className="overflow-x-auto border border-border rounded-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs">Summary</th>
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs text-right">Total Fund</th>
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs text-right">LP Only</th>
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs text-right">GP Only</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const cells = row.get(result);
            return (
              <tr key={row.label} className="border-b last:border-0 hover:bg-muted/50">
                <td className={`px-4 py-2 text-foreground ${row.sub ? 'pl-10 text-muted-foreground' : ''}`}>
                  {row.label}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-foreground">{formatMoney(cells.total)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-foreground">{formatMoney(cells.lp)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-foreground">{formatMoney(cells.gp)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
