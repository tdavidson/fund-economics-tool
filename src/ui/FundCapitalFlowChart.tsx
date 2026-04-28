import type { FundResult } from '../types.js';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { formatMoney, type DisplayOptions } from './format.js';

interface Props {
  result: FundResult;
  display?: DisplayOptions;
}

interface Segment {
  name: string;
  value: number;
  fill: string;
}

interface RectProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  fill?: string;
  depth?: number;
}

/**
 * Renderer for a single treemap cell. Draws the colored rect, then the segment
 * name inside if there's room. Following the Recharts CustomContentTreemap
 * example: pass this as `content={<CustomCell />}`; Recharts clones it and
 * injects x/y/width/height/name/fill on each node.
 */
function CustomCell(props: RectProps) {
  const { x = 0, y = 0, width = 0, height = 0, name, fill, depth } = props;
  // Recharts renders both leaf nodes (depth=1) and the root (depth=0). Skip root.
  if (depth === 0) return null;
  const showLabel = width > 60 && height > 24 && !!name;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill ?? '#3b82f6'}
        stroke="#fff"
        strokeWidth={1}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={11}
          style={{ pointerEvents: 'none' }}
        >
          {name}
        </text>
      )}
    </g>
  );
}

/**
 * Treemap of the fund's capital flow. Each segment is sized proportional to
 * its value — invested capital (split new/recycled if recycling is active),
 * management fees, partnership expenses, carried interest paid, distributions
 * (excess over paid-in). Hover a cell for name + value.
 */
export function FundCapitalFlowChart({ result, display }: Props) {
  const committed = result.calledCapital.total;
  const proceeds = result.proceeds.total;
  const total = Math.max(committed, proceeds, 1);

  const invested = result.investedCapital.total;
  const mgmt = result.managementFees.total;
  const partnership = result.partnershipExpenses.total;
  const recycled = result.recycledCapital.total;
  const carry = result.carriedInterestPaid.total;
  const distributions = result.distributions.total;

  const paidIn = mgmt + partnership + invested;
  const distributionsExcess = Math.max(0, distributions - paidIn);

  const investedExcludingRecycled = Math.max(0, invested - recycled);
  const investedSegments: Segment[] = recycled > 0
    ? [
        { name: 'Invested capital (new)', value: investedExcludingRecycled, fill: '#2563eb' },
        { name: 'Invested capital (recycled)', value: recycled, fill: '#14b8a6' },
      ].filter((c) => c.value > 0)
    : invested > 0
      ? [{ name: 'Invested capital', value: invested, fill: '#3b82f6' }]
      : [];

  const otherSegments: Segment[] = [
    { name: 'Management fees', value: mgmt, fill: '#f59e0b' },
    { name: 'Fund expenses', value: partnership, fill: '#f97316' },
    { name: 'Carried interest paid', value: carry, fill: '#8b5cf6' },
    { name: 'Distributions (excess)', value: distributionsExcess, fill: '#10b981' },
  ].filter((s) => s.value > 0);

  const treemapData = [...investedSegments, ...otherSegments];

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Capital Flow
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          Total Proceeds = {formatMoney(total, display)}
        </p>
      </div>
      <div className="h-64 rounded-sm overflow-hidden border border-border">
        {treemapData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            No capital flow to display
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treemapData}
              dataKey="value"
              stroke="#fff"
              content={<CustomCell />}
              isAnimationActive={false}
            >
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as { name?: string; value?: number };
                  return (
                    <div className="bg-background border border-border rounded-sm px-3 py-2 text-xs">
                      {p.name}: <span className="tabular-nums">{formatMoney(p.value ?? 0, display)}</span>
                    </div>
                  );
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
