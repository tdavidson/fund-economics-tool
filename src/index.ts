/**
 * @hemrock/fund-economics
 *
 * Aggregate fund economics — inputs in, TVPI/DPI/IRR/tier-breakdown out.
 * TypeScript port of the Hemrock Fund Economics Tool. Excel remains the
 * source of truth for v0.x; the TS engine is validated against Excel
 * fixtures in the test suite.
 *
 * Usage:
 *   import { computeFund, DEFAULT_INPUTS } from '@hemrock/fund-economics-tool';
 *   const result = computeFund(DEFAULT_INPUTS);
 *   console.log(result.grossMultiple, result.netIRR);
 */

export { computeFund } from './compute.js';
export { validateInputs, fundInputsSchema, DEFAULT_INPUTS } from './inputs.js';
export type {
  FundInputs,
  FundResult,
  TierResult,
  ReturnTier,
  PortfolioAllocation,
  Waterfall,
  LineTotals,
} from './types.js';
