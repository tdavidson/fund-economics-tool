# Changelog

## 0.4.0 — 2026-04-27

First public release on npm. License pivots from MIT to source-available; functional behavior unchanged from 0.3.0.

### Changed

- **License: MIT → source-available (custom).** Free for a single fund management company applying the package to its own funds, SPVs, and team. Commercial license required for service providers (fund administrators, outsourced CFOs, consultants) using the package across multiple clients, for SaaS / white-label / embedded distribution, and for any use across multiple unrelated management companies. See `LICENSE` for the full terms or contact hello@hemrock.com.
- **`package.json` license field**: `"MIT"` → `"SEE LICENSE IN LICENSE"`.
- **Package scope**: `@hemrock/fund-economics-tool` → `@tdavidson/fund-economics-tool`.

### Added

- **Personal Evaluation and Educational Use grant (Section 2A).** Any natural person can run the Software locally for evaluation, learning, research, or personal projects without forming a Fund Entity, for up to 90 days of substantive use. Genuinely personal, non-commercial use can continue indefinitely.
- **Cure period for material breach (Section 9).** Curable breaches get a 30-day notice-and-cure window before the License terminates. Non-curable breaches (e.g. redistribution under a different license, public distribution of modifications) still terminate immediately.

## 0.3.0 — 2026-04-24

Scenarios + Monte Carlo. No breaking changes.

### Added

- **`applyScenario(base, delta)` + `resolveScenarios(base, scenarios)`** — deep-merge a `DeepPartial<FundInputs>` over a base to produce a new `FundInputs`. Arrays (like `returnTiers`) replace wholesale. `DeepPartial` and `Scenario`/`ScenarioResult` types exported.
- **`@hemrock/fund-economics-tool/mc` sub-path** — new entry point for Monte Carlo simulation.
  - `runMonteCarlo(inputs, options)` returns distributions (p5/p25/p50/p75/p95/mean/stdev/samples) for gross MOIC, net MOIC LP, gross IRR, net IRR LP, DPI, plus `probLossOfCapital` (P(LP net MOIC < 1)).
  - Per-investment stochastic model: multinomial tier draw from `pctOfCapital`, then lognormal multiple jitter around each tier's stated multiple. Writeoffs stay at 0. Mulberry32 seeded RNG for determinism.
- **Scenarios tab** in the hosted Fund Economics Tool UI — 3 columns (Base / Conservative / High), two knobs (large-exit multiple, large-exit share), four metrics (Gross MOIC, Net MOIC LP, Gross IRR, Net IRR LP). Writeoff auto-plugs.
- **Monte Carlo tab** — iteration count / σ / seed controls, 5 histograms, percentile table, loss-of-capital readout.

## 0.2.0 — 2026-04-24

Per-side (LP / GP) math, entry-stage deployment with follow-on reserves, integer-mode back-solving. "Waterfall" now refers to the return-of-capital → carry → distribution flow; preferred return and GP catchup are out of scope.

### Breaking

- **Removed `Waterfall` type, `inputs.waterfall`, and `FundResult.preferredReturn` / `gpCatchup`.** Carry is always `profit × carryPct` per side. For preferred return + GP catchup, use the full Venture Capital Model.
- **Per-side proceeds and distributions.** `proceeds.lp/gp = invested.lp/gp × grossMultiple` instead of pro-rata on called. Downstream splits change when `gpCommitCountedTowardInvested = true` (LP shoulders fees → LP invested < pro-rata → LP proceeds, distributions, and net multiple all follow).
- **`distributions.total` now equals `proceeds.total − recycledCapital.total − carriedInterestPaid.total`.** Previously it only subtracted carry; the recycled pool was implicitly counted as distributed. Net MOIC and DPI shift accordingly.
- **Carry attribution per side.** `carriedInterestPaid.lp = profitLP × carryPct`, `carriedInterestPaid.gp = 0` (GPs earn carry; they don't pay it on their own profit). `carriedInterestEarned.gp` holds the full pool.

### Added

- **`EntryStage.reserveRatio`** — share of the stage allocation held back for follow-ons. Initial count = allocation × (1 − reserve) / check; full deployment = initial × check / (1 − reserve).
- **`inputs.stageInputMode`** — selects `'pct-capital'` or `'num-companies'` for the stages table independently from `tierInputMode`. Falls back to `tierInputMode` when unset.
- **`inputs.organizationalExpenseLines`** and **`inputs.operationalExpenseLines`** — itemized one-time and annual expense lines. Sums drive `organizationalExpenses` / `operationalExpensesAnnual`. Legacy `operationalExpensesBreakout` kept for back-compat.
- **Per-stage integer flooring.** With `tierFractional === false`, each stage's count floors independently; deployed capital = `floor(count) × check / (1 − reserve)`. `calledTotal` back-solves to the reduced deployment, so integer-constraint slack surfaces as uncalled capital.
- **`inputs.targetTotalInvestments`** — fallback total # of investments used only in num-companies mode when no entry stages are present.
- **`AllocationChart`** UI component — pie chart of stage allocation (initial vs reserved) or new / follow split when there are no stages.

### Changed

- **`calledCapital`** splits strictly pro-rata on `gpCommitPct`. Fee asymmetry (GP paying no fees on its own commit) lives in `managementFees`, not `calledCapital`.
- **`investedCapital` is computed per side**, then summed: `invested.side = called.side − partnershipExpenses.side − managementFees.side + recycled.side`.
- **`InvestmentOutcomesChart` bars** now use explicit tier colors (matching `FundCapitalFlowChart`) instead of `currentColor`.

### Fixed

- All-writeoff fund no longer shows negative distributions when `recycledCapitalPct > 0`. Per-side distributions clamp to ≥ 0.

## 0.1.0

Initial release.
