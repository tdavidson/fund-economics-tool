import type {
  FundInputs,
  FundResult,
  OperationalExpensesBreakout,
  PartnershipExpenseLine,
  ReturnTier,
  TierInputMode,
} from '../types.js';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { formatMoney, formatPct, formatNumber, type DisplayOptions } from './format.js';

export type FormSection =
  // Legacy sections (still supported for backward compat)
  | 'main-numeric'
  | 'accordions'
  | 'fee-schedule'
  | 'op-breakout'
  | 'partnership-lines'
  | 'portfolio'
  | 'tiers'
  // Compound tab-oriented sections. Each bundles a tab's full set of inputs.
  | 'fund-structure'
  | 'management-fees'
  | 'operational-expenses'
  | 'partnership-expenses';

interface Props {
  value: FundInputs;
  onChange: (next: FundInputs) => void;
  /** Currency symbol shown as the prefix on money inputs. Empty = no prefix. */
  currency?: string;
  /**
   * Which sections to render. Default = all four. Use a subset when pairing
   * the form with a different input surface (e.g. a prose paragraph) that
   * covers the main numeric fields itself.
   */
  sections?: FormSection[];
  /**
   * Computed fund result. When provided, the return-tier table merges the
   * computed output columns (# investments, proceeds, % of proceeds, totals)
   * so tiers live in a single input+output table.
   */
  result?: FundResult;
  /** Display options for formatting money in the merged tier table. */
  display?: DisplayOptions;
}

/**
 * Controlled form for FundInputs. Single column. Excel-style inputs
 * (muted gray background, blue text). Number inputs allow complete
 * zero-out and have no spinner.
 *
 * Accordions (fee schedule, op-expense breakout, partnership lines) are
 * additive: when open and populated, they override the plain single-field
 * input above them; when closed/unset, the plain inputs drive compute.
 */
const ALL_SECTIONS: FormSection[] = ['main-numeric', 'accordions', 'portfolio', 'tiers'];

/** Treat 'accordions' as a superset that implies all three individual ones. */
function hasSection(sections: FormSection[], target: FormSection): boolean {
  if (sections.includes(target)) return true;
  if (sections.includes('accordions') && (target === 'fee-schedule' || target === 'op-breakout' || target === 'partnership-lines')) {
    return true;
  }
  return false;
}

export function FundInputsForm({
  value,
  onChange,
  currency = '$',
  sections = ALL_SECTIONS,
  result,
  display,
}: Props) {
  const show = (s: FormSection) => hasSection(sections, s);
  // True when rendering the grouped accordions block (all 3 together) vs. an individual accordion in a tab.
  const showAccordionsGrouped = sections.includes('accordions');
  const update = (patch: Partial<FundInputs>) => onChange({ ...value, ...patch });

  // Changing the mgmt-fees period resizes the fee schedule (if enabled) so
  // each year keeps its own rate. Extended years inherit the last rate.
  const updateMgmtFeesPeriod = (years: number) => {
    const patch: Partial<FundInputs> = { mgmtFeesPeriodYears: years };
    if (value.mgmtFeeSchedule && value.mgmtFeeSchedule.length > 0) {
      const target = Math.max(1, Math.round(years));
      const current = value.mgmtFeeSchedule;
      if (target !== current.length) {
        const last = current[current.length - 1] ?? value.mgmtFeePct;
        patch.mgmtFeeSchedule =
          target > current.length
            ? [...current, ...Array.from({ length: target - current.length }, () => last)]
            : current.slice(0, target);
      }
    }
    update(patch);
  };

  // Writeoff tier (by name, case-insensitive) auto-plugs to 1 - sum(others)
  // in pct-capital mode. In num-companies mode, normalization handles it.
  const writeoffIdx = value.returnTiers.findIndex(
    (t) => t.name.trim().toLowerCase() === 'writeoff',
  );
  const tierInputMode: TierInputMode = value.tierInputMode ?? 'pct-capital';
  const tierFractional = value.tierFractional ?? true;

  const updateTier = (index: number, patch: Partial<ReturnTier>) => {
    const nextTiers = value.returnTiers.map((t, i) => (i === index ? { ...t, ...patch } : t));

    // pct-capital mode: if user edited pctOfCapital on a non-writeoff tier, replug writeoff.
    if (
      tierInputMode === 'pct-capital' &&
      writeoffIdx >= 0 &&
      index !== writeoffIdx &&
      patch.pctOfCapital !== undefined
    ) {
      const othersSum = nextTiers.reduce(
        (s, t, i) => (i === writeoffIdx ? s : s + t.pctOfCapital),
        0,
      );
      nextTiers[writeoffIdx] = {
        ...nextTiers[writeoffIdx],
        pctOfCapital: Math.max(0, 1 - othersSum),
      };
    }

    // num-companies mode: normalize pctOfCapital across all tiers from num values.
    if (tierInputMode === 'num-companies' && patch.numCompanies !== undefined) {
      const sumNum = nextTiers.reduce((s, t) => s + (t.numCompanies ?? 0), 0);
      if (sumNum > 0) {
        for (let i = 0; i < nextTiers.length; i++) {
          nextTiers[i] = {
            ...nextTiers[i],
            pctOfCapital: (nextTiers[i].numCompanies ?? 0) / sumNum,
          };
        }
      }
    }

    update({ returnTiers: nextTiers });
  };

  // Fee schedule: when open, drives computed blended rate.
  const feeSchedule = value.mgmtFeeSchedule;
  const feeScheduleEnabled = !!feeSchedule && feeSchedule.length > 0;
  const blendedFeeRate = feeScheduleEnabled
    ? feeSchedule!.reduce((s, r) => s + r, 0) / feeSchedule!.length
    : value.mgmtFeePct;

  const toggleFeeSchedule = (on: boolean) => {
    if (on) {
      const years = Math.max(1, Math.round(value.mgmtFeesPeriodYears));
      update({ mgmtFeeSchedule: Array.from({ length: years }, () => value.mgmtFeePct) });
    } else {
      update({ mgmtFeeSchedule: undefined });
    }
  };

  const setFeeScheduleYear = (i: number, rate: number) => {
    if (!feeSchedule) return;
    const next = feeSchedule.slice();
    next[i] = rate;
    update({ mgmtFeeSchedule: next });
  };

  // Operational expenses breakout.
  const opBreak = value.operationalExpensesBreakout;
  const opBreakoutEnabled = !!opBreak;
  const opBreakoutSum = opBreak ? opBreak.fundAdmin + opBreak.tax + opBreak.audit + opBreak.other : 0;

  const toggleOpBreakout = (on: boolean) => {
    if (on) {
      const each = Math.round((value.operationalExpensesAnnual || 0) / 4);
      update({ operationalExpensesBreakout: { fundAdmin: each, tax: each, audit: each, other: each } });
    } else {
      update({ operationalExpensesBreakout: undefined });
    }
  };

  const updateOpBreakout = (patch: Partial<OperationalExpensesBreakout>) => {
    if (!opBreak) return;
    const next = { ...opBreak, ...patch };
    update({
      operationalExpensesBreakout: next,
      operationalExpensesAnnual: next.fundAdmin + next.tax + next.audit + next.other,
    });
  };

  // Partnership expense line items.
  const partnershipLines = value.partnershipExpenseLines;
  const partnershipLinesEnabled = !!partnershipLines;
  const partnershipLinesSum = partnershipLines
    ? partnershipLines.reduce((s, l) => s + l.amount, 0)
    : 0;

  const togglePartnershipLines = (on: boolean) => {
    if (on) {
      const current = value.partnershipExpensesAnnual ?? 0;
      update({
        partnershipExpenseLines: [{ label: 'Line 1', amount: current }],
      });
    } else {
      update({ partnershipExpenseLines: undefined });
    }
  };

  const updatePartnershipLine = (i: number, patch: Partial<PartnershipExpenseLine>) => {
    if (!partnershipLines) return;
    const next = partnershipLines.map((l, idx) => (i === idx ? { ...l, ...patch } : l));
    update({
      partnershipExpenseLines: next,
      partnershipExpensesAnnual: next.reduce((s, l) => s + l.amount, 0),
    });
  };

  const addPartnershipLine = () => {
    if (!partnershipLines) return;
    const next = [...partnershipLines, { label: `Line ${partnershipLines.length + 1}`, amount: 0 }];
    update({ partnershipExpenseLines: next });
  };

  const removePartnershipLine = (i: number) => {
    if (!partnershipLines) return;
    const next = partnershipLines.filter((_, idx) => idx !== i);
    update({
      partnershipExpenseLines: next.length > 0 ? next : undefined,
      partnershipExpensesAnnual: next.reduce((s, l) => s + l.amount, 0),
    });
  };

  return (
    <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
      {show('main-numeric') && (
      <div className="grid grid-cols-1 gap-y-4">
        <NumberField
          label="Committed capital"
          prefix={currency}
          value={value.committedCapital}
          onChange={(v) => update({ committedCapital: v })}
        />
        <NumberField
          label="GP commit"
          suffix="%"
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
          suffix="% / yr"
          pct
          value={value.mgmtFeePct}
          onChange={(v) => update({ mgmtFeePct: v })}
          disabled={feeScheduleEnabled}
          hint={feeScheduleEnabled ? `Using schedule. Blended: ${(blendedFeeRate * 100).toFixed(2)}%` : undefined}
        />
        <NumberField
          label="Management fees period"
          suffix="years"
          value={value.mgmtFeesPeriodYears}
          onChange={updateMgmtFeesPeriod}
        />
        <NumberField
          label="Organizational expenses"
          prefix={currency}
          value={value.organizationalExpenses}
          onChange={(v) => update({ organizationalExpenses: v })}
        />
        <NumberField
          label="Operational expenses"
          prefix={currency}
          suffix="/ yr"
          value={value.operationalExpensesAnnual}
          onChange={(v) => update({ operationalExpensesAnnual: v })}
          disabled={opBreakoutEnabled}
          hint={opBreakoutEnabled ? `Sum of breakout: ${formatMoneyShort(opBreakoutSum)}` : undefined}
        />
        <NumberField
          label="Partnership expenses"
          prefix={currency}
          suffix="/ yr"
          value={value.partnershipExpensesAnnual ?? 0}
          onChange={(v) => update({ partnershipExpensesAnnual: v })}
          disabled={partnershipLinesEnabled}
          hint={partnershipLinesEnabled ? `Sum of lines: ${formatMoneyShort(partnershipLinesSum)}` : undefined}
        />
        <NumberField
          label="Recycled capital"
          suffix="%"
          pct
          value={value.recycledCapitalPct}
          onChange={(v) => update({ recycledCapitalPct: v })}
        />
        <NumberField
          label="Carry"
          suffix="%"
          pct
          value={value.carryPct}
          onChange={(v) => update({ carryPct: v })}
        />
        <NumberField
          label="New investment period"
          suffix="years"
          value={value.newInvestmentPeriodYears}
          onChange={(v) => update({ newInvestmentPeriodYears: v })}
        />
        <NumberField
          label="Fund operations period"
          suffix="years"
          value={value.fundOperationsYears ?? value.newInvestmentPeriodYears + 6}
          onChange={(v) => update({ fundOperationsYears: v })}
        />
      </div>
      )}

      {show('fund-structure') && (
        <div className="grid grid-cols-1 gap-y-4">
          <NumberField
            label="Committed capital"
            prefix={currency}
            value={value.committedCapital}
            onChange={(v) => update({ committedCapital: v })}
          />
          <NumberField
            label="GP commit"
            suffix="%"
            pct
            value={value.gpCommitPct}
            onChange={(v) => update({ gpCommitPct: v })}
          />
          <NumberField
            label="Organizational expenses"
            prefix={currency}
            value={value.organizationalExpenses}
            onChange={(v) => update({ organizationalExpenses: v })}
          />
          <NumberField
            label="Recycled capital"
            suffix="%"
            pct
            value={value.recycledCapitalPct}
            onChange={(v) => update({ recycledCapitalPct: v })}
          />
          <NumberField
            label="Carry"
            suffix="%"
            pct
            value={value.carryPct}
            onChange={(v) => update({ carryPct: v })}
          />
          <NumberField
            label="New investment period"
            suffix="years"
            value={value.newInvestmentPeriodYears}
            onChange={(v) => update({ newInvestmentPeriodYears: v })}
          />
          <NumberField
            label="Fund operations period"
            suffix="years"
            value={value.fundOperationsYears ?? value.newInvestmentPeriodYears + 6}
            onChange={(v) => update({ fundOperationsYears: v })}
          />
        </div>
      )}

      {show('management-fees') && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-y-4">
            <NumberField
              label="Management fees"
              suffix="% / yr"
              pct
              value={value.mgmtFeePct}
              onChange={(v) => update({ mgmtFeePct: v })}
              disabled={feeScheduleEnabled}
              hint={feeScheduleEnabled ? `Using schedule. Blended: ${(blendedFeeRate * 100).toFixed(2)}%` : undefined}
            />
            <NumberField
              label="Management fees period"
              suffix="years"
              value={value.mgmtFeesPeriodYears}
              onChange={updateMgmtFeesPeriod}
            />
          </div>
          <Accordion
            label="Fee schedule"
            summary={feeScheduleEnabled ? 'on' : 'off'}
            enabled={feeScheduleEnabled}
            onToggle={toggleFeeSchedule}
          >
            {feeScheduleEnabled && feeSchedule && (
              <div className="space-y-2">
                <div className="overflow-x-auto border border-border rounded-sm">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium uppercase tracking-widest">Year</th>
                        <th className="px-3 py-2 font-medium uppercase tracking-widest">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeSchedule.map((rate, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                          <td className="px-3 py-1.5">
                            <ExcelInput
                              value={rate}
                              pct
                              suffix="%"
                              onChange={(v) => setFeeScheduleYear(i, v)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-foreground/20 bg-muted/30">
                        <td className="px-3 py-2 text-xs uppercase tracking-widest text-foreground font-medium">Blended</td>
                        <td className="px-3 py-2 text-xs tabular-nums text-foreground font-medium">
                          {(blendedFeeRate * 100).toFixed(2)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  One row per operating year. Blended rate is the arithmetic mean.
                </p>
              </div>
            )}
          </Accordion>
        </div>
      )}

      {show('operational-expenses') && (
        <div className="space-y-6">
          <NumberField
            label="Operational expenses"
            prefix={currency}
            suffix="/ yr"
            value={value.operationalExpensesAnnual}
            onChange={(v) => update({ operationalExpensesAnnual: v })}
            disabled={opBreakoutEnabled}
            hint={opBreakoutEnabled ? `Sum of breakout: ${formatMoneyShort(opBreakoutSum)}` : undefined}
          />
          <Accordion
            label="Operational expense breakout"
            summary={opBreakoutEnabled ? 'on' : 'off'}
            enabled={opBreakoutEnabled}
            onToggle={toggleOpBreakout}
          >
            {opBreakoutEnabled && opBreak && (
              <div className="grid grid-cols-1 gap-y-4">
                <NumberField
                  label="Fund admin"
                  prefix={currency}
                  suffix="/ yr"
                  value={opBreak.fundAdmin}
                  onChange={(v) => updateOpBreakout({ fundAdmin: v })}
                />
                <NumberField
                  label="Tax"
                  prefix={currency}
                  suffix="/ yr"
                  value={opBreak.tax}
                  onChange={(v) => updateOpBreakout({ tax: v })}
                />
                <NumberField
                  label="Audit"
                  prefix={currency}
                  suffix="/ yr"
                  value={opBreak.audit}
                  onChange={(v) => updateOpBreakout({ audit: v })}
                />
                <NumberField
                  label="Other"
                  prefix={currency}
                  suffix="/ yr"
                  value={opBreak.other}
                  onChange={(v) => updateOpBreakout({ other: v })}
                />
              </div>
            )}
          </Accordion>
        </div>
      )}

      {show('partnership-expenses') && (
        <div className="space-y-6">
          <NumberField
            label="Partnership expenses"
            prefix={currency}
            suffix="/ yr"
            value={value.partnershipExpensesAnnual ?? 0}
            onChange={(v) => update({ partnershipExpensesAnnual: v })}
            disabled={partnershipLinesEnabled}
            hint={partnershipLinesEnabled ? `Sum of lines: ${formatMoneyShort(partnershipLinesSum)}` : undefined}
          />
          <Accordion
            label="Partnership expense line items"
            summary={partnershipLinesEnabled ? `${partnershipLines!.length} lines` : 'off'}
            enabled={partnershipLinesEnabled}
            onToggle={togglePartnershipLines}
          >
            {partnershipLinesEnabled && partnershipLines && (
              <div className="space-y-2">
                <div className="space-y-2">
                  {partnershipLines.map((line, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={line.label}
                        onChange={(e) => updatePartnershipLine(i, { label: e.target.value })}
                        placeholder="Label"
                        className="flex-1 bg-muted px-2 py-1.5 text-xs rounded-sm text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-1 focus:ring-foreground/30"
                      />
                      <div className="w-32">
                        <ExcelInput
                          value={line.amount}
                          prefix={currency}
                          suffix="/ yr"
                          onChange={(v) => updatePartnershipLine(i, { amount: v })}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removePartnershipLine(i)}
                        className="text-muted-foreground hover:text-foreground text-sm px-2"
                        aria-label="Remove line"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addPartnershipLine}
                  className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
                >
                  + Add line
                </button>
              </div>
            )}
          </Accordion>
        </div>
      )}

      {(show('fee-schedule') || show('op-breakout') || show('partnership-lines')) && (
      <div className={showAccordionsGrouped ? 'space-y-3' : 'space-y-3'}>
        {show('fee-schedule') && (
        <Accordion
          label="Fee schedule"
          summary={feeScheduleEnabled ? 'on' : 'off'}
          enabled={feeScheduleEnabled}
          onToggle={toggleFeeSchedule}
        >
          {feeScheduleEnabled && feeSchedule && (
            <div className="space-y-2">
              <div className="overflow-x-auto border border-border rounded-sm">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium uppercase tracking-widest">Year</th>
                      <th className="px-3 py-2 font-medium uppercase tracking-widest">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeSchedule.map((rate, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-3 py-1.5">
                          <ExcelInput
                            value={rate}
                            pct
                            suffix="%"
                            onChange={(v) => setFeeScheduleYear(i, v)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-foreground/20 bg-muted/30">
                      <td className="px-3 py-2 text-xs uppercase tracking-widest text-foreground font-medium">Blended</td>
                      <td className="px-3 py-2 text-xs tabular-nums text-foreground font-medium">
                        {(blendedFeeRate * 100).toFixed(2)}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                One row per operating year. Blended rate is the arithmetic mean.
              </p>
            </div>
          )}
        </Accordion>
        )}
        {show('op-breakout') && (
        <Accordion
          label="Operational expense breakout"
          summary={opBreakoutEnabled ? 'on' : 'off'}
          enabled={opBreakoutEnabled}
          onToggle={toggleOpBreakout}
        >
          {opBreakoutEnabled && opBreak && (
            <div className="grid grid-cols-1 gap-y-4">
              <NumberField
                label="Fund admin"
                prefix={currency}
                suffix="/ yr"
                value={opBreak.fundAdmin}
                onChange={(v) => updateOpBreakout({ fundAdmin: v })}
              />
              <NumberField
                label="Tax"
                prefix={currency}
                suffix="/ yr"
                value={opBreak.tax}
                onChange={(v) => updateOpBreakout({ tax: v })}
              />
              <NumberField
                label="Audit"
                prefix={currency}
                suffix="/ yr"
                value={opBreak.audit}
                onChange={(v) => updateOpBreakout({ audit: v })}
              />
              <NumberField
                label="Other"
                prefix={currency}
                suffix="/ yr"
                value={opBreak.other}
                onChange={(v) => updateOpBreakout({ other: v })}
              />
            </div>
          )}
        </Accordion>
        )}
        {show('partnership-lines') && (
        <Accordion
          label="Partnership expense line items"
          summary={partnershipLinesEnabled ? `${partnershipLines!.length} lines` : 'off'}
          enabled={partnershipLinesEnabled}
          onToggle={togglePartnershipLines}
        >
          {partnershipLinesEnabled && partnershipLines && (
            <div className="space-y-2">
              <div className="space-y-2">
                {partnershipLines.map((line, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={line.label}
                      onChange={(e) => updatePartnershipLine(i, { label: e.target.value })}
                      placeholder="Label"
                      className="flex-1 bg-muted px-2 py-1.5 text-xs rounded-sm text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    />
                    <div className="w-32">
                      <ExcelInput
                        value={line.amount}
                        prefix={currency}
                        suffix="/ yr"
                        onChange={(v) => updatePartnershipLine(i, { amount: v })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePartnershipLine(i)}
                      className="text-muted-foreground hover:text-foreground text-sm px-2"
                      aria-label="Remove line"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addPartnershipLine}
                className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
              >
                + Add line
              </button>
            </div>
          )}
        </Accordion>
        )}
      </div>
      )}

      {show('portfolio') && (
      <Section label="Portfolio construction">
        <div className="grid grid-cols-1 gap-y-4">
          <NumberField
            label="% new"
            suffix="%"
            pct
            value={value.portfolio.newPct}
            onChange={(v) => {
              const newPct = Math.min(1, Math.max(0, v));
              update({
                portfolio: { ...value.portfolio, newPct, followPct: 1 - newPct },
              });
            }}
          />
          <NumberField
            label="% follow-on"
            suffix="%"
            pct
            value={value.portfolio.followPct}
            onChange={() => undefined}
            disabled
            hint="Computed as 100% − % new."
          />
          <NumberField
            label="Avg check — new"
            prefix={currency}
            value={value.portfolio.avgCheckSizeNew}
            onChange={(v) =>
              update({ portfolio: { ...value.portfolio, avgCheckSizeNew: v } })
            }
          />
          {value.portfolio.followPct > 0 && (
            <NumberField
              label="Avg check — follow-on"
              prefix={currency}
              value={value.portfolio.avgCheckSizeFollow}
              onChange={(v) =>
                update({ portfolio: { ...value.portfolio, avgCheckSizeFollow: v } })
              }
            />
          )}
        </div>
      </Section>
      )}

      {show('tiers') && (
      <Section label="Return tiers">
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            Input by
            <ChevronSelect
              value={tierInputMode}
              onChange={(v) => update({ tierInputMode: v as TierInputMode })}
              options={[
                { value: 'pct-capital', label: '% of capital' },
                { value: 'num-companies', label: '# of companies' },
              ]}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={tierFractional}
              onChange={(e) => update({ tierFractional: e.target.checked })}
              className="h-3.5 w-3.5 rounded-sm border-border accent-foreground"
            />
            Fractional companies
          </label>
        </div>
        <div className="overflow-x-auto border border-border rounded-sm">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium uppercase tracking-widest">Tier</th>
                <th className="px-3 py-2 font-medium uppercase tracking-widest text-right">% capital</th>
                <th className="px-3 py-2 font-medium uppercase tracking-widest text-right"># investments</th>
                <th className="px-3 py-2 font-medium uppercase tracking-widest text-right">Multiple</th>
                <th className="px-3 py-2 font-medium uppercase tracking-widest text-right">Hold (yrs)</th>
                {result && (
                  <>
                    <th className="px-3 py-2 font-medium uppercase tracking-widest text-right">Proceeds</th>
                    <th className="px-3 py-2 font-medium uppercase tracking-widest text-right">% of proceeds</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {value.returnTiers.map((tier, i) => {
                const isWriteoff = i === writeoffIdx;
                const tierResult = result?.tiers[i];
                const numDigits = tierFractional ? 1 : 0;
                // # investments: editable in num-companies mode, computed otherwise.
                const computedNum = tierResult?.numInvestments ?? 0;
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => updateTier(i, { name: e.target.value })}
                        className="w-full bg-muted px-2 py-1 rounded-sm text-blue-600 dark:text-blue-400 capitalize focus:outline-none focus:ring-1 focus:ring-foreground/30"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {tierInputMode === 'pct-capital' ? (
                        <ExcelInput
                          value={tier.pctOfCapital}
                          suffix="%"
                          pct
                          disabled={isWriteoff}
                          onChange={(v) => updateTier(i, { pctOfCapital: v })}
                        />
                      ) : (
                        <span className="tabular-nums text-foreground">{formatPct(tier.pctOfCapital, 0)}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {tierInputMode === 'num-companies' ? (
                        <ExcelInput
                          value={tier.numCompanies ?? 0}
                          onChange={(v) => updateTier(i, { numCompanies: v })}
                        />
                      ) : (
                        <span className="tabular-nums text-foreground">{formatNumber(computedNum, numDigits)}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <ExcelInput value={tier.multiple} suffix="x" onChange={(v) => updateTier(i, { multiple: v })} />
                    </td>
                    <td className="px-3 py-1.5">
                      <ExcelInput value={tier.holdingPeriodYears} onChange={(v) => updateTier(i, { holdingPeriodYears: v })} />
                    </td>
                    {result && (
                      <>
                        <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                          {formatMoney(tierResult?.proceeds ?? 0, display)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          {formatPct(tierResult?.pctOfProceeds ?? 0, 0)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {result && (
              <tfoot>
                <tr className="border-t border-foreground/20 bg-muted/30">
                  <td className="px-3 py-2 text-xs uppercase tracking-widest text-foreground font-medium">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground font-medium">
                    {formatPct(
                      result.tiers.reduce((s, t) => s + t.pctOfCapital, 0),
                      0,
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground font-medium">
                    {formatNumber(
                      result.tiers.reduce((s, t) => s + t.numInvestments, 0),
                      tierFractional ? 1 : 0,
                    )}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums text-foreground font-medium"
                    title="Weighted average gross multiple"
                  >
                    {result.tiers.reduce((s, t) => s + t.weightedMultiple, 0).toFixed(2)}x
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums text-foreground font-medium"
                    title="Proceeds-weighted average hold period"
                  >
                    {result.weightedHoldPeriodYears.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground font-medium">
                    {formatMoney(
                      result.tiers.reduce((s, t) => s + t.proceeds, 0),
                      display,
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground font-medium">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {tierInputMode === 'num-companies'
            ? '% of capital is normalized from the company counts.'
            : writeoffIdx >= 0
              ? 'Writeoff % auto-plugs to 100% minus the other tiers.'
              : '% of capital across all tiers must sum to 100%.'}
        </p>
      </Section>
      )}

    </form>
  );
}

// ── Primitives ───────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{label}</h3>
      {children}
    </div>
  );
}

/**
 * Lightweight disclosure panel. The whole header row is one toggle — clicking
 * it both enables the feature and expands the body. No separate checkbox;
 * single-line labels so they don't wrap in a narrow inputs column.
 */
function Accordion({
  label,
  summary,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  summary?: string;
  enabled: boolean;
  onToggle: (on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="border border-border rounded-sm">
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        aria-expanded={enabled}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left hover:bg-accent/40 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="inline-block w-3 text-center text-muted-foreground">
            {enabled ? '−' : '+'}
          </span>
          <span className="text-foreground truncate">{label}</span>
          {summary && enabled && (
            <span className="text-muted-foreground/70 truncate">· {summary}</span>
          )}
        </span>
        <span
          className={`text-[10px] uppercase tracking-widest shrink-0 ${
            enabled ? 'text-foreground' : 'text-muted-foreground/60'
          }`}
        >
          {enabled ? 'On' : 'Off'}
        </span>
      </button>
      {enabled && <div className="px-3 pb-3 pt-2 border-t border-border">{children}</div>}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  /** Text shown before the input inside the gray pill (e.g. currency symbol). */
  prefix?: string;
  /** Text shown after the input inside the gray pill (e.g. %, years, x). */
  suffix?: string;
  value: number;
  onChange: (next: number) => void;
  /** Display as a percentage (value is 0–1, displayed as 0–100). */
  pct?: boolean;
  disabled?: boolean;
  /** Small hint rendered under the input, muted. */
  hint?: string;
}

/**
 * Horizontal paragraph row: label on the left, input on the right.
 * The input column is a fixed width so all fields align down the page.
 */
function NumberField({ label, prefix, suffix, value, onChange, pct, disabled, hint }: NumberFieldProps) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground flex-1 min-w-0">{label}</span>
      <div className="shrink-0 w-48 sm:w-56">
        <ExcelInput
          value={value}
          pct={pct}
          prefix={prefix}
          suffix={suffix}
          onChange={onChange}
          disabled={disabled}
        />
        {hint && <span className="block text-[10px] text-muted-foreground mt-1 text-right">{hint}</span>}
      </div>
    </label>
  );
}

/**
 * Native `<select>` wrapped with an always-visible chevron. Browser default
 * chevrons are inconsistent (Mac Safari shows a double-arrow; Chrome's is
 * tiny). This gives the control a predictable look that matches the rest
 * of the Hemrock UI.
 */
/**
 * Custom button + menu dropdown. Avoids the native `<select>` double-chevron
 * problem on Safari (appearance: none doesn't fully strip the OS-rendered
 * arrow). Fully controlled markup so the chevron we draw is the only one
 * visible, and the menu styling matches the rest of the Hemrock UI.
 */
export function ChevronSelect({
  value,
  onChange,
  options,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  /** Extra classes on the wrapper. Pass `w-full` to fill the parent. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div
      className={`relative inline-block ${className}`}
      onBlur={(e) => {
        // Close the menu when focus leaves the wrapper entirely.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full inline-flex items-center justify-between gap-2 pl-2 pr-2 py-1.5 bg-background border border-border rounded-sm text-foreground text-xs cursor-pointer hover:border-foreground focus:outline-none focus:border-foreground"
      >
        <span className="truncate">{current?.label ?? ''}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 10 6"
          className="h-1.5 w-2.5 text-muted-foreground shrink-0"
        >
          <path
            d="M1 1l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.25"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-20 bg-background border border-border rounded-sm overflow-hidden"
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                    selected
                      ? 'bg-accent text-foreground'
                      : 'text-foreground hover:bg-accent'
                  }`}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CheckboxField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 rounded-sm border-border accent-foreground"
      />
      <span>
        <span className="block text-xs text-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * Excel-style input: muted gray background, blue text, no border, no spinner.
 * Prefix (e.g. currency) and suffix (e.g. %, years) live inside the same
 * gray pill as the input. Uses local string state so typing a partial
 * value or clearing the field doesn't snap back. Commits on blur.
 */
function ExcelInput({
  value,
  pct,
  prefix,
  suffix,
  onChange,
  disabled,
}: {
  value: number;
  pct?: boolean;
  prefix?: string;
  suffix?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const toDisplay = (v: number): string => {
    if (!Number.isFinite(v)) return '';
    return String(pct ? v * 100 : v);
  };

  const [local, setLocal] = useState(() => toDisplay(value));

  useEffect(() => {
    setLocal(toDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, pct]);

  const commit = () => {
    const trimmed = local.trim();
    if (trimmed === '' || trimmed === '-') {
      onChange(0);
      setLocal('0');
      return;
    }
    const parsed = parseFloat(trimmed);
    if (!Number.isFinite(parsed)) {
      onChange(0);
      setLocal('0');
      return;
    }
    onChange(pct ? parsed / 100 : parsed);
  };

  const hasPrefix = !!prefix && prefix.trim() !== '';
  const hasSuffix = !!suffix && suffix.trim() !== '';

  // Disabled = derived value: no muted background, no blue input color.
  const wrapperClasses = disabled
    ? 'bg-transparent'
    : 'bg-muted';
  const inputClasses = disabled
    ? 'text-foreground cursor-default'
    : 'text-blue-600 dark:text-blue-400';

  return (
    <div className={`flex items-center rounded-sm ${wrapperClasses}`}>
      {hasPrefix && (
        <span className="pl-2 pr-1 text-[11px] text-muted-foreground shrink-0 select-none">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={local}
        disabled={disabled}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={`flex-1 min-w-0 py-1.5 text-xs tabular-nums text-right bg-transparent focus:outline-none ${inputClasses} ${hasPrefix ? 'pl-1' : 'pl-2'} ${hasSuffix ? 'pr-1' : 'pr-2'}`}
      />
      {hasSuffix && (
        <span className="pr-2 pl-1 text-[11px] text-muted-foreground shrink-0 select-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Compact money helper for inline hint strings. No currency (uses $). */
function formatMoneyShort(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}
