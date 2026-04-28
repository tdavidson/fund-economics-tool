import type { FundResult } from '../types.js';
import { formatMultiple, formatPct } from './format.js';

interface Props {
  result: FundResult;
}

interface Row {
  label: string;
  get: (r: FundResult) => { total: number; lp: number; gp: number };
  format: (n: number) => string;
}

const ROWS: Row[] = [
  { label: 'Gross multiple', get: (r) => r.grossMultiple, format: (n) => formatMultiple(n) },
  { label: 'Net multiple', get: (r) => r.netMultiple, format: (n) => formatMultiple(n) },
  { label: 'Gross IRR (estimated)', get: (r) => r.grossIRR, format: (n) => formatPct(n) },
  { label: 'Net IRR (estimated)', get: (r) => r.netIRR, format: (n) => formatPct(n) },
];

/**
 * Returns / multiples block. Rendered as a separate table so it can sit
 * below the summary with a gap, matching the screenshot layout.
 */
export function FundReturnsTable({ result }: Props) {
  return (
    <div className="overflow-x-auto border border-border rounded-sm">
      <table className="min-w-full text-xs md:text-[13px]">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs">Returns</th>
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
                <td className="px-4 py-2 text-foreground">{row.label}</td>
                <td className="px-4 py-2 text-right tabular-nums text-foreground">{row.format(cells.total)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-foreground">{row.format(cells.lp)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-foreground">{row.format(cells.gp)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
