import { useState } from 'react';
import type { FundResult } from '../types.js';
import { formatMultiple, formatPct } from './format.js';
import { ChevronSelect } from './FundInputsForm.js';

interface Props {
  result: FundResult;
}

type View = 'total' | 'lp';

/**
 * Compact sticky metrics card showing gross/net multiple + gross/net IRR.
 * User toggles Total Fund vs LP Only via a dropdown in the card's header.
 * Designed to sit at the top of the outputs column and stay visible while
 * scrolling the inputs side.
 */
export function StickyMultiplesBox({ result }: Props) {
  const [view, setView] = useState<View>('total');

  const pick = (triad: { total: number; lp: number }) =>
    view === 'total' ? triad.total : triad.lp;

  return (
    <div className="border border-border rounded-sm p-4 bg-background">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Returns</p>
        <ChevronSelect
          value={view}
          onChange={(v) => setView(v as View)}
          options={[
            { value: 'total', label: 'Total Fund' },
            { value: 'lp', label: 'LP Only' },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Metric label="Gross multiple" value={formatMultiple(pick(result.grossMultiple))} />
        <Metric label="Net multiple" value={formatMultiple(pick(result.netMultiple))} />
        <Metric label="Gross IRR" value={formatPct(pick(result.grossIRR))} />
        <Metric label="Net IRR" value={formatPct(pick(result.netIRR))} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-lg md:text-xl font-semibold text-foreground tabular-nums">{value}</div>
    </div>
  );
}
