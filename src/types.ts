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
}

/** Portfolio construction — how invested capital is split. */
export interface PortfolioAllocation {
  /** Share to new investments. 0–1. newPct + followPct should sum to 1. */
  newPct: number;
  /** Share to follow-on investments. 0–1. */
  followPct: number;
  /** Average check size for new investments. */
  avgCheckSizeNew: number;
  /** Average check size for follow-on investments. */
  avgCheckSizeFollow: number;
}

/**
 * Optional preferred-return + GP-catchup waterfall. When `preferredReturnPct`
 * is 0, the waterfall simplifies to the Excel Fund Economics Tool default:
 * simple profit × carry_pct. When > 0, a full European waterfall applies:
 *
 *   1. LP gets called capital back first
 *   2. LP gets preferred return at `preferredReturnPct` compounded annually
 *      over `weightedHoldPeriodYears`
 *   3. GP catches up until their cumulative carry equals carry_pct of the
 *      cumulative profit above invested capital (gated by `gpCatchupPct`,
 *      where 1.0 = 100% catchup rate)
 *   4. Residual split 80/20 (or per `carryPct`)
 */
export interface Waterfall {
  /** Preferred return hurdle rate, compounded annually. 0 disables the waterfall. */
  preferredReturnPct: number;
  /** GP catchup rate. 1.0 = 100% (standard). 0 = no catchup. */
  gpCatchupPct: number;
}

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
  /** Ongoing operational expenses, per year. */
  operationalExpensesAnnual: number;
  /** Annual management fees as a share of committed capital. 0–1. */
  mgmtFeePct: number;
  /** Recycled capital ceiling as a share of committed capital. 0–1. */
  recycledCapitalPct: number;
  /** Carried interest rate. 0–1. Typical US venture: 0.20. */
  carryPct: number;

  // ── Time periods (years) ──────────────────────────────────────────────────
  /** New investment period (years the fund can deploy into new investments). */
  newInvestmentPeriodYears: number;
  /** Management fees charged for this many years. */
  mgmtFeesPeriodYears: number;

  // ── Portfolio construction ────────────────────────────────────────────────
  portfolio: PortfolioAllocation;

  // ── Return assumptions ────────────────────────────────────────────────────
  /** Power-law return tiers. pctOfCapital across tiers should sum to 1.0. */
  returnTiers: ReturnTier[];

  // ── Optional waterfall ────────────────────────────────────────────────────
  /**
   * Preferred-return + GP-catchup waterfall. Optional. When omitted or
   * `preferredReturnPct=0`, the model uses Excel's simple carry (profit × pct).
   */
  waterfall?: Waterfall;
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
  /** Capital called from investors (= committed capital in v0.x). */
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
  /** Preferred return paid to LPs (0 when waterfall disabled). */
  preferredReturn: LineTotals;
  /** GP catchup amount (0 when waterfall disabled). */
  gpCatchup: LineTotals;
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
