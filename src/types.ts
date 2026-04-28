/**
 * Type definitions for the Fund Economics model.
 *
 * Money in the fund's base currency as plain numbers. Percentages are
 * decimals (0.02 = 2%). Time periods in years unless noted. LP/GP splits
 * are pro-rata on committed capital unless overridden (management fees
 * skip the GP's own commit when `gpCommitCountedTowardInvested` is true).
 */

/** One exit-outcome tier in the power-law return structure. */
export interface ReturnTier {
  /** Label for the tier, e.g. "writeoff", "small", "medium", "large". */
  name: string;
  /** Share of invested capital that lands in this tier. 0–1. */
  pctOfCapital: number;
  /** Average gross exit multiple for this tier. 0 = total writeoff. */
  multiple: number;
  /** Average hold period from investment to exit, in years. */
  holdingPeriodYears: number;
  /**
   * Raw # of companies input — only used when tierInputMode = 'num-companies'.
   * Compute ignores this; it's persisted so the form can re-render the input
   * the user typed without losing precision after % normalization.
   */
  numCompanies?: number;
}

/**
 * One entry point in the fund's investment strategy (e.g. "seed", "Series A").
 * A stage carries an average check size plus one of two allocation drivers:
 *
 *   - `numInvestments` (num-companies mode): integer count the fund plans to make
 *   - `pctAllocation` (pct-capital mode): 0–1 share of invested capital
 *
 * The UI maintains whichever is appropriate for the active mode; the engine
 * reads the mode-appropriate field and derives the other.
 */
export interface EntryStage {
  /** Label, e.g. "Average Investment", "seed", "Series A". */
  name: string;
  /** Number of initial investments the fund plans to make at this stage. */
  numInvestments: number;
  /** Average initial check size for this stage. */
  avgCheckSize: number;
  /** 0–1 share of invested capital allocated to this stage (pct-capital mode). */
  pctAllocation?: number;
  /**
   * 0–1 share of this stage's allocation held back for follow-on rounds.
   * Defaults to 0 (no reserves) when omitted.
   *   initial deployment = allocation × (1 − reserveRatio)
   *   follow-on reserves = allocation × reserveRatio
   *   # initial investments = initial deployment / avgCheckSize
   */
  reserveRatio?: number;
  /**
   * Editable label for the initial-check row when sub-rows are shown.
   * Defaults to "Initial check" but stages may represent geographies, sectors,
   * or other axes where that label doesn't fit.
   */
  initialCheckLabel?: string;
  /**
   * Optional follow-on check sizes when reserves are split into one or more
   * follow-on rounds. Each entry has its own label, check size, and share
   * of the stage's reserve dollars. The aggregate engine math (total
   * deployed, invested capital, proceeds) is unaffected — these inputs feed
   * concentration analysis (Return-the-Fund per-company allocation) and
   * surface the deployment shape in the UI.
   *   pctOfReserve: 0–1, share of the stage's reserve $ going to this round.
   *                 Sums across follow-ons should equal 1.0; the UI auto-plugs
   *                 the last follow-on to absorb the remainder.
   */
  followOnChecks?: Array<{
    label?: string;
    avgCheckSize: number;
    pctOfReserve?: number;
  }>;
}

/** Portfolio construction — how invested capital is split. */
export interface PortfolioAllocation {
  /** Share to new investments. 0–1. newPct + followPct should sum to 1. */
  newPct: number;
  /** Share to follow-on investments. 0–1. */
  followPct: number;
  /** Average check size for new investments. Derived from entryStages when that's non-empty. */
  avgCheckSizeNew: number;
  /** Average check size for follow-on investments. */
  avgCheckSizeFollow: number;
  /**
   * Per-stage breakdown of new investments. When present and non-empty,
   * overrides aggregate new-investment math:
   *   total new investments = sum(stage.numInvestments)
   *   weighted avg check    = sum(num × check) / sum(num)
   *   deployable            = sum(num × check)   (solve-from-deployment mode)
   */
  entryStages?: EntryStage[];
}

/** Per-year management fee rate schedule (decimal, e.g. 0.02 = 2%). */
export type MgmtFeeSchedule = number[];

/** Optional breakdown of annual operational expenses (all $/year). */
export interface OperationalExpensesBreakout {
  fundAdmin: number;
  tax: number;
  audit: number;
  other: number;
}

/** Optional itemized operational expense line ($/year). */
export interface OperationalExpenseLine {
  label: string;
  amount: number;
}

/** Optional itemized partnership expense line ($/year). */
export interface PartnershipExpenseLine {
  label: string;
  amount: number;
}

/** Optional itemized organizational expense line (one-time $). */
export interface OrganizationalExpenseLine {
  label: string;
  amount: number;
}

/** Which column drives the return-tier input table. */
export type TierInputMode = 'pct-capital' | 'num-companies';

/** Complete input shape for a Fund Economics computation. */
export interface FundInputs {
  // ── Capital and fund assumptions ──────────────────────────────────────────
  /** Total committed capital (LP + GP). */
  committedCapital: number;
  /** GP commit as a share of committed capital. 0–1. */
  gpCommitPct: number;
  /**
   * If true, GP commit counts toward invested capital and GP pays no
   * management fees on it (common US venture convention).
   */
  gpCommitCountedTowardInvested: boolean;
  /** One-time organizational expenses. */
  organizationalExpenses: number;
  /**
   * Optional itemized organizational expenses (one-time $). When set, the
   * form treats `organizationalExpenses` as the sum of these lines.
   */
  organizationalExpenseLines?: OrganizationalExpenseLine[];
  /** Ongoing operational expenses, per year (fund admin, tax, audit, other). */
  operationalExpensesAnnual: number;
  /**
   * Optional fixed-category breakdown of operational expenses ($/year).
   * Legacy; new code should prefer `operationalExpenseLines`.
   */
  operationalExpensesBreakout?: OperationalExpensesBreakout;
  /**
   * Optional itemized operational expenses ($/year). When set, the form
   * treats operationalExpensesAnnual as the sum of these lines.
   */
  operationalExpenseLines?: OperationalExpenseLine[];
  /** Additional partnership expenses, per year. Defaults to 0. */
  partnershipExpensesAnnual?: number;
  /**
   * Optional itemized partnership expenses ($/year). When set, the form
   * treats partnershipExpensesAnnual as the sum of these lines.
   */
  partnershipExpenseLines?: PartnershipExpenseLine[];
  /** Annual management fees as a share of committed capital. 0–1. */
  mgmtFeePct: number;
  /**
   * Optional per-year management fee schedule. When set, overrides
   * mgmtFeePct × mgmtFeesPeriodYears and lets fees step down over time.
   */
  mgmtFeeSchedule?: MgmtFeeSchedule;
  /** Recycled capital ceiling as a share of committed capital. 0–1. */
  recycledCapitalPct: number;
  /** Carried interest rate. 0–1. Typical US venture: 0.20. */
  carryPct: number;

  // ── Time periods (years) ──────────────────────────────────────────────────
  /** New investment period (years the fund can deploy into new investments). */
  newInvestmentPeriodYears: number;
  /** Management fees charged for this many years. */
  mgmtFeesPeriodYears: number;
  /**
   * Explicit fund operations period, in years. When set, overrides the
   * default derivation (newInvestmentPeriod + longest tier hold period)
   * for sizing operational/partnership expenses.
   */
  fundOperationsYears?: number;

  // ── Portfolio construction ────────────────────────────────────────────────
  portfolio: PortfolioAllocation;

  // ── Return assumptions ────────────────────────────────────────────────────
  /** Power-law return tiers. pctOfCapital across tiers should sum to 1.0. */
  returnTiers: ReturnTier[];
  /**
   * Which column of the return-tier table is the user-driven input. Default
   * 'pct-capital' (existing behavior). 'num-companies' flips the input so the
   * user edits investment count and pctOfCapital is computed.
   */
  tierInputMode?: TierInputMode;
  /**
   * Which column of the Investment Strategy stages table is the user-driven
   * input. Defaults to `tierInputMode` for backwards compatibility, then to
   * 'pct-capital'. Separating this from `tierInputMode` lets the stages and
   * return tiers be driven by different input conventions.
   */
  stageInputMode?: TierInputMode;
  /**
   * Whether the # investments column shows fractional values (0.3) or whole
   * numbers only. Default true (fractional, matches Excel convention).
   */
  tierFractional?: boolean;

  /**
   * Compute called capital from the deployment plan instead of treating it
   * as equal to committed. When true, called = Σ(tier.numCompanies × check)
   * + fees + expenses − recycled. Useful for showing how integer investment
   * counts don't always reconcile to the committed fund size.
   *
   * Requires `tierInputMode === 'num-companies'` and populated `numCompanies`
   * on each tier; falls back to committed when counts are all zero.
   * Fees stay based on committed capital (LP fee economics are anchored
   * to the commitment, not the call).
   */
  solveCalledFromDeployment?: boolean;
  /**
   * Target total number of investments. Only consulted in num-companies mode
   * when there are no entry stages. When populated, it becomes the capacity
   * driver (sets writeoff count and deployable). When entry stages are set,
   * their sum is authoritative and this field is ignored.
   */
  targetTotalInvestments?: number;

}

/** Per-tier computed outcomes. */
export interface TierResult {
  name: string;
  /** Share of invested capital in this tier (echoed from input). */
  pctOfCapital: number;
  /** Gross exit multiple (echoed from input). */
  multiple: number;
  /** Hold period for exits in this tier (echoed from input). */
  holdingPeriodYears: number;
  /** Capital deployed into this tier. */
  investedCapital: number;
  /** Number of investments falling into this tier (can be fractional). */
  numInvestments: number;
  /** Gross proceeds realized from this tier's exits. */
  proceeds: number;
  /** This tier's share of total proceeds (0–1). */
  pctOfProceeds: number;
  /** pctOfCapital × multiple — the tier's contribution to the gross multiple. */
  weightedMultiple: number;
}

/**
 * A Total/LP/GP triad — used for every line item where the three break out.
 * Expenses and fees flow out (positive values, consistent with screenshot),
 * with the understanding that they're debits against called capital.
 */
export interface LineTotals {
  total: number;
  lp: number;
  gp: number;
}

/** Headline fund-level metrics, all computed. */
export interface FundResult {
  // ── Capital accounting ────────────────────────────────────────────────────
  /** Committed capital — echo of the input (the nominal fund size). */
  committedCapital: LineTotals;
  /**
   * Capital called from investors. Equals committed in default mode.
   * In `solveCalledFromDeployment` mode, back-solved from the deployment
   * plan — may differ from committed (the uncalled gap reveals how
   * integer investment counts fail to reconcile to the fund size).
   */
  calledCapital: LineTotals;
  /** Management fees over the fee period. GP pays zero when commit counted. */
  managementFees: LineTotals;
  /** Partnership expenses = organizational + operational × fund-ops years. */
  partnershipExpenses: LineTotals;
  /** Capital actually invested in the portfolio. */
  investedCapital: LineTotals;
  /** Recycled capital (included inside invested capital). */
  recycledCapital: LineTotals;

  // ── Returns ───────────────────────────────────────────────────────────────
  /** Gross proceeds from portfolio exits, before carry. */
  proceeds: LineTotals;
  /** Carried interest from LPs' perspective (negative = LP pays). */
  carriedInterestPaid: LineTotals;
  /** Carried interest from GP's perspective (positive = GP receives). */
  carriedInterestEarned: LineTotals;
  /** Total distributions back to investors. */
  distributions: LineTotals;

  // ── Multiples ─────────────────────────────────────────────────────────────
  /** Gross multiple = proceeds / invested capital. Same across total/LP/GP. */
  grossMultiple: LineTotals;
  /** Net multiple = distributions / called capital. */
  netMultiple: LineTotals;

  // ── IRRs (decimals, 0.122 = 12.2%) ────────────────────────────────────────
  /**
   * Gross IRR = gross_multiple^(1/weighted_hold) - 1. Excel's convention:
   * geometric annualization, not DCF. LP and GP share the same gross IRR.
   */
  grossIRR: LineTotals;
  /** Net IRR = net_multiple^(1/weighted_hold) - 1. */
  netIRR: LineTotals;

  // ── Standard VC performance ratios ────────────────────────────────────────
  /** PIC = called / committed. */
  pic: number;
  /** DPI = distributions / called (total fund). */
  dpi: number;
  /** RVPI = unrealized / called. Fully realized at end of fund life → 0. */
  rvpi: number;
  /** TVPI = DPI + RVPI = net multiple. */
  tvpi: number;

  // ── Timing ────────────────────────────────────────────────────────────────
  /** Proceeds-weighted average hold period across tiers, years. Used for IRR. */
  weightedHoldPeriodYears: number;
  /** Total fund life (new investment period + longest hold period). */
  fundOperationsYears: number;

  // ── Per-tier breakdown ────────────────────────────────────────────────────
  tiers: TierResult[];
}
