/**
 * React components for @tdavidson/fund-economics-tool.
 *
 * Imported via subpath: `import { FundInputsForm } from '@tdavidson/fund-economics-tool/ui'`.
 * React is an optional peer dependency — Node-only users never reach this
 * subpath and never pull React into their bundle.
 *
 * Styled with Tailwind utility classes matching the Hemrock design system
 * (monochrome, 2px radius, no shadows). See `@tdavidson/fund-economics-tool/tailwind.preset`
 * for design tokens consumers can add to their Tailwind config.
 *
 * Usage:
 *   import { computeFund, DEFAULT_INPUTS } from '@tdavidson/fund-economics-tool';
 *   import {
 *     FundInputsForm,
 *     FundSummaryTable,
 *     FundReturnsTable,
 *     TierBreakdownTable,
 *   } from '@tdavidson/fund-economics-tool/ui';
 */

export { FundInputsForm, ChevronSelect } from './FundInputsForm.js';
export type { FormSection } from './FundInputsForm.js';
export { FundSummaryTable } from './FundSummaryTable.js';
export { FundReturnsTable } from './FundReturnsTable.js';
export { TierBreakdownTable } from './TierBreakdownTable.js';

export { formatMoney, formatPct, formatMultiple, formatNumber, pickDisplayScale } from './format.js';
export { FundCapitalFlowChart } from './FundCapitalFlowChart.js';
export { InvestmentOutcomesChart } from './InvestmentOutcomesChart.js';
export { AllocationChart } from './AllocationChart.js';
export { StickyMultiplesBox } from './StickyMultiplesBox.js';
export type { DisplayOptions, Scale } from './format.js';
