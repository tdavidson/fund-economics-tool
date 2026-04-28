import type { FundResult } from '../types.js';
import { formatMoney, formatPct, formatMultiple, formatNumber, type DisplayOptions } from './format.js';

interface Props {
  result: FundResult;
  display?: DisplayOptions;
  /** When false, round # investments to whole numbers in the display. */
  fractional?: boolean;
}

/**
 * Per-tier breakdown: share of invested capital, #investments, exit multiple,
 * hold, proceeds, share of proceeds. Helps the viewer see how the headline
 * multiple comes together from the power-law return tiers.
 */
export function TierBreakdownTable({ result, display, fractional = true }: Props) {
  const numDigits = fractional ? 1 : 0;
  const totalPctOfCapital = result.tiers.reduce((s, t) => s + t.pctOfCapital, 0);
  const totalInvestments = result.tiers.reduce((s, t) => s + t.numInvestments, 0);
  const totalProceeds = result.tiers.reduce((s, t) => s + t.proceeds, 0);
  const totalPctOfProceeds = result.tiers.reduce((s, t) => s + t.pctOfProceeds, 0);
  const weightedMultiple = result.tiers.reduce((s, t) => s + t.weightedMultiple, 0);
  const weightedHold = result.weightedHoldPeriodYears;

  return (
    <div className="overflow-x-auto border border-border rounded-sm">
      <table className="min-w-full text-xs md:text-[13px]">
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
              <td className="px-4 py-2 text-right tabular-nums text-foreground">{formatNumber(tier.numInvestments, numDigits)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-foreground">{formatMultiple(tier.multiple, 1)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{tier.holdingPeriodYears}</td>
              <td className="px-4 py-2 text-right tabular-nums text-foreground">{formatMoney(tier.proceeds, display)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatPct(tier.pctOfProceeds, 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-foreground/20 bg-muted/30">
            <td className="px-4 py-2 text-foreground font-medium uppercase tracking-widest text-xs">Total</td>
            <td className="px-4 py-2 text-right tabular-nums text-foreground font-medium">{formatPct(totalPctOfCapital, 0)}</td>
            <td className="px-4 py-2 text-right tabular-nums text-foreground font-medium">{formatNumber(totalInvestments, numDigits)}</td>
            <td className="px-4 py-2 text-right tabular-nums text-foreground font-medium" title="Weighted average gross multiple">{formatMultiple(weightedMultiple, 2)}</td>
            <td className="px-4 py-2 text-right tabular-nums text-foreground font-medium" title="Proceeds-weighted average hold period">{weightedHold.toFixed(1)}</td>
            <td className="px-4 py-2 text-right tabular-nums text-foreground font-medium">{formatMoney(totalProceeds, display)}</td>
            <td className="px-4 py-2 text-right tabular-nums text-foreground font-medium">{formatPct(totalPctOfProceeds, 0)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
