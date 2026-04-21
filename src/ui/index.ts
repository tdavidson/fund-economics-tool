/**
 * React components for @hemrock/fund-economics-tool.
 *
 * Imported via subpath: `import { FundInputsForm } from '@hemrock/fund-economics-tool/ui'`.
 * React is an optional peer dependency — Node-only users never reach this
 * subpath and never pull React into their bundle.
 *
 * Styled with Tailwind utility classes matching the Hemrock design system
 * (monochrome, 2px radius, no shadows). See `@hemrock/fund-economics-tool/tailwind.preset`
 * for design tokens consumers can add to their Tailwind config.
 *
 * Usage:
 *   import { computeFund, DEFAULT_INPUTS } from '@hemrock/fund-economics-tool';
 *   import {
 *     FundInputsForm,
 *     FundSummaryTable,
 *     FundReturnsTable,
 *     TierBreakdownTable,
 *   } from '@hemrock/fund-economics-tool/ui';
 */

export { FundInputsForm } from './FundInputsForm.js';
export { FundSummaryTable } from './FundSummaryTable.js';
export { FundReturnsTable } from './FundReturnsTable.js';
export { TierBreakdownTable } from './TierBreakdownTable.js';

export { formatMoney, formatPct, formatMultiple, formatNumber } from './format.js';
