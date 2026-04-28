/**
 * @tdavidson/fund-economics-tool
 *
 * Aggregate fund economics — inputs in, TVPI/DPI/IRR/tier-breakdown out.
 * TypeScript port of the Hemrock Fund Economics Tool. Excel remains the
 * source of truth for v0.x; the TS engine is validated against Excel
 * fixtures in the test suite.
 *
 * Usage:
 *   import { computeFund, DEFAULT_INPUTS } from '@tdavidson/fund-economics-tool';
 *   const result = computeFund(DEFAULT_INPUTS);
 *   console.log(result.grossMultiple, result.netIRR);
 */

export { computeFund } from './compute.js';
export { validateInputs, fundInputsSchema, DEFAULT_INPUTS } from './inputs.js';
export { applyScenario, resolveScenarios } from './scenarios.js';
export type { Scenario, ScenarioResult, DeepPartial } from './scenarios.js';
export type {
  FundInputs,
  FundResult,
  TierResult,
  ReturnTier,
  PortfolioAllocation,
  EntryStage,
  LineTotals,
  OrganizationalExpenseLine,
  PartnershipExpenseLine,
  OperationalExpenseLine,
  OperationalExpensesBreakout,
  MgmtFeeSchedule,
  TierInputMode,
} from './types.js';
