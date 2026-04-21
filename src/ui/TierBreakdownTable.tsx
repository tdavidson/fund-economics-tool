import type { FundResult } from '../types.js';
import { formatMoney, formatPct, formatMultiple, formatNumber } from './format.js';

interface Props {
  result: FundResult;
}

/**
 * Per-tier breakdown: share of invested capital, #investments, exit multiple,
 * hold, proceeds, share of proceeds. Helps the viewer see how the headline
 * multiple comes together from the power-law return tiers.
 */
export function TierBreakdownTable({ result }: Props) {
  return (
    <div className="overflow-x-auto border border-border rounded-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs">Tier</th>
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs text-right">% of invested</th>
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs text-right"># investments</th>
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs text-right">Multiple</th>
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs text-right">Hold (yrs)</th>
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs text-right">Proceeds</th>
            <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs text-right">% of proceeds</th>
          </tr>
        </thead>
        <tbody>
          {result.tiers.map((tier) => (
            <tr key={tier.name} className="border-b last:border-0 hover:bg-muted/50">
              <td className="px-4 py-2 text-foreground capitalize">{tier.name}</td>
              <td className="px-4 py-2 text-right tabular-nums text-foreground">{formatPct(tier.pctOfCapital, 0)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-foreground">{formatNumber(tier.numInvestments, 1)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-foreground">{formatMultiple(tier.multiple, 1)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{tier.holdingPeriodYears}</td>
              <td className="px-4 py-2 text-right tabular-nums text-foreground">{formatMoney(tier.proceeds, { compact: true })}</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatPct(tier.pctOfProceeds, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
