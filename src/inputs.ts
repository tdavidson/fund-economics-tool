/**
 * Input validation via zod.
 */

import { z } from 'zod';
import type { FundInputs } from './types.js';

const returnTierSchema = z.object({
  name: z.string().min(1),
  pctOfCapital: z.number().min(0).max(1),
  multiple: z.number().min(0),
  holdingPeriodYears: z.number().min(0),
  numCompanies: z.number().min(0).optional(),
});

const entryStageSchema = z.object({
  name: z.string(),
  numInvestments: z.number().min(0),
  avgCheckSize: z.number().min(0),
  pctAllocation: z.number().min(0).max(1).optional(),
  reserveRatio: z.number().min(0).max(1).optional(),
  initialCheckLabel: z.string().optional(),
  followOnChecks: z
    .array(
      z.object({
        label: z.string().optional(),
        avgCheckSize: z.number().min(0),
        pctOfReserve: z.number().min(0).max(1).optional(),
      }),
    )
    .optional(),
});

const portfolioAllocationSchema = z.object({
  newPct: z.number().min(0).max(1),
  followPct: z.number().min(0).max(1),
  avgCheckSizeNew: z.number().min(0),
  avgCheckSizeFollow: z.number().min(0),
  entryStages: z.array(entryStageSchema).optional(),
}).refine(
  (p) => Math.abs(p.newPct + p.followPct - 1) < 1e-6,
  { message: 'portfolio.newPct + portfolio.followPct must sum to 1.0' },
);

const operationalExpensesBreakoutSchema = z.object({
  fundAdmin: z.number().min(0),
  tax: z.number().min(0),
  audit: z.number().min(0),
  other: z.number().min(0),
});

const partnershipExpenseLineSchema = z.object({
  label: z.string(),
  amount: z.number().min(0),
});

const operationalExpenseLineSchema = z.object({
  label: z.string(),
  amount: z.number().min(0),
});

const organizationalExpenseLineSchema = z.object({
  label: z.string(),
  amount: z.number().min(0),
});

export const fundInputsSchema = z.object({
  committedCapital: z.number().positive(),
  gpCommitPct: z.number().min(0).max(1),
  gpCommitCountedTowardInvested: z.boolean(),
  organizationalExpenses: z.number().min(0),
  organizationalExpenseLines: z.array(organizationalExpenseLineSchema).optional(),
  operationalExpensesAnnual: z.number().min(0),
  operationalExpensesBreakout: operationalExpensesBreakoutSchema.optional(),
  operationalExpenseLines: z.array(operationalExpenseLineSchema).optional(),
  partnershipExpensesAnnual: z.number().min(0).optional(),
  partnershipExpenseLines: z.array(partnershipExpenseLineSchema).optional(),
  mgmtFeePct: z.number().min(0).max(1),
  mgmtFeeSchedule: z.array(z.number().min(0).max(1)).optional(),
  recycledCapitalPct: z.number().min(0).max(1),
  carryPct: z.number().min(0).max(1),
  newInvestmentPeriodYears: z.number().positive(),
  mgmtFeesPeriodYears: z.number().positive(),
  fundOperationsYears: z.number().positive().optional(),
  portfolio: portfolioAllocationSchema,
  returnTiers: z.array(returnTierSchema).min(1).refine(
    (tiers) => {
      const sum = tiers.reduce((s, t) => s + t.pctOfCapital, 0);
      return Math.abs(sum - 1) < 1e-6;
    },
    { message: 'returnTiers pctOfCapital must sum to 1.0' },
  ),
  tierInputMode: z.enum(['pct-capital', 'num-companies']).optional(),
  stageInputMode: z.enum(['pct-capital', 'num-companies']).optional(),
  tierFractional: z.boolean().optional(),
  solveCalledFromDeployment: z.boolean().optional(),
  targetTotalInvestments: z.number().min(0).optional(),
}) satisfies z.ZodType<FundInputs>;

export function validateInputs(raw: unknown): FundInputs {
  return fundInputsSchema.parse(raw);
}

/** Hemrock Fund Economics Tool defaults. */
export const DEFAULT_INPUTS: FundInputs = {
  committedCapital: 25_000_000,
  gpCommitPct: 0.02,
  gpCommitCountedTowardInvested: true,
  organizationalExpenses: 150_000,
  operationalExpensesAnnual: 100_000,
  partnershipExpensesAnnual: 0,
  mgmtFeePct: 0.02,
  recycledCapitalPct: 0.10,
  carryPct: 0.20,
  newInvestmentPeriodYears: 4,
  mgmtFeesPeriodYears: 10,
  fundOperationsYears: 10,
  portfolio: {
    newPct: 1.0,
    followPct: 0,
    avgCheckSizeNew: 750_000,
    avgCheckSizeFollow: 0,
    entryStages: [
      {
        name: 'Average Investment',
        numInvestments: 0,
        avgCheckSize: 750_000,
        pctAllocation: 1.0,
        reserveRatio: 0,
      },
    ],
  },
  returnTiers: [
    { name: 'writeoff', pctOfCapital: 0.60, multiple: 0,   holdingPeriodYears: 2 },
    { name: 'small',    pctOfCapital: 0.20, multiple: 1.5, holdingPeriodYears: 3 },
    { name: 'medium',   pctOfCapital: 0.10, multiple: 5,   holdingPeriodYears: 4 },
    { name: 'large',    pctOfCapital: 0.10, multiple: 32,  holdingPeriodYears: 6 },
  ],
};
