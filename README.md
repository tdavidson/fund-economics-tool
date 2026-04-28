# @tdavidson/fund-economics-tool

Aggregate fund economics — inputs in, TVPI / DPI / IRR / tier breakdown out. TypeScript engine + optional React UI behind the Hemrock [Fund Economics Tool — Web](https://www.hemrock.com/fund-economics-tool-web) (free) and [Venture Capital Model — Web](https://www.hemrock.com/venture-capital-model-web) (paid; comprehensive premium modules layered on top).

Power-law return tiers (writeoff / small / medium / large), per-stage investment strategy with follow-on reserves and explicit follow-on check sizes, GP/LP split with carry, management fees and fund expenses, gross and net multiples and IRRs. Per-side math (LP and GP legs calculated separately then summed). Includes scenario helpers and a Monte Carlo simulator for distribution analysis. No time series — everything aggregated over fund life.

**One package, three entry points.** Import the engine (zero React, zero DOM) at the root. Import the React components at `/ui`. Import the Monte Carlo simulator at `/mc`. Pick what you need.

## Status

**v0.x. The math is in TypeScript; the original Excel template stays as a parallel surface.** The engine is unit-tested and reconciles to the Excel Fund Economics Tool. Drop any `test/fixtures/*.json` with `{ inputs, expected }` and it runs as a parity test.

Companion docs:
- **[Formula map](./docs/formula-map.md)** — compute path, per-side invariants, and how Monte Carlo / scenarios / Return-the-Fund layer on top.

## Install

```bash
npm install @tdavidson/fund-economics-tool
```

React is an optional peer dependency. If you're using the UI components, install React 18+. If you're using the charts inside `/ui`, install `recharts` 2+.

## Use — engine only

Pure TypeScript, runs anywhere Node does (CLI, backend, edge function, data pipeline, test fixture):

```ts
import { computeFund, DEFAULT_INPUTS, type FundInputs } from '@tdavidson/fund-economics-tool';

const result = computeFund(DEFAULT_INPUTS);

console.log(result.grossMultiple.total);   // 4.0
console.log(result.netMultiple.lp);        // ~3.4
console.log(result.grossIRR.total);        // ~0.29 (29% annualized)
console.log(result.netIRR.lp);             // ~0.25
console.log(result.tiers);                 // per-tier breakdown
```

## Inputs reference

`FundInputs` is the only thing you hand to `computeFund`. Everything is a plain number unless noted; percentages are decimals (`0.02` = 2%); money is in the fund's base currency.

### Required

| Field | Type | Meaning |
|---|---|---|
| `committedCapital` | number | Total LP + GP commitments. |
| `gpCommitPct` | 0–1 | GP commit as a share of committed capital. |
| `gpCommitCountedTowardInvested` | boolean | If true, GP commit flows into invested capital and GP pays no fees on its own commit (US venture norm). |
| `organizationalExpenses` | number | One-time organizational expenses. |
| `operationalExpensesAnnual` | number | Ongoing operational expenses per year (fund admin, tax, audit, other). |
| `mgmtFeePct` | 0–1 | Annual management fee rate on committed capital. |
| `recycledCapitalPct` | 0–1 | Recycled capital ceiling as a share of committed. |
| `carryPct` | 0–1 | Carried interest rate (typically `0.20`). |
| `newInvestmentPeriodYears` | number | Years during which the fund makes new investments. |
| `mgmtFeesPeriodYears` | number | Years over which management fees are charged. |
| `portfolio` | `PortfolioAllocation` | `{ newPct, followPct, avgCheckSizeNew, avgCheckSizeFollow, entryStages? }`. |
| `returnTiers` | `ReturnTier[]` | Power-law outcomes; `pctOfCapital` across tiers must sum to 1. |

### Optional

| Field | Type | Meaning |
|---|---|---|
| `partnershipExpensesAnnual` | number | Extra partnership-level expenses per year. Added on top of `operationalExpensesAnnual`. |
| `fundOperationsYears` | number | Explicit fund life in years. Defaults to `newInvestmentPeriod + max(tier.holdingPeriodYears)`. |
| `mgmtFeeSchedule` | `number[]` | Per-year fee rates. Overrides `mgmtFeePct × mgmtFeesPeriodYears`; the engine sums the array. |
| `organizationalExpenseLines` | `{ label, amount }[]` | Itemized one-time org expenses. When set, the provided UI keeps `organizationalExpenses` in sync with the sum. |
| `operationalExpenseLines` | `{ label, amount }[]` | Itemized annual operational expenses (e.g., fund admin, tax, audit). The UI keeps `operationalExpensesAnnual` in sync with the sum. |
| `operationalExpensesBreakout` | `{ fundAdmin, tax, audit, other }` | Legacy fixed-category breakdown. New code should prefer `operationalExpenseLines`. |
| `partnershipExpenseLines` | `{ label, amount }[]` | Same pattern for `partnershipExpensesAnnual`. |
| `tierInputMode` | `'pct-capital' \| 'num-companies'` | Which column of the return-tier table is the user-driven input. `'pct-capital'` (default) reads `pctOfCapital`; `'num-companies'` reads each tier's `numCompanies` and derives `pctOfCapital`. |
| `stageInputMode` | `'pct-capital' \| 'num-companies'` | Same choice for entry stages. Falls back to `tierInputMode`. Separating the two lets stages and return tiers be driven by different conventions. |
| `tierFractional` | boolean | Default `true`. When `false`, per-stage investment counts floor to whole numbers, deployed capital is recomputed from floored counts (`floor(count) × check / (1 − reserve)`), and called capital back-solves from the reduced deployment — i.e., integer-constraint slack surfaces as uncalled capital. |
| `solveCalledFromDeployment` | boolean | Back-solve `calledTotal` from the deployment plan instead of defaulting it to `committedCapital`. Automatically applied whenever a deployment plan exists (stages, target total, or integer mode). |
| `targetTotalInvestments` | number | Fallback total used only in `num-companies` mode when no entry stages are set. |

### Tiers

Each `ReturnTier`:

```ts
{ name: string;            // "writeoff" | "small" | "medium" | "large" | ...
  pctOfCapital: number;    // 0–1, sum across tiers = 1
  multiple: number;        // gross exit multiple (0 = writeoff)
  holdingPeriodYears: number;
  numCompanies?: number;   // read in num-companies mode; ignored in pct-capital mode
}
```

### Entry stages (portfolio.entryStages)

Per-stage investment strategy — the fund's total investment count and deployed capital are derived from the stage table:

```ts
{ name: string;                 // "seed", "Series A", ...
  avgCheckSize: number;         // initial check per investment
  pctAllocation?: number;       // 0–1 share of invested capital (pct-stage mode)
  numInvestments?: number;      // explicit count (num-stage mode)
  reserveRatio?: number;        // 0–1 share held back for follow-ons; default 0
  initialCheckLabel?: string;   // label for the initial-check sub-row in the UI
                                 //   (default: "Initial check")
  followOnChecks?: Array<{      // optional per-round follow-on check sizes
    label?: string;             //   sums of `pctOfReserve` should equal 1
    avgCheckSize: number;       //   used for concentration analysis (RTF) and UI
    pctOfReserve?: number;      //   share of the stage's reserve $ at this round
  }>;
}
```

Per stage, the engine computes:

```
initial_count   = pctAllocation × tentativeInvested × (1 − reserveRatio) / avgCheckSize   // pct mode
              OR  numInvestments                                                          // num mode
full_deployment = initial_count × avgCheckSize / (1 − reserveRatio)
```

When `tierFractional === false`, `initial_count` floors per stage, `full_deployment` is recomputed from the floored count, and `calledTotal` back-solves to the reduced deployment. The uncalled remainder is how much of `committedCapital` can't be put to work given integer investment constraints.

`followOnChecks` and `initialCheckLabel` are surface-only — they don't change aggregate engine math (`stageDeployable` still equals the full allocation). They feed the Return-the-Fund concentration analysis and the in-UI breakdown of how reserves are split into follow-on rounds. See [`docs/formula-map.md`](./docs/formula-map.md) for the per-side compute path.

### Defaults

`DEFAULT_INPUTS` mirrors the Hemrock Excel template: $25M fund, 2% GP commit, 2% / 10yr fees, 10% recycled, 20% carry, 4yr new-investment period, 10yr fund life, 60/20/10/10 tier split, single entry stage at 100% allocation / $750k check / no reserve. Import it as a starting point:

```ts
import { DEFAULT_INPUTS } from '@tdavidson/fund-economics-tool';
const inputs = { ...DEFAULT_INPUTS, committedCapital: 50_000_000 };
```

### Validation

```ts
import { validateInputs } from '@tdavidson/fund-economics-tool';
const inputs = validateInputs(JSON.parse(body));
// Throws a zod error if malformed; returns typed FundInputs on success.
```

## Outputs reference

`FundResult` is what `computeFund` returns. Every line-item that splits between LP and GP is a `LineTotals` triad — `{ total, lp, gp }`.

### Headline metrics (what to track)

| Field | Type | Meaning |
|---|---|---|
| `grossMultiple` | `LineTotals` | Proceeds / invested capital. Same value for total / LP / GP. |
| `netMultiple` | `LineTotals` | Distributions / called capital. LP and GP diverge when `gpCommitCountedTowardInvested` is true (LP shoulders fees, so LP invested < pro-rata). |
| `grossIRR` | `LineTotals` | `grossMultiple ^ (1 / weightedHold) − 1`. |
| `netIRR` | `LineTotals` | `netMultiple ^ (1 / weightedHold) − 1`. |
| `tvpi` | number | DPI + RVPI (= `netMultiple.total` while fully realized). |
| `dpi` | number | Distributions / called (total fund). |
| `rvpi` | number | Unrealized / called. 0 at end of fund life. |
| `pic` | number | Called / committed. |

### Capital accounting

| Field | Meaning |
|---|---|
| `committedCapital` | Echo of the input (nominal fund size). |
| `calledCapital` | Capital called from investors. Equals `committedCapital` unless the fund is in solve mode (stages / target total / integer mode), in which case it back-solves from the deployment plan. |
| `managementFees` | Fees over the fee period. GP is 0 when `gpCommitCountedTowardInvested`. |
| `partnershipExpenses` | `organizational + (operational + partnership annuals) × fundOperationsYears`. |
| `recycledCapital` | Recycled capital ceiling (included inside invested). |
| `investedCapital` | Per side: `called − fees − expenses + recycled`. Total = LP + GP. LP < pro-rata when GP commit is counted. |

### Returns

The waterfall — how proceeds become distributions + carry — runs per side:

```
profit.lp  = max(0, (proceeds.lp − recycled.lp) − called.lp)
carry.lp   = profit.lp × carryPct
dist.lp    = max(0, (proceeds.lp − recycled.lp) − carry.lp)

carry.gp   = 0                                        // GP earns carry, doesn't pay it on its own profit
dist.gp    = max(0, (proceeds.gp − recycled.gp))
```

Totals are the sum of the two legs. Proceeds per side = `invested.side × grossMultiple`.

| Field | Meaning |
|---|---|
| `proceeds` | Gross exit proceeds per side (invested × gross multiple), before carry. |
| `carriedInterestPaid` | Carry paid out of each side's profit. GP = 0 by construction. |
| `carriedInterestEarned` | Carry received. GP = total pool; LP = 0. |
| `distributions` | Per side: `proceeds − recycled − carry`. |

### Timing + per-tier

| Field | Meaning |
|---|---|
| `weightedHoldPeriodYears` | Proceeds-weighted hold across tiers. Used for IRR annualization. |
| `fundOperationsYears` | Fund life actually used by the compute (override or default). |
| `tiers` | `TierResult[]` — per tier: invested, numInvestments, proceeds, pctOfProceeds, weightedMultiple. |

## Scenarios

`applyScenario(base, delta)` merges a `DeepPartial<FundInputs>` over a base and returns a fully-resolved `FundInputs` you hand to `computeFund`. Arrays (like `returnTiers`) replace wholesale — pass the full array if you want to change it.

```ts
import { applyScenario, computeFund, DEFAULT_INPUTS } from '@tdavidson/fund-economics-tool';

const conservative = applyScenario(DEFAULT_INPUTS, {
  returnTiers: [
    { name: 'writeoff', pctOfCapital: 0.70, multiple: 0,    holdingPeriodYears: 2 },
    { name: 'small',    pctOfCapital: 0.20, multiple: 1.5,  holdingPeriodYears: 3 },
    { name: 'medium',   pctOfCapital: 0.07, multiple: 5,    holdingPeriodYears: 4 },
    { name: 'large',    pctOfCapital: 0.03, multiple: 18,   holdingPeriodYears: 6 },
  ],
});

const result = computeFund(conservative);
```

For a list of named scenarios, use `resolveScenarios(base, scenarios)`:

```ts
import { resolveScenarios, computeFund } from '@tdavidson/fund-economics-tool';

const resolved = resolveScenarios(DEFAULT_INPUTS, [
  { name: 'Base',         delta: {} },
  { name: 'Conservative', delta: { returnTiers: [/* … */] } },
  { name: 'High',         delta: { returnTiers: [/* … */] } },
]);

resolved.forEach(({ name, inputs }) => {
  const r = computeFund(inputs);
  console.log(name, r.netMultiple.lp);
});
```

## Monte Carlo

Sub-path export. For each iteration, every investment draws its return tier via multinomial on `pctOfCapital`, then draws an exit multiple from a lognormal whose **mean equals the tier's stated multiple**. Tier multiples are treated as expected exit values (the conventional VC reading of "my large exits average 32x"), so the simulation's per-iteration gross MOIC reconciles to the deterministic `Σ(pct × tier.multiple)` reported on the Outputs tab. Writeoffs stay at 0. All other inputs (fund size, fees, stages, carry) stay fixed.

```ts
import { DEFAULT_INPUTS } from '@tdavidson/fund-economics-tool';
import { runMonteCarlo } from '@tdavidson/fund-economics-tool/mc';

const mc = runMonteCarlo(DEFAULT_INPUTS, {
  iterations: 10000,
  seed: 42,              // omit for Date.now(); fixed seed = reproducible
  // multipleSigma: 1.0,  // optional — σ at the highest-multiple tier; default 1.0
});

console.log(mc.distributions.netMultiple.lp.p5, mc.distributions.netMultiple.lp.p50, mc.distributions.netMultiple.lp.p95);
console.log(mc.distributions.netMultiple.total.p50);  // fund-level net MOIC
console.log(mc.probLossOfCapital);  // P(LP net MOIC < 1)
```

### Per-tier σ scaling

Real VC outcomes have wildly different variability by tier — a "small" exit at a 1.5x mean is rarely far from 1.5x, but a "large" exit at a 32x mean can land anywhere from ~10x to over 100x. Modeling all tiers with the same σ understates this skew.

The engine scales σ per tier by `log(1 + tier.multiple) / log(1 + max_tier_multiple)`:

- Writeoffs (multiple = 0) → σ = 0 (always 0x).
- Smaller-multiple tiers → smaller σ → tight spread around their stated multiple.
- The largest-multiple tier → σ = `multipleSigma` (the option you pass) → widest spread.

With `multipleSigma: 1.0` (default), the Hemrock default tiers (1.5x / 5x / 32x), and lognormal mean = stated tier multiple:

| Tier | Mean (= stated) | Per-tier σ | Median | Roughly p5 – p95 |
|---|---|---|---|---|
| Small | 1.5x | 0.26 | 1.45x | ~0.95x – 2.2x |
| Medium | 5x | 0.51 | 4.4x | ~1.9x – 10.2x |
| Large | 32x | 1.00 | 19.4x | ~3.7x – 100x |

You don't normally tune `multipleSigma`. The variance is implicit in the tier multiples themselves — bump the large-tier multiple if you want fatter tails; lower it if you want a tighter distribution. `multipleSigma` exists as an escape hatch if you want to dial all spread up or down uniformly.

### Output shape

`distributions` includes:

- `grossMultiple` — single distribution (same for total / LP / GP)
- `netMultiple: { total, lp }` — net MOIC, fund-level vs LP-only (they diverge when GP commit is counted)
- `grossIRR` — single distribution
- `netIRR: { total, lp }` — same total / LP split

Each distribution has `{p5, p25, p50, p75, p95, mean, stdev, samples}`. Raw `samples` are provided so you can render histograms or CDFs however you want.

`probLossOfCapital` is `P(LP net MOIC < 1)` — the share of runs where LPs don't recover their called capital.

Inline compute is ~200ms for 10k iterations on default inputs. Call from a `useMemo`, a web worker, or a server route — all work.

## Use your own UI

The engine is pure and deterministic — every frame of your own UI is just another call. Any framework, any style system.

```tsx
import { useMemo, useState } from 'react';
import { computeFund, DEFAULT_INPUTS, type FundInputs } from '@tdavidson/fund-economics-tool';

export function MyFundPage() {
  const [inputs, setInputs] = useState<FundInputs>(DEFAULT_INPUTS);
  const result = useMemo(() => computeFund(inputs), [inputs]);

  return (
    <form>
      <input
        type="number"
        value={inputs.committedCapital}
        onChange={(e) =>
          setInputs({ ...inputs, committedCapital: Number(e.target.value) })
        }
      />

      <div>Gross multiple: {result.grossMultiple.total.toFixed(2)}x</div>
      <div>Net IRR (LP): {(result.netIRR.lp * 100).toFixed(1)}%</div>
      <div>TVPI: {result.tvpi.toFixed(2)}x</div>
    </form>
  );
}
```

Patterns that work well:

- **Dashboard / BI tool** — subscribe to your own state store; call `computeFund` inside a `useMemo` / reactive derived signal. No need for any code from `/ui`.
- **LP report generator** — call `computeFund` server-side, serialize `FundResult` to JSON, render however your report tooling expects.
- **API endpoint** — POST takes `FundInputs`, validate with `validateInputs`, return `computeFund(inputs)` as JSON.
- **Scenario sweep** — wrap `computeFund` in a loop over one variable (committed capital, carry pct, tier mix) and chart the resulting metric.

Bring your own design system — the engine has no styling opinions. The only styling is inside `@tdavidson/fund-economics-tool/ui`, which you're free to ignore.

## Use — shipped React components (optional)

Drop-in UI under the `/ui` subpath. Styled with Tailwind utility classes matching the Hemrock design system (monochrome, 2px radius, no shadows).

```tsx
import { useState, useMemo } from 'react';
import { computeFund, DEFAULT_INPUTS, type FundInputs } from '@tdavidson/fund-economics-tool';
import {
  FundInputsForm,
  FundSummaryTable,
  FundReturnsTable,
  TierBreakdownTable,
  FundCapitalFlowChart,
  InvestmentOutcomesChart,
  AllocationChart,
  StickyMultiplesBox,
  ChevronSelect,
} from '@tdavidson/fund-economics-tool/ui';

export default function FundEconomicsDemo() {
  const [inputs, setInputs] = useState<FundInputs>(DEFAULT_INPUTS);
  const result = useMemo(() => computeFund(inputs), [inputs]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,1fr)_minmax(0,3fr)] gap-10">
      <FundInputsForm value={inputs} onChange={setInputs} />
      <div className="space-y-6">
        <StickyMultiplesBox result={result} />
        <FundCapitalFlowChart result={result} />
        <AllocationChart inputs={inputs} result={result} />
        <InvestmentOutcomesChart result={result} />
        <FundSummaryTable result={result} />
        <FundReturnsTable result={result} />
        <TierBreakdownTable result={result} />
      </div>
    </div>
  );
}
```

All UI components accept an optional `display?: { currency: string; scale: 'units' | 'thousands' | 'millions' | 'billions' }` prop to control how money is rendered.

### Tailwind preset

If you want the design tokens the components expect (border, muted-foreground, etc.), add the preset:

```js
// your tailwind.config.js
module.exports = {
  presets: [require('@tdavidson/fund-economics-tool/tailwind.preset')],
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/@tdavidson/fund-economics-tool/dist/ui/**/*.js',
  ],
};
```

Already using [shadcn/ui](https://ui.shadcn.com) or a similar design system? The tokens line up (`border`, `foreground`, `muted-foreground`, `background`, `muted`, `accent`, `destructive`), so you can skip the preset.

## Model shape

Defined in [`src/types.ts`](src/types.ts):

- `FundInputs` — capital + fund assumptions, time periods, portfolio construction (with entry stages), return tiers
- `FundResult` — Total Fund / LP Only / GP Only breakdown for every major line (called, fees, expenses, invested, proceeds, carry paid / earned, distributions, multiples, IRRs), PIC/DPI/RVPI/TVPI, per-tier detail
- `ReturnTier`, `PortfolioAllocation`, `EntryStage`, `LineTotals`, `TierResult`, `OrganizationalExpenseLine`, `OperationalExpenseLine`, `PartnershipExpenseLine`

## What this model does NOT include

This is the simplified aggregate model. If you need more precision — quarterly cash flows, multi-stage graduation, date-gated recycling, per-investment tracking — use the full [Venture Capital Model](https://www.hemrock.com/venture-fund-model).

Specifically missing:

- Time-series cash flows (IRR uses geometric annualization: `mult^(1/weighted_hold) − 1`)
- Graduation between stages (Seed → Series A → … is modeled as separate initial-check buckets)
- Recycling timing (uses the ceiling, not a date-gated base)
- Preferred return + GP catchup waterfalls (carry is simple `profit × carryPct`)
- Per-deal carry, specialty waterfalls, and other GP-compensation edge cases

## Related

- [@hemrock/fund-accounting](https://github.com/tdavidson/fund-accounting) — plain-text double-entry accounting for funds
- [Hemrock MCP server](https://www.hemrock.com/mcp) — live AI context for editing Hemrock models
- [Hemrock Skill](https://www.hemrock.com/skill) — drop-in skill for Claude Projects

## License

Source-available, **not** open source. Free for a single fund management company applying it to its own funds, SPVs, and team. A commercial license is required for fund administrators, outsourced CFOs, consultants, and any service provider using the package across multiple clients, as well as for SaaS / white-label / embedded distribution. See [`LICENSE`](./LICENSE) for the full terms or contact hello@hemrock.com for commercial licensing.

### License FAQ

A non-exhaustive list of the questions people actually ask. The License is the binding text; this section is intent.

**Can I use this for my own fund?**
Yes, free. If you're the GP (or a partner / employee / contractor of the GP) of a single fund management company modeling that company's funds and SPVs, you fall under the Internal Use grant in Section 2. Multiple funds and SPVs under the same management company count as one Fund Entity. Use it.

**Can I use this on a personal weekend project, a class assignment, or to learn fund economics?**
Yes, free. Section 2A (Personal Evaluation and Educational Use) covers individual non-commercial use — including evaluation, learning, hobby projects, and personal research. Up to ninety days of substantive use, indefinitely for genuinely non-commercial purposes. Don't worry about clocking the days; the spirit of the clause is that personal use is welcome.

**Can my fund administrator run this for me?**
Not under the free license. Fund administrators serve multiple Fund Entities by definition, which puts them in Service Provider territory under Sections 1 and 4. They need a Commercial License. Email hello@hemrock.com.

**I'm an outsourced CFO with one client. Free or paid?**
Free if you're truly working for one Fund Entity exclusively — that's effectively Internal Use under Section 2. The moment you take on a second Fund Entity client and use the package across both, you become a Service Provider under Section 1 and need a Commercial License. (One client today, six clients next year, switching to commercial is the cleanest path.)

**Can I fork it and publish my fork on GitHub?**
You can fork for Internal Use and modify privately. You cannot publish a public fork or distribute a modified version under a different license. Section 5 covers modifications; Section 3 prohibits redistribution outside the npm registry's normal mechanics.

**Can I build a SaaS that uses this internally?**
No. Section 3 explicitly prohibits SaaS, white-label, and embedded distribution. Section 4 lists this as one of the cases where a Commercial License is required. Email hello@hemrock.com.

**Is this OSI-approved open source?**
No. It's source-available. The code is published; the use is restricted by the License terms above. This means tools like `license-checker` will report it as "Custom" or "Other," which can trigger procurement reviews at large companies. If your company auto-blocks non-OSI licenses, contact hello@hemrock.com — a Commercial License will satisfy procurement.

**What happens if I accidentally use it commercially without a license?**
The License has a 30-day cure period (Section 9). If you realize you've crossed into Service Provider or SaaS territory, email hello@hemrock.com — we'll work out a Commercial License or you'll have time to wind down the usage. The license doesn't terminate the moment you violate; it terminates if you don't cure within 30 days of notice. Some breaches (publishing a re-licensed fork) terminate immediately and aren't curable.

**Why source-available and not MIT?**
Two reasons. First, this is the engine behind a paid product — keeping it source-available means a competing service can't trivially turn it into their own SaaS. Second, the source-available pattern lets us keep development funded: fund administrators and SaaS vendors who get real commercial value from the package contribute back via the Commercial License, which keeps the engine maintained for the single-Fund-Entity users who get it for free.

**Will the license ever change?**
Re-licensing to a more permissive license isn't planned. Re-licensing to a more restrictive license is a non-goal — if anything, the personal-use carveout in Section 2A may grow over time. If we ever do change the license, existing versions stay available under the version of the License they shipped with.

For anything not covered here, read [`LICENSE`](./LICENSE) or email hello@hemrock.com.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Short version: bug fixes and doc improvements are welcome; bigger changes warrant an issue first; contributions assign copyright to Unstructured Ventures, LLC so the License stays enforceable for everyone.
