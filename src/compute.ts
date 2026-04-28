/**
 * Fund Economics computation.
 *
 * Direct port of the Hemrock Fund Economics Tool (`Forecast` sheet,
 * Excel v0.x). Every formula below is annotated with the source cell and
 * translated from the extracted spreadsheet logic. Carry and distributions
 * are computed per side (LP / GP) then summed. "Waterfall" refers to that
 * return-of-capital → carry → distribution flow; preferred return and
 * GP catchup are not modeled.
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

  // ── Committed capital (echo of the input — nominal fund size). ────────────
  const committedCapital: LineTotals = triad(inputs.committedCapital, lpPct, gpPct);

  // ── Partnership expenses (R11 + R12, summed over fund life). ──────────────
  // Excel: F45 = -(F11 + F12) = org + ops*years. Split LP/GP pro-rata on commit.
  // Fund-ops years defaults to newInvestmentPeriod + longest tier hold; users
  // can override it explicitly via inputs.fundOperationsYears. The new
  // partnershipExpensesAnnual input layers on top of operational expenses.
  const maxHoldYears = Math.max(...inputs.returnTiers.map((t) => t.holdingPeriodYears));
  const fundOperationsYears =
    inputs.fundOperationsYears ?? inputs.newInvestmentPeriodYears + maxHoldYears;
  const partnershipExpensesAnnual = inputs.partnershipExpensesAnnual ?? 0;
  const partnershipExpensesTotal =
    inputs.organizationalExpenses +
    (inputs.operationalExpensesAnnual + partnershipExpensesAnnual) * fundOperationsYears;
  const partnershipExpenses = triad(partnershipExpensesTotal, lpPct, gpPct);

  // ── Management fees (R46). Based on committed capital, not called. ───────
  // LP fee economics are anchored to commitments (what LPs signed up for),
  // independent of how much is actually drawn down.
  // Excel: F13 = mgmtPct * period * committed * (if GP counted: 1-gpPct else 1).
  // When counted: GP pays no fees on its own commit. LP pays mgmtPct*period*LPcap.
  // When not counted: LP + GP each pay mgmtPct*period*theirCap, so total is
  // mgmtPct*period*committed. When mgmtFeeSchedule is provided, it replaces
  // the flat-rate calc — the multiplier is the sum of per-year rates.
  const feeMultiplier = inputs.mgmtFeeSchedule && inputs.mgmtFeeSchedule.length > 0
    ? inputs.mgmtFeeSchedule.reduce((s, r) => s + r, 0)
    : inputs.mgmtFeePct * inputs.mgmtFeesPeriodYears;
  const mgmtFeeLP = feeMultiplier * committedCapital.lp;
  const mgmtFeeGP = inputs.gpCommitCountedTowardInvested
    ? 0
    : feeMultiplier * committedCapital.gp;
  const managementFees: LineTotals = {
    total: mgmtFeeLP + mgmtFeeGP,
    lp: mgmtFeeLP,
    gp: mgmtFeeGP,
  };

  // ── Recycled capital (R47). Based on committed. ──────────────────────────
  // Excel: F47 = E14 * E9 = recycledPct * committed. Split pro-rata.
  const recycledCapitalTotal = inputs.recycledCapitalPct * inputs.committedCapital;
  const recycledCapital = triad(recycledCapitalTotal, lpPct, gpPct);

  // ── Deployment plan → called capital. ───────────────────────────────────
  // Stage allocations have two input drivers:
  //   - pctAllocation: share of invested capital (pct-capital mode)
  //   - numInvestments: integer count (num-companies mode)
  // The active mode determines which drives per-stage deployment.
  //
  // Integer mode (`tierInputMode === 'num-companies'` + `tierFractional === false`)
  // floors counts so they're whole; called capital is recomputed from the
  // rounded counts × check so everything reconciles.
  const isIntegerMode =
    inputs.tierInputMode === 'num-companies' && inputs.tierFractional === false;
  // Stage allocation mode — separate from tierInputMode so stages and return
  // tiers can be driven by different conventions. Falls back to tierInputMode
  // when unset (backwards compat).
  const stageMode = inputs.stageInputMode ?? inputs.tierInputMode;
  const usePctStages = stageMode !== 'num-companies';

  // Tentative invested from committed — feeds the capacity calc and any
  // pct-allocation derivations. Not the final invested (which depends on
  // called after solve).
  const tentativeInvested =
    inputs.committedCapital - managementFees.total - partnershipExpensesTotal + recycledCapitalTotal;

  const rawStages = inputs.portfolio.entryStages ?? [];
  // Per-stage raw (fractional) count of initial investments:
  //   pct mode + pctAllocation set → pct × invested × (1 − reserve) / check
  //   else → numInvestments input verbatim
  const rawStageCounts = rawStages.map((s) => {
    const reserve = Math.max(0, Math.min(1, s.reserveRatio ?? 0));
    if (usePctStages && s.pctAllocation !== undefined && s.avgCheckSize > 0) {
      return (s.pctAllocation * tentativeInvested * (1 - reserve)) / s.avgCheckSize;
    }
    return s.numInvestments;
  });

  // Integer constraint: when tierFractional is explicitly false, floor each
  // stage's count. Less-than-whole investments become un-made.
  const floorInts = inputs.tierFractional === false;
  const effectiveStageCounts = rawStageCounts.map((c) =>
    floorInts ? Math.floor(c) : c,
  );

  // Amount possible to deploy per stage — the full allocation (initial +
  // follow-on reserves) the stage could absorb. pct mode: pct × invested.
  // num mode: raw-count × check / (1 − reserve).
  const stagePossibleToDeploy = rawStages.map((s, i) => {
    const reserve = Math.max(0, Math.min(1, s.reserveRatio ?? 0));
    if (usePctStages && s.pctAllocation !== undefined) {
      return s.pctAllocation * tentativeInvested;
    }
    const initial = rawStageCounts[i] * s.avgCheckSize;
    return reserve < 1 ? initial / (1 - reserve) : initial;
  });

  // Amount actually deployed per stage — uses the (possibly floored) count.
  // Same formula for both modes: floor(#) × check / (1 − reserve). When
  // tierFractional is true the floor is a no-op and deployed = possible.
  const stageAmountDeployed = rawStages.map((s, i) => {
    const reserve = Math.max(0, Math.min(1, s.reserveRatio ?? 0));
    const count = effectiveStageCounts[i];
    const initial = count * s.avgCheckSize;
    return reserve < 1 ? initial / (1 - reserve) : initial;
  });

  const stageDeployable = stageAmountDeployed.reduce((a, d) => a + d, 0);
  // `stagePossibleToDeploy` tracks the pre-floor allocation per stage and is
  // available for scenario math; we don't expose the total on FundResult yet.
  const totalStageInvestments = effectiveStageCounts.reduce((a, n) => a + n, 0);
  const useStages = rawStages.length > 0 && totalStageInvestments > 0;

  const weightedAvgCheck = useStages
    ? stageDeployable / totalStageInvestments
    : inputs.portfolio.newPct * inputs.portfolio.avgCheckSizeNew +
      inputs.portfolio.followPct * inputs.portfolio.avgCheckSizeFollow;

  // Capacity sources in priority order:
  //   1. Entry stages (sum of per-stage counts) — authoritative when set.
  //   2. targetTotalInvestments input — used in num-companies mode when the
  //      user wants to set the total explicitly (no stages yet).
  //   3. Derived from fund size / weighted avg check — fallback.
  const useTargetTotal =
    inputs.tierInputMode === 'num-companies' &&
    !useStages &&
    (inputs.targetTotalInvestments ?? 0) > 0;

  const rawCapacity = useStages
    ? totalStageInvestments
    : useTargetTotal
      ? inputs.targetTotalInvestments!
      : weightedAvgCheck > 0
        ? tentativeInvested / weightedAvgCheck
        : 0;

  // Floor the capacity in integer mode when it's derived (not when user-set).
  // Stage inputs and targetTotalInvestments are already integer by intent.
  const capacity =
    isIntegerMode && !useStages && !useTargetTotal
      ? Math.floor(rawCapacity)
      : rawCapacity;

  // Solve mode engages when a deployment plan exists:
  //   - stages → always solve (plan is explicit)
  //   - target total → solve (user set an explicit count target)
  //   - otherwise → only when UI flags it (integer mode auto-sets this)
  const solveMode =
    (useStages && stageDeployable > 0) ||
    useTargetTotal ||
    (inputs.solveCalledFromDeployment === true && capacity > 0);

  let calledTotal: number;
  if (solveMode) {
    const deployable = useStages ? stageDeployable : capacity * weightedAvgCheck;
    calledTotal = deployable + managementFees.total + partnershipExpensesTotal - recycledCapitalTotal;
  } else {
    calledTotal = inputs.committedCapital;
  }
  // Called capital splits pro-rata on commitment:
  //   called.lp = calledTotal × (1 − gpCommitPct)
  //   called.gp = calledTotal × gpCommitPct
  // Fee asymmetry (GP pays no fees when commit is counted) lives in
  // `managementFees`, not here — which means LP invested < pro-rata invested
  // because LP shoulders their fee obligation out of their called share.
  const calledCapital: LineTotals = triad(calledTotal, lpPct, gpPct);

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
  // Total # investments — already computed as `capacity` above. Stages sum,
  // user's target total, or floored derived from capacity. Use consistently.
  const totalNewChecks = capacity;

  // In num-companies mode, tier.numCompanies is an input for non-writeoff
  // tiers. The writeoff tier is back-solved: writeoff # = total − Σ(others),
  // clamped to 0. pctOfCapital is then derived from normalized counts.
  // In pct-capital mode, pctOfCapital is taken as-is and tier.numCompanies
  // is just a UI hint that the engine doesn't read.
  const writeoffIdx = inputs.returnTiers.findIndex(
    (t) => t.name.trim().toLowerCase() === 'writeoff',
  );
  const effectiveTiers = inputs.returnTiers.map((tier, i) => {
    if (inputs.tierInputMode !== 'num-companies') {
      return {
        ...tier,
        effectiveNumCompanies: totalNewChecks * tier.pctOfCapital,
        effectivePct: tier.pctOfCapital,
      };
    }
    // num-companies: derive counts + pcts.
    const nonWriteoffSum = inputs.returnTiers.reduce(
      (s, t, idx) => (idx === writeoffIdx ? s : s + (t.numCompanies ?? 0)),
      0,
    );
    const num =
      writeoffIdx >= 0 && i === writeoffIdx
        ? Math.max(0, totalNewChecks - nonWriteoffSum)
        : tier.numCompanies ?? 0;
    return { ...tier, effectiveNumCompanies: num, effectivePct: 0 };
  });
  if (inputs.tierInputMode === 'num-companies') {
    const sumAll = effectiveTiers.reduce((s, t) => s + t.effectiveNumCompanies, 0);
    for (const t of effectiveTiers) {
      t.effectivePct = sumAll > 0 ? t.effectiveNumCompanies / sumAll : 0;
    }
  }

  // Gross multiple = Σ(pct × multiple) across effective pcts.
  const grossMultipleValue = effectiveTiers.reduce(
    (sum, t) => sum + t.effectivePct * t.multiple,
    0,
  );
  const proceedsTotal = grossMultipleValue * investedCapitalTotal;

  const tiers: TierResult[] = effectiveTiers.map((tier) => {
    const tierInvested = investedCapitalTotal * tier.effectivePct;
    const tierProceeds = tierInvested * tier.multiple;
    const pctOfProceeds = proceedsTotal > 0 ? tierProceeds / proceedsTotal : 0;
    return {
      name: tier.name,
      pctOfCapital: tier.effectivePct,
      multiple: tier.multiple,
      holdingPeriodYears: tier.holdingPeriodYears,
      investedCapital: tierInvested,
      numInvestments: tier.effectiveNumCompanies,
      proceeds: tierProceeds,
      pctOfProceeds,
      weightedMultiple: tier.effectivePct * tier.multiple,
    };
  });

  // Proceeds per side = invested × gross multiple. Total = sum of the legs.
  // Because LP's invested is smaller than pro-rata (fees come out of LP's
  // share when GP commit is counted), LP proceeds < lpPct × proceeds.total.
  const proceedsLP = investedCapitalLP * grossMultipleValue;
  const proceedsGP = investedCapitalGP * grossMultipleValue;
  const proceeds: LineTotals = {
    total: proceedsLP + proceedsGP,
    lp: proceedsLP,
    gp: proceedsGP,
  };

  // ── Proceeds-weighted hold period (R39 H column). ───────────────────────
  // Excel: H39 = SUMPRODUCT(H35:H38, I35:I38) where I is pct of proceeds.
  const weightedHoldPeriodYears = tiers.reduce(
    (sum, t) => sum + t.holdingPeriodYears * t.pctOfProceeds,
    0,
  );

  // ── Waterfall: carry + distributions ─────────────────────────────────────
  // LP and GP share the same cash-flow structure (return of capital + share
  // of post-carry profit). Carry is computed per side as carryPct × profit
  // where profit = (proceeds − recycled) − called. GP's carry rate is 0%
  // (GPs receive carry, they don't pay it on their own profit). Carry from
  // each side's profit flows to the GP via `carriedInterestEarned`.
  //
  // Identities:
  //   profit.lp = (proceeds.lp − recycled.lp) − called.lp
  //   carry.lp  = max(0, profit.lp) × carryPct
  //   dist.lp   = max(0, (proceeds.lp − recycled.lp) − carry.lp)
  //   carry.gp  = 0
  //   dist.gp   = max(0, proceeds.gp − recycled.gp)
  //   total     = LP leg + GP leg, equal to (proceeds − recycled − totalCarry).
  const proceedsToDistributeLP = proceeds.lp - recycledCapital.lp;
  const proceedsToDistributeGP = proceeds.gp - recycledCapital.gp;

  const profitLP = Math.max(0, proceedsToDistributeLP - calledCapital.lp);
  const carriedInterestLP = profitLP * inputs.carryPct;
  const carriedInterestGP = 0;
  const carriedInterestAmount = carriedInterestLP + carriedInterestGP;

  const distributionsLP = Math.max(0, proceedsToDistributeLP - carriedInterestLP);
  const distributionsGP = Math.max(0, proceedsToDistributeGP - carriedInterestGP);

  // Carry paid (out of each side's profit) vs earned (all to GP).
  const carriedInterestPaid: LineTotals = {
    total: carriedInterestAmount,
    lp: carriedInterestLP,
    gp: carriedInterestGP,
  };
  const carriedInterestEarned: LineTotals = {
    total: carriedInterestAmount,
    lp: 0,
    gp: carriedInterestAmount,
  };

  const distributions: LineTotals = {
    total: distributionsLP + distributionsGP,
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
    committedCapital,
    calledCapital,
    managementFees,
    partnershipExpenses,
    investedCapital,
    recycledCapital,

    proceeds,
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
