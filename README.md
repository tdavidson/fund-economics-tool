# @hemrock/fund-economics

Aggregate fund economics — inputs in, TVPI/DPI/IRR/tier-breakdown out. TypeScript port of the [Hemrock Fund Economics Tool](https://www.hemrock.com/venture-fund-model-overall).

Power-law return tiers (writeoff / small / medium / large), GP/LP split with carry, management fees and fund expenses, optional preferred-return + GP-catchup waterfall, gross and net multiples and IRRs. No time-series — everything aggregated over fund life.

**One package, two entry points.** Import just the engine (zero React, zero DOM), or import the React components too. Your choice.

## Status

**v0.x. Excel is canonical.** The TS engine is validated against Excel fixtures in the test suite — drop any `test/fixtures/*.json` with `{ inputs, expected }` and it runs as a parity test.

## Install

```bash
npm install @hemrock/fund-economics
```

React is an optional peer dependency. If you're using the UI components, install React 18+.

## Use — engine only

Pure TypeScript, runs anywhere Node does (CLI, backend, edge function, data pipeline, test fixture):

```ts
import { computeFund, DEFAULT_INPUTS, type FundInputs } from '@hemrock/fund-economics-tool';

const result = computeFund(DEFAULT_INPUTS);

console.log(result.grossMultiple.total);   // 4.0
console.log(result.netMultiple.lp);        // ~3.4
console.log(result.grossIRR.total);        // ~0.29 (29% annualized)
console.log(result.netIRR.lp);             // ~0.25
console.log(result.tiers);                 // per-tier breakdown
```

## Use — React components

Drop-in UI under the `/ui` subpath. Styled with Tailwind utility classes matching the Hemrock design system (monochrome, 2px radius, no shadows).

```tsx
import { useState, useMemo } from 'react';
import { computeFund, DEFAULT_INPUTS, type FundInputs } from '@hemrock/fund-economics-tool';
import {
  FundInputsForm,
  FundSummaryTable,
  FundReturnsTable,
  TierBreakdownTable,
} from '@hemrock/fund-economics-tool/ui';

export default function FundEconomicsDemo() {
  const [inputs, setInputs] = useState<FundInputs>(DEFAULT_INPUTS);
  const result = useMemo(() => computeFund(inputs), [inputs]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <FundInputsForm value={inputs} onChange={setInputs} />
      <div className="space-y-6">
        <FundSummaryTable result={result} />
        <FundReturnsTable result={result} />
        <TierBreakdownTable result={result} />
      </div>
    </div>
  );
}
```

### Tailwind preset

If you want the design tokens the components expect (border, muted-foreground, etc.), add the preset:

```js
// your tailwind.config.js
module.exports = {
  presets: [require('@hemrock/fund-economics-tool/tailwind.preset')],
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/@hemrock/fund-economics-tool/dist/ui/**/*.js',
  ],
};
```

Already using [shadcn/ui](https://ui.shadcn.com) or a similar design system? The tokens line up (`border`, `foreground`, `muted-foreground`, `background`, `muted`, `accent`, `destructive`), so you can skip the preset.

## Validate untrusted input

```ts
import { validateInputs } from '@hemrock/fund-economics-tool';

const inputs = validateInputs(JSON.parse(body));
// Throws a zod error if malformed; returns typed FundInputs on success.
```

## Model shape

Defined in [`src/types.ts`](src/types.ts):

- `FundInputs` — capital + fund assumptions, time periods, portfolio construction, return tiers, optional waterfall
- `FundResult` — Total Fund / LP Only / GP Only breakdown for every major line (called, fees, expenses, invested, proceeds, preferred return, GP catchup, carry, distributions, multiples, IRRs), PIC/DPI/RVPI/TVPI, per-tier detail
- `ReturnTier`, `PortfolioAllocation`, `Waterfall`, `LineTotals`, `TierResult`

## What this model does NOT include

This is the simplified aggregate model. If you need more precision — quarterly cash flows, multi-stage graduation, recycling provisions timing, per-investment tracking — use the full [Venture Capital Model](https://www.hemrock.com/venture-fund-model).

Specifically missing:
- Time-series cash flows (IRR uses geometric annualization: `mult^(1/weighted_hold) - 1`)
- Multi-stage investment strategies (Seed → Series A → …)
- Recycling timing (uses the ceiling, not a date-gated base)
- GP commit edge cases (specialty waterfalls, per-deal carry, etc.)

## Related

- [@hemrock/fund-accounting](https://github.com/tdavidson/fund-accounting) — plain-text double-entry accounting for funds
- [Hemrock MCP server](https://www.hemrock.com/mcp) — live AI context for editing Hemrock models
- [Hemrock Skill](https://www.hemrock.com/skill) — drop-in skill for Claude Projects

## License

MIT
