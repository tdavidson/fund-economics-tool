import type { FundInputs, FundResult } from '../types.js';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatMoney, formatPct, type DisplayOptions } from './format.js';

interface Props {
  inputs: FundInputs;
  result: FundResult;
  display?: DisplayOptions;
}

const STAGE_COLORS = ['#2563eb', '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899', '#10b981'];
const colorFor = (i: number) => STAGE_COLORS[i % STAGE_COLORS.length];

interface Slice {
  name: string;
  value: number;
  color: string;
}

/**
 * Pie chart of the fund's allocation split. Groups by stage (with follow-on
 * reserves broken out when set), or falls back to new / follow-on split if no
 * stages are configured. Suppresses itself when the allocation is trivial
 * (100% to a single stage with no reserve) — there's nothing to compare.
 */
export function AllocationChart({ inputs, result, display }: Props) {
  const stages = inputs.portfolio.entryStages ?? [];

  const stageMode = inputs.stageInputMode ?? inputs.tierInputMode ?? 'pct-capital';
  const isStagePctMode = stageMode === 'pct-capital';

  // Pre-solve invested — the deployment denominator for stage allocations.
  const tentativeInvested =
    inputs.committedCapital -
    result.managementFees.total -
    result.partnershipExpenses.total +
    result.recycledCapital.total;

  const slices: Slice[] = [];
  let colorIdx = 0;

  if (stages.length > 0) {
    stages.forEach((s, i) => {
      const reserve = Math.max(0, Math.min(1, s.reserveRatio ?? 0));
      // Full allocation per stage = pct × invested (pct mode) or
      // (num × check) / (1 − reserve) (num mode).
      const full =
        isStagePctMode && s.pctAllocation !== undefined
          ? s.pctAllocation * tentativeInvested
          : reserve < 1
            ? (s.numInvestments * s.avgCheckSize) / (1 - reserve)
            : s.numInvestments * s.avgCheckSize;
      if (full <= 0) return;
      const initial = full * (1 - reserve);
      const reservePortion = full - initial;
      const label = s.name.trim() || `Stage ${i + 1}`;
      const base = colorFor(colorIdx++);
      slices.push({ name: `${label} · initial`, value: initial, color: base });
      if (reservePortion > 0) {
        slices.push({
          name: `${label} · follow-on reserve`,
          value: reservePortion,
          color: base + '88',
        });
      }
    });
  } else if (inputs.portfolio.followPct > 0) {
    slices.push({
      name: 'New investments',
      value: inputs.portfolio.newPct * tentativeInvested,
      color: colorFor(0),
    });
    slices.push({
      name: 'Follow-on investments',
      value: inputs.portfolio.followPct * tentativeInvested,
      color: colorFor(1),
    });
  }

  // Suppress when there's nothing meaningful to chart (one slice).
  if (slices.length < 2) return null;

  const total = slices.reduce((s, x) => s + x.value, 0);

  const tooltipStyle: React.CSSProperties = {
    fontSize: 12,
    backgroundColor: 'hsl(var(--background))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 2,
    color: 'hsl(var(--foreground))',
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Allocation</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          Total = {formatMoney(total, display)}
        </p>
      </div>
      <div className="h-64 rounded-sm overflow-hidden border border-border">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="40%"
              cy="50%"
              outerRadius="80%"
              isAnimationActive={false}
              stroke="#fff"
              strokeWidth={1}
            >
              {slices.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: unknown, name: unknown) => {
                const v = Number(value) || 0;
                return [
                  `${formatMoney(v, display)} (${formatPct(v / total, 0)})`,
                  String(name ?? ''),
                ];
              }}
            />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{ fontSize: 12, paddingLeft: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
