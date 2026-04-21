import type { FundInputs, ReturnTier } from '../types.js';
import type { ReactNode, ChangeEvent } from 'react';

interface Props {
  value: FundInputs;
  onChange: (next: FundInputs) => void;
}

/**
 * Controlled form for FundInputs. Sectioned: Fund → Portfolio → Returns →
 * Waterfall (optional). Styled with Hemrock design tokens — assumes the
 * consumer's Tailwind config exposes `border`, `muted-foreground`, `background`,
 * `foreground`, `accent` color tokens.
 */
export function FundInputsForm({ value, onChange }: Props) {
  const update = (patch: Partial<FundInputs>) => onChange({ ...value, ...patch });
  const updateTier = (index: number, patch: Partial<ReturnTier>) => {
    const nextTiers = value.returnTiers.map((t, i) => (i === index ? { ...t, ...patch } : t));
    update({ returnTiers: nextTiers });
  };

  return (
    <form className="space-y-10" onSubmit={(e) => e.preventDefault()}>
      {/* ── Fund ──────────────────────────────────────────────────────────── */}
      <Section label="Fund">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <NumberField
            label="Committed capital"
            unit="$"
            value={value.committedCapital}
            onChange={(v) => update({ committedCapital: v })}
          />
          <NumberField
            label="GP commit"
            unit="%"
            pct
            value={value.gpCommitPct}
            onChange={(v) => update({ gpCommitPct: v })}
          />
          <CheckboxField
            label="GP commit counted toward invested capital"
            hint="GP pays no management fees on their own commit when enabled."
            checked={value.gpCommitCountedTowardInvested}
            onChange={(v) => update({ gpCommitCountedTowardInvested: v })}
          />
          <NumberField
            label="Management fees"
            unit="% / yr"
            pct
            value={value.mgmtFeePct}
            onChange={(v) => update({ mgmtFeePct: v })}
          />
          <NumberField
            label="Organizational expenses"
            unit="$"
            value={value.organizationalExpenses}
            onChange={(v) => update({ organizationalExpenses: v })}
          />
          <NumberField
            label="Operational expenses"
            unit="$ / yr"
            value={value.operationalExpensesAnnual}
            onChange={(v) => update({ operationalExpensesAnnual: v })}
          />
          <NumberField
            label="Recycled capital"
            unit="%"
            pct
            value={value.recycledCapitalPct}
            onChange={(v) => update({ recycledCapitalPct: v })}
          />
          <NumberField
            label="Carry"
            unit="%"
            pct
            value={value.carryPct}
            onChange={(v) => update({ carryPct: v })}
          />
          <NumberField
            label="New investment period"
            unit="years"
            value={value.newInvestmentPeriodYears}
            onChange={(v) => update({ newInvestmentPeriodYears: v })}
          />
          <NumberField
            label="Management fees period"
            unit="years"
            value={value.mgmtFeesPeriodYears}
            onChange={(v) => update({ mgmtFeesPeriodYears: v })}
          />
        </div>
      </Section>

      {/* ── Portfolio ─────────────────────────────────────────────────────── */}
      <Section label="Portfolio construction">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <NumberField
            label="% allocation — new"
            unit="%"
            pct
            value={value.portfolio.newPct}
            onChange={(v) => update({
              portfolio: { ...value.portfolio, newPct: v, followPct: 1 - v },
            })}
          />
          <NumberField
            label="% allocation — follow-on"
            unit="%"
            pct
            value={value.portfolio.followPct}
            onChange={(v) => update({
              portfolio: { ...value.portfolio, followPct: v, newPct: 1 - v },
            })}
          />
          <NumberField
            label="Average check — new"
            unit="$"
            value={value.portfolio.avgCheckSizeNew}
            onChange={(v) => update({
              portfolio: { ...value.portfolio, avgCheckSizeNew: v },
            })}
          />
          <NumberField
            label="Average check — follow-on"
            unit="$"
            value={value.portfolio.avgCheckSizeFollow}
            onChange={(v) => update({
              portfolio: { ...value.portfolio, avgCheckSizeFollow: v },
            })}
          />
        </div>
      </Section>

      {/* ── Return tiers ──────────────────────────────────────────────────── */}
      <Section label="Return tiers">
        <div className="overflow-x-auto border border-border rounded-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs">Tier</th>
                <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs">% of capital</th>
                <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs">Multiple</th>
                <th className="px-4 py-2 font-medium uppercase tracking-widest text-xs">Hold (yrs)</th>
              </tr>
            </thead>
            <tbody>
              {value.returnTiers.map((tier, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) => updateTier(i, { name: e.target.value })}
                      className="w-full bg-transparent text-foreground capitalize focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <PctCellInput value={tier.pctOfCapital} onChange={(v) => updateTier(i, { pctOfCapital: v })} />
                  </td>
                  <td className="px-4 py-2">
                    <NumberCellInput value={tier.multiple} onChange={(v) => updateTier(i, { multiple: v })} suffix="x" />
                  </td>
                  <td className="px-4 py-2">
                    <NumberCellInput value={tier.holdingPeriodYears} onChange={(v) => updateTier(i, { holdingPeriodYears: v })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          % of capital across all tiers must sum to 100%. Tier names are free-text labels.
        </p>
      </Section>

      {/* ── Waterfall (optional) ──────────────────────────────────────────── */}
      <Section label="Waterfall (optional)">
        <p className="text-sm text-muted-foreground mb-4">
          Off by default — the engine uses Excel&apos;s simple carry (profit × carry %). Enable a preferred return to run a European waterfall: LP gets called capital → preferred return → GP catchup → residual split per carry %.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <NumberField
            label="Preferred return"
            unit="% / yr"
            pct
            value={value.waterfall?.preferredReturnPct ?? 0}
            onChange={(v) => update({
              waterfall: v > 0
                ? { preferredReturnPct: v, gpCatchupPct: value.waterfall?.gpCatchupPct ?? 1 }
                : undefined,
            })}
          />
          <NumberField
            label="GP catchup"
            unit="%"
            pct
            value={value.waterfall?.gpCatchupPct ?? 1}
            onChange={(v) => update({
              waterfall: value.waterfall
                ? { ...value.waterfall, gpCatchupPct: v }
                : undefined,
            })}
            disabled={!value.waterfall?.preferredReturnPct}
          />
        </div>
      </Section>
    </form>
  );
}

// ── Primitives ───────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">{label}</h3>
      {children}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  unit: string;
  value: number;
  onChange: (next: number) => void;
  /** Display as a percentage (value is 0–1, displayed as 0–100). */
  pct?: boolean;
  disabled?: boolean;
}

function NumberField({ label, unit, value, onChange, pct, disabled }: NumberFieldProps) {
  const display = pct ? value * 100 : value;
  return (
    <label className="block">
      <span className="block text-sm text-foreground mb-1">{label}</span>
      <div className="relative">
        <input
          type="number"
          value={Number.isFinite(display) ? display : ''}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const raw = parseFloat(e.target.value);
            if (!Number.isFinite(raw)) return onChange(0);
            onChange(pct ? raw / 100 : raw);
          }}
          className="w-full px-3 py-2 text-sm border border-border rounded-sm bg-background text-foreground tabular-nums pr-16 focus:outline-none focus:border-foreground disabled:opacity-50"
          step="any"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {unit}
        </span>
      </div>
    </label>
  );
}

function CheckboxField({ label, hint, checked, onChange }: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 md:col-span-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded-sm border-border accent-foreground"
      />
      <span>
        <span className="block text-sm text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

function PctCellInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <input
        type="number"
        value={Number.isFinite(value) ? value * 100 : ''}
        onChange={(e) => {
          const raw = parseFloat(e.target.value);
          onChange(Number.isFinite(raw) ? raw / 100 : 0);
        }}
        step="any"
        className="w-full px-2 py-1 text-sm border border-border rounded-sm bg-background text-foreground tabular-nums pr-6 focus:outline-none focus:border-foreground"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
        %
      </span>
    </div>
  );
}

function NumberCellInput({ value, onChange, suffix }: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => {
          const raw = parseFloat(e.target.value);
          onChange(Number.isFinite(raw) ? raw : 0);
        }}
        step="any"
        className={`w-full px-2 py-1 text-sm border border-border rounded-sm bg-background text-foreground tabular-nums focus:outline-none focus:border-foreground ${suffix ? 'pr-6' : ''}`}
      />
      {suffix && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}
