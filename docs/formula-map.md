# Fund Economics Tool — formula map

Compact reference for the compute path. Use this as the source of truth for AI prompts, MCP server definitions, and external docs.

## Inputs → outputs in one diagram

```
FundInputs
   │
   ├─→ committedCapital, gpCommitPct
   │     └─→ committed.lp = committed × (1 − gpCommitPct)
   │         committed.gp = committed × gpCommitPct
   │
   ├─→ mgmtFeePct, mgmtFeesPeriodYears, mgmtFeeSchedule
   │     └─→ feeMultiplier = (schedule.sum) OR (mgmtFeePct × mgmtFeesPeriodYears)
   │         mgmtFee.lp    = feeMultiplier × committed.lp
   │         mgmtFee.gp    = gpCommitCountedTowardInvested ? 0 : feeMultiplier × committed.gp
   │         mgmtFee.total = mgmtFee.lp + mgmtFee.gp
   │
   ├─→ organizationalExpenses, operationalExpensesAnnual, partnershipExpensesAnnual,
   │   fundOperationsYears (defaults to newInvestmentPeriod + max(tier.holdingPeriodYears))
   │     └─→ partnershipExpenses.total =
   │           organizationalExpenses
   │           + (operationalExpensesAnnual + partnershipExpensesAnnual) × fundOperationsYears
   │         partnershipExpenses.{lp,gp} = pro-rata on commitment
   │
   ├─→ recycledCapitalPct
   │     └─→ recycledCapital.total = recycledCapitalPct × committed
   │         recycledCapital.{lp,gp} = pro-rata on commitment
   │
   ├─→ entryStages, stageInputMode, tierFractional
   │     │
   │     │  Per stage:
   │     │   reserve = clamp(reserveRatio, 0, 0.99)
   │     │   if pct mode: rawCount = pctAllocation × tentativeInvested × (1−reserve) / avgCheckSize
   │     │   else (num):  rawCount = numInvestments
   │     │   effectiveCount = tierFractional === false ? floor(rawCount) : rawCount
   │     │   stageDeployed  = effectiveCount × avgCheckSize / (1 − reserve)
   │     │
   │     │  Where tentativeInvested = committed − fees − expenses + recycled (pre-solve)
   │     │
   │     └─→ stageDeployable = Σ stageDeployed
   │         capacity        = Σ effectiveCount   (= total # investments)
   │         weightedAvgCheck = stageDeployable / capacity
   │
   ├─→ Solve for calledTotal
   │     └─→ if (stages with positive counts) OR targetTotalInvestments OR
   │            solveCalledFromDeployment → solve mode:
   │           calledTotal = stageDeployable + fees + expenses − recycled
   │         else:
   │           calledTotal = committed
   │
   │         calledCapital.{lp,gp} = pro-rata triad on commitment
   │
   ├─→ investedCapital per side (calledCapital flow):
   │     invested.lp = called.lp − partnershipExpenses.lp − mgmtFee.lp + recycled.lp
   │     invested.gp = called.gp − partnershipExpenses.gp − mgmtFee.gp + recycled.gp
   │     invested.total = invested.lp + invested.gp
   │
   │     LP shoulders the fee asymmetry → invested.lp < lpPct × invested.total
   │     when gpCommitCountedTowardInvested = true.
   │
   ├─→ returnTiers, tierInputMode
   │     │
   │     │  Effective tier shape:
   │     │   pct mode:  effectivePct[i] = pctOfCapital[i]
   │     │              effectiveCount[i] = totalNewChecks × pctOfCapital[i]
   │     │   num mode:  count[i] = numCompanies[i]; writeoff = max(0, total − Σ others)
   │     │              effectivePct[i] = count[i] / Σ count
   │     │
   │     └─→ grossMultipleValue = Σ (effectivePct[i] × multiple[i])
   │
   ├─→ proceeds per side (= invested × gross multiple, summed):
   │     proceeds.lp    = invested.lp × grossMultipleValue
   │     proceeds.gp    = invested.gp × grossMultipleValue
   │     proceeds.total = proceeds.lp + proceeds.gp
   │
   │     Per tier: tier.invested = invested.total × effectivePct[i]
   │               tier.proceeds = tier.invested × multiple[i]
   │
   ├─→ Waterfall (carry + distributions, per side):
   │     proceedsToDistribute.lp = proceeds.lp − recycled.lp
   │     proceedsToDistribute.gp = proceeds.gp − recycled.gp
   │
   │     profit.lp    = max(0, ptd.lp − called.lp)
   │     carry.lp     = profit.lp × carryPct                      ← LP pays
   │     dist.lp      = max(0, ptd.lp − carry.lp)
   │
   │     carry.gp     = 0                                          ← GP pays no carry on its own profit
   │     dist.gp      = max(0, ptd.gp)
   │
   │     carriedInterestPaid.{total,lp,gp} = (carry.lp + carry.gp, carry.lp, carry.gp)
   │     carriedInterestEarned.{total,lp,gp} = (carry.total, 0, carry.total)   ← all to GP
   │
   │     distributions.{lp,gp,total} = sum-of-legs
   │
   ├─→ Multiples and IRRs:
   │     grossMultiple = proceeds / invested        (same for total / LP / GP)
   │     netMultiple.{total,lp,gp} = distributions / called    (per side)
   │     weightedHold = Σ (tier.holdingPeriodYears × tier.pctOfProceeds)
   │     grossIRR     = grossMultiple^(1/weightedHold) − 1
   │     netIRR.{total,lp,gp} = netMultiple^(1/weightedHold) − 1
   │
   ├─→ Standard ratios:
   │     pic   = called.total / committed
   │     dpi   = distributions.total / called.total
   │     rvpi  = 0  (fully realized at end of fund life)
   │     tvpi  = dpi + rvpi
   │
   └─→ FundResult — all of the above, in `{ total, lp, gp }` triads where applicable.
```

## Key invariants (worth holding in head)

1. **Per-side legs sum to total.** `invested.total = invested.lp + invested.gp`. Same for proceeds, distributions, carry. Sum-of-legs is the canonical computation.
2. **Fees never split pro-rata when `gpCommitCountedTowardInvested = true`.** GP pays zero, LP pays all on its own commit. Total fee pool is *smaller*, not redistributed.
3. **Called capital is always pro-rata on commitment.** Fee asymmetry shows up in `invested.{lp,gp}` (different from `lpPct × invested.total`), not in called.
4. **Proceeds per side = invested.side × gross multiple.** Because LP invested is below pro-rata, LP proceeds are too.
5. **Distributions = (proceeds − recycled) − carry.** Recycled stays in the fund; carry is computed on `proceeds − recycled − called`.
6. **Gross multiple is identical across total / LP / GP.** It's a portfolio-level metric.
7. **Per-stage integer flooring** (when `tierFractional === false`) reduces deployed → reduces called → reduces invested. The slack is uncalled commitment.

## Monte Carlo path (`/mc` subpath)

For each iteration:
- For each of `Σ tier.numInvestments` investments:
  - Draw a tier: multinomial on `pctOfCapital`.
  - Draw a multiple: lognormal with **mean = tier.multiple** (re-centered so simulation reconciles to deterministic). Per-tier σ scales with `log(1 + tier.multiple) / log(1 + max_tier_multiple)`. Writeoff (multiple = 0) → σ = 0.
- Aggregate proceeds, then compute MOIC and IRR using the **deterministic weighted hold** (fixed across iterations to remove MOIC/hold covariance).

Outputs: `{p5, p25, p50, p75, p95, mean, stdev, samples}` per metric (gross MOIC, net MOIC total/LP, gross IRR, net IRR total/LP) plus `probLossOfCapital` (P(LP net MOIC < 1)).

## Scenarios path

`applyScenario(base, delta)` deep-merges a `DeepPartial<FundInputs>` over a base. Arrays (e.g. `returnTiers`) replace wholesale. `resolveScenarios(base, scenarios)` resolves a list. Engine is deterministic — caller picks how to compute & display.

The hosted UI's Named Cases view varies the **large-tier multiple** and **large-tier share** across three scenarios; the writeoff tier auto-plugs the residual. Net metrics flip between Total Fund and LP Only via a UI toggle.

## Per-company concentration (Return-the-Fund)

Shown in the hosted UI as the "Return the fund" card. Uses called capital ÷ blended per-company exposure.

```
totalCompanies            = Σ effectiveStageCount
totalInitialDollars       = Σ effectiveStageCount × stage.avgCheckSize
totalAllocationDollars    = Σ stage allocation including reserves
                            (uses explicit followOnChecks if set,
                             else implicit reserves spread evenly)

initialCheck (blended)    = totalInitialDollars / totalCompanies
perCompanyAllocation       = totalAllocationDollars / totalCompanies

requiredMultipleWithReserves = called / perCompanyAllocation
requiredMultipleInitialOnly  = called / initialCheck

requiredExitValuation     = called / exitOwnership
where exitOwnership       = initialOwnership × (1 − dilutionToExit)
and impliedPostmoney      = initialCheck / initialOwnership
```

When no stage has a non-zero `reserveRatio`, the two multiples collapse to one display row.
