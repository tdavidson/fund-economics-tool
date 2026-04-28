import type { FundResult } from '../types.js';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatMoney, type DisplayOptions } from './format.js';

interface Props {
  result: FundResult;
  display?: DisplayOptions;
}

/**
 * Color ramp for tier bars. Same palette as FundCapitalFlowChart for visual
 * consistency — gray for writeoffs, warmer tones as tier returns climb.
 */
const TIER_COLORS = ['#94a3b8', '#60a5fa', '#3b82f6', '#8b5cf6', '#6d28d9'];
const colorFor = (i: number) => TIER_COLORS[Math.min(i, TIER_COLORS.length - 1)];

/**
 * Side-by-side bar charts of per-tier investment counts and proceeds. Colors
 * mirror the Capital Flow chart so readers can cross-reference tiers at a
 * glance. Bars skip zero-value entries to keep the chart from going blank.
 */
export function InvestmentOutcomesChart({ result, display }: Props) {
  const countData = result.tiers.map((t, i) => ({
    outcome: t.name,
    count: Math.round(t.numInvestments),
    color: colorFor(i),
  }));
  const proceedsData = result.tiers.map((t, i) => ({
    outcome: t.name,
    proceeds: t.proceeds,
    color: colorFor(i),
  }));

  const tooltipStyle: React.CSSProperties = {
    fontSize: 12,
    backgroundColor: 'hsl(var(--background))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 2,
    color: 'hsl(var(--foreground))',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
          Investments by outcome
        </p>
        <div style={{ width: '100%', height: 192, minHeight: 192 }}>
          <ResponsiveContainer width="100%" height="100%" minHeight={192}>
            <BarChart data={countData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <XAxis
                dataKey="outcome"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: '#000', opacity: 0.05 }}
                contentStyle={tooltipStyle}
                formatter={(value: unknown) => [Number(value) || 0, '# of investments']}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {countData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
          Proceeds by outcome
        </p>
        <div style={{ width: '100%', height: 192, minHeight: 192 }}>
          <ResponsiveContainer width="100%" height="100%" minHeight={192}>
            <BarChart data={proceedsData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <XAxis
                dataKey="outcome"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatMoney(v, { ...display, compact: !display?.scale || display.scale === 'units' })}
              />
              <Tooltip
                cursor={{ fill: '#000', opacity: 0.05 }}
                contentStyle={tooltipStyle}
                formatter={(value: unknown) => [formatMoney(Number(value) || 0, display), 'Proceeds']}
              />
              <Bar dataKey="proceeds" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {proceedsData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
