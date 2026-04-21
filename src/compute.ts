/**
 * Fund Economics computation.
 *
 * Direct port of the Hemrock Fund Economics Tool (`Forecast` sheet,
 * Excel v0.x). Every formula below is annotated with the source cell and
 * translated from the extracted spreadsheet logic. See the companion
 * README for the model-level simplifications.
 *
 * One extension beyond the Excel: an optional preferred-return + GP-catchup
 * waterfall (inputs.waterfall). When omitted, the engine matches Excel
 * exactly. When enabled, distributions run the full European waterfall.
 */

import type {
  FundInputs,
  FundResult,
  TierResult,
  LineTotals,
} from './types.js';

/** Build a Total/LP/GP triad with a helper. */
function triad(total: number, lpPct: number, gpPct: number): LineTotals {
  return { total, lp: total * lpPct, gp: total * gpPct };
}

/** Compute the full Fund Economics result from typed inputs. */
export function computeFund(inputs: FundInputs): FundResult {
  const lpPct = 1 - inputs.gpCommitPct;
  const gpPct = inputs.gpCommitPct;

  // ── Called capital (R44). All committed is called in v0.x. ────────────────
  const calledCapital: LineTotals = triad(inputs.committedCapital, lpPct, gpPct);

  // ── Partnership expenses (R11 + R12, summed over fund life). ──────────────
  // Excel: F45 = -(F11 + F12) = org + ops*years. Split LP/GP pro-rata on commit.
  // Fund-ops years = newInvestmentPeriod + max tier hold period.
  const maxHoldYears = Math.max(...inputs.returnTiers.map((t) => t.holdingPeriodYears));
  const fundOperationsYears = inputs.newInvestmentPeriodYears + maxHoldYears;
  const partnershipExpensesTotal =
    inputs.organizationalExpenses +
    inputs.operationalExpensesAnnual * fundOperationsYears;
  const partnershipExpenses = triad(partnershipExpensesTotal, lpPct, gpPct);

  // ── Management fees (R46). ────────────────────────────────────────────────
  // Excel: F13 = mgmtPct * period * committed * (if GP counted: 1-gpPct else 1).
  // When counted: GP pays no fees on its own commit. LP pays mgmtPct*period*LPcap.
  // When not counted: LP + GP each pay mgmtPct*period*theirCap, so total is
  // mgmtPct*period*committed.
  const feeMultiplier = inputs.mgmtFeePct * inputs.mgmtFeesPeriodYears;
  const mgmtFeeLP = feeMultiplier * calledCapital.lp;
  const mgmtFeeGP = inputs.gpCommitCountedTowardInvested
    ? 0
    : feeMultiplier * calledCapital.gp;
  const managementFees: LineTotals = {
    total: mgmtFeeLP + mgmtFeeGP,
    lp: mgmtFeeLP,
    gp: mgmtFeeGP,
  };

  // ── Recycled capital (R47). ──────────────────────────────────────────────
  // Excel: F47 = E14 * E9 = recycledPct * committed. Split pro-rata.
  const recycledCapitalTotal = inputs.recycledCapitalPct * inputs.committedCapital;
  const recycledCapital = triad(recycledCapitalTotal, lpPct, gpPct);

  // ── Invested capital (R48). ──────────────────────────────────────────────
  // Excel: F48 = F44 - F45 - F46 + F47 = called - expenses - fees + recycled.
  const investedCapitalLP =
    calledCapital.lp - partnershipExpenses.lp - managementFees.lp + recycledCapital.lp;
  const investedCapitalGP =
    calledCapital.gp - partnershipExpenses.gp - managementFees.gp + recycledCapital.gp;
  const investedCapitalTotal = investedCapitalLP + investedCapitalGP;
  const investedCapital: LineTotals = {
    total: investedCapitalTotal,
    lp: investedCapitalLP,
    gp: investedCapitalGP,
  };

  // ── Return tier math (R35-R39). ──────────────────────────────────────────
  // Gross multiple = SUMPRODUCT(multiples, pctOfCapital). Tier proceeds are
  // tierInvested × multiple. We compute pctOfProceeds as
  // tierProceeds / totalProceeds for the weighted hold calculation (R39).
  const grossMultipleValue = inputs.returnTiers.reduce(
    (sum, t) => sum + t.pctOfCapital * t.multiple,
    0,
  );
  const proceedsTotal = grossMultipleValue * investedCapitalTotal;

  // Per-tier investments count. Excel distributes the total new-check count
  // across tiers by pctOfCapital (F35 = E35 * F$39).
  const weightedAvgCheck =
    inputs.portfolio.newPct * inputs.portfolio.avgCheckSizeNew +
    inputs.portfolio.followPct * inputs.portfolio.avgCheckSizeFollow;
  const totalNewChecks = weightedAvgCheck > 0 ? investedCapitalTotal / weightedAvgCheck : 0;

  const tiers: TierResult[] = inputs.returnTiers.map((tier) => {
    const tierInvested = investedCapitalTotal * tier.pctOfCapital;
    const tierProceeds = tierInvested * tier.multiple;
    const pctOfProceeds = proceedsTotal > 0 ? tierProceeds / proceedsTotal : 0;
    return {
      name: tier.name,
      pctOfCapital: tier.pctOfCapital,
      multiple: tier.multiple,
      holdingPeriodYears: tier.holdingPeriodYears,
      investedCapital: tierInvested,
      numInvestments: totalNewChecks * tier.pctOfCapital,
      proceeds: tierProceeds,
      pctOfProceeds,
      weightedMultiple: tier.pctOfCapital * tier.multiple,
    };
  });

  // Proceeds pro-rata on invested capital.
  const proceedsLPPct = investedCapitalTotal > 0 ? investedCapitalLP / investedCapitalTotal : 0;
  const proceedsGPPct = investedCapitalTotal > 0 ? investedCapitalGP / investedCapitalTotal : 0;
  const proceeds: LineTotals = {
    total: proceedsTotal,
    lp: proceedsTotal * proceedsLPPct,
    gp: proceedsTotal * proceedsGPPct,
  };

  // ── Proceeds-weighted hold period (R39 H column). ───────────────────────
  // Excel: H39 = SUMPRODUCT(H35:H38, I35:I38) where I is pct of proceeds.
  const weightedHoldPeriodYears = tiers.reduce(
    (sum, t) => sum + t.holdingPeriodYears * t.pctOfProceeds,
    0,
  );

  // ── Waterfall (carry + distributions) ────────────────────────────────────
  // Default path (matches Excel R50):
  //   carry = max(0, (proceeds - called - recycled) × carryPct)
  // Extended path (when inputs.waterfall.preferredReturnPct > 0):
  //   European waterfall — LP gets called back → LP gets preferred return
  //   (compounded over weighted hold) → GP catchup → residual 80/20.
  const useWaterfall =
    inputs.waterfall != null && inputs.waterfall.preferredReturnPct > 0;

  let preferredReturnAmount = 0;
  let gpCatchupAmount = 0;
  let carriedInterestAmount = 0;

  if (useWaterfall) {
    const { preferredReturnPct, gpCatchupPct } = inputs.waterfall!;
    // Preferred return: LP's called capital × (1 + pref)^hold - LP's called.
    // Compounded annually over the proceeds-weighted hold period.
    const prefGrowth = Math.pow(1 + preferredReturnPct, weightedHoldPeriodYears);
    preferredReturnAmount = Math.max(0, calledCapital.lp * (prefGrowth - 1));

    const totalProfit = Math.max(0, proceeds.total - calledCapital.total);

    // LP gets called + preferred. Remaining profit is for GP catchup + split.
    const afterLPPref = Math.max(
      0,
      proceeds.total - calledCapital.total - preferredReturnAmount,
    );

    // GP catchup target: cumulative carry = carryPct × total profit.
    // GP gets up to gpCatchupPct of afterLPPref until that target is met.
    const carryTarget = inputs.carryPct * totalProfit;
    gpCatchupAmount = Math.min(afterLPPref, carryTarget * gpCatchupPct);

    // Remaining after catchup is split carryPct to GP, (1-carryPct) to LP.
    const afterCatchup = afterLPPref - gpCatchupAmount;
    const gpResidualCarry = afterCatchup * inputs.carryPct;

    carriedInterestAmount = gpCatchupAmount + gpResidualCarry;
  } else {
    // Excel's simple carry: max(0, (proceeds - called - recycled) × carryPct).
    const carryBase = Math.max(
      0,
      proceeds.total - calledCapital.total - recycledCapital.total,
    );
    carriedInterestAmount = carryBase * inputs.carryPct;
  }

  // Carried interest paid (LP perspective, negative) vs earned (GP positive).
  // Table convention: paid to LPs = LP's column shows +amount (LP pays it);
  // earned by GP = GP's column shows +amount. Total row: paid = earned total.
  const carriedInterestPaid: LineTotals = {
    total: carriedInterestAmount,
    lp: carriedInterestAmount,
    gp: 0,
  };
  const carriedInterestEarned: LineTotals = {
    total: carriedInterestAmount,
    lp: 0,
    gp: carriedInterestAmount,
  };

  const preferredReturn: LineTotals = {
    total: preferredReturnAmount,
    lp: preferredReturnAmount,
    gp: 0,
  };
  const gpCatchup: LineTotals = {
    total: gpCatchupAmount,
    lp: 0,
    gp: gpCatchupAmount,
  };

  // ── Distributions ────────────────────────────────────────────────────────
  // Total distributions = proceeds − carry. Split by waterfall when enabled,
  // pro-rata on called otherwise.
  const distributionsTotal = proceeds.total - carriedInterestAmount;
  let distributionsLP: number;
  let distributionsGP: number;

  if (useWaterfall) {
    // LP gets: called back + preferred return + (1 - carryPct) × residual-after-catchup.
    // GP gets: called back + residual pro-rata on contributed capital (no carry here —
    //   carry is tracked separately as "earned").
    const totalProfit = Math.max(0, proceeds.total - calledCapital.total);
    const afterLPPref = Math.max(0, totalProfit - preferredReturnAmount);
    const afterCatchup = Math.max(0, afterLPPref - gpCatchupAmount);
    const lpResidual = afterCatchup * (1 - inputs.carryPct);

    distributionsLP = calledCapital.lp + preferredReturnAmount + lpResidual;
    // GP's distributions in this screenshot shape = only their pro-rata return
    // of capital (carry is reported as "earned", not "distributed" in the table).
    distributionsGP = calledCapital.gp;
  } else {
    // Simple split: distributions prorated on called capital.
    distributionsLP = distributionsTotal * lpPct;
    distributionsGP = distributionsTotal * gpPct;
  }
  const distributions: LineTotals = {
    total: distributionsTotal,
    lp: distributionsLP,
    gp: distributionsGP,
  };

  // ── Multiples (R53, R54) ─────────────────────────────────────────────────
  const grossMult = investedCapital.total > 0 ? proceeds.total / investedCapital.total : 0;
  const grossMultiple: LineTotals = { total: grossMult, lp: grossMult, gp: grossMult };
  const netMultiple: LineTotals = {
    total: calledCapital.total > 0 ? distributions.total / calledCapital.total : 0,
    lp: calledCapital.lp > 0 ? distributions.lp / calledCapital.lp : 0,
    gp: calledCapital.gp > 0 ? (distributions.gp + carriedInterestEarned.gp) / calledCapital.gp : 0,
  };

  // ── IRRs (R55, R56). Excel's geometric annualization: mult^(1/hold) - 1. ─
  const safeIRR = (mult: number, hold: number): number => {
    if (hold <= 0 || mult <= 0) return 0;
    return Math.pow(mult, 1 / hold) - 1;
  };
  const grossIRRValue = safeIRR(grossMult, weightedHoldPeriodYears);
  const grossIRR: LineTotals = {
    total: grossIRRValue,
    lp: grossIRRValue,
    gp: grossIRRValue,
  };
  const netIRR: LineTotals = {
    total: safeIRR(netMultiple.total, weightedHoldPeriodYears),
    lp: safeIRR(netMultiple.lp, weightedHoldPeriodYears),
    gp: safeIRR(netMultiple.gp, weightedHoldPeriodYears),
  };

  // ── Standard ratios ──────────────────────────────────────────────────────
  const pic = calledCapital.total / inputs.committedCapital;
  const dpi = calledCapital.total > 0 ? distributions.total / calledCapital.total : 0;
  const rvpi = 0;
  const tvpi = dpi + rvpi;

  return {
    calledCapital,
    managementFees,
    partnershipExpenses,
    investedCapital,
    recycledCapital,

    proceeds,
    preferredReturn,
    gpCatchup,
    carriedInterestPaid,
    carriedInterestEarned,
    distributions,

    grossMultiple,
    netMultiple,
    grossIRR,
    netIRR,

    pic,
    dpi,
    rvpi,
    tvpi,

    weightedHoldPeriodYears,
    fundOperationsYears,

    tiers,
  };
}
