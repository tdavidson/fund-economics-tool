/**
 * Monte Carlo simulation for the Fund Economics model.
 *
 * Stochastic inputs:
 *   - Per investment, draw its return tier from a multinomial over
 *     `returnTiers.pctOfCapital`.
 *   - Draw each investment's multiple from a lognormal whose **mean** equals
 *     the tier's stated multiple (not its median). This makes the per-iteration
 *     gross-MOIC distribution center on the deterministic `Σ(pct × tier.multiple)`
 *     reported on the Outputs tab. Per-tier σ scales with log(1 + tier_multiple)
 *     — small exits cluster tight around their stated multiple, large exits
 *     have wide tails (matches the power-law shape of real VC outcomes). The
 *     `multipleSigma` option sets σ at the highest-multiple tier; everything
 *     else falls out from there.
 *   - Writeoffs stay writeoffs (multiple = 0; σ = 0).
 *
 * Everything else (fund size, stages, fees, expenses, carry, recycling) stays
 * deterministic — only the exit outcomes vary per run. The deterministic
 * `computeFund` is called once to establish the invested-capital base, called
 * capital, recycled split, and fund life; each iteration replays the
 * waterfall with the stochastic proceeds.
 *
 * Seeded RNG (Mulberry32) so runs are reproducible for tests and for the
 * "current view" in the UI. Pass `seed` to lock in a specific simulation.
 */

import { computeFund } from './compute.js';
import type { FundInputs } from './types.js';

// ── RNG + sampling primitives ─────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal draw via Box-Muller. */
function standardNormal(rng: () => number): number {
  const u = Math.max(1e-12, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Lognormal draw with `mean` as the arithmetic expected value and σ = sigma.
 * The location parameter is shifted by −σ²/2 so E[X] = mean. (Lognormal mean
 * is `exp(μ + σ²/2)`, so setting `μ = ln(mean) − σ²/2` lands the mean exactly
 * at `mean`.) This way, simulation outputs reconcile to the deterministic
 * `Σ(pct × tier.multiple)` reported on the Outputs tab — tier multiples are
 * treated as expected values, not medians.
 */
function lognormal(rng: () => number, mean: number, sigma: number): number {
  if (mean <= 0) return 0;
  const mu = Math.log(mean) - (sigma * sigma) / 2;
  return Math.exp(mu + sigma * standardNormal(rng));
}

/** Pick an index from weights (not required to sum to 1). */
function pickIndex(rng: () => number, weights: number[]): number {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return 0;
  let u = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    u -= Math.max(0, weights[i]);
    if (u <= 0) return i;
  }
  return weights.length - 1;
}

// ── Options + result types ────────────────────────────────────────────────────

export interface MonteCarloOptions {
  /** Number of iterations. Default 5000. */
  iterations?: number;
  /** Seed for reproducibility. Default `Date.now()`. */
  seed?: number;
  /**
   * Lognormal σ at the highest-multiple tier. Smaller tiers scale down
   * proportionally to log(1+multiple) — small exits tight around their
   * stated multiple, large exits have wide tails. Default 1.0 (≈ 6x–165x
   * spread around a 32x large tier; ~1x–2.3x around a 1.5x small tier).
   */
  multipleSigma?: number;
}

export interface MonteCarloDistribution {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  mean: number;
  stdev: number;
  /** Raw samples so the UI can bin them into histograms. */
  samples: number[];
}

export interface MonteCarloResult {
  iterations: number;
  seed: number;
  multipleSigma: number;
  distributions: {
    grossMultiple: MonteCarloDistribution;
    netMultiple: { total: MonteCarloDistribution; lp: MonteCarloDistribution };
    grossIRR: MonteCarloDistribution;
    netIRR: { total: MonteCarloDistribution; lp: MonteCarloDistribution };
  };
  /** P(net MOIC LP < 1) — probability of realized capital loss to LP. */
  probLossOfCapital: number;
}

// ── Summarization ─────────────────────────────────────────────────────────────

function summarize(samples: number[]): MonteCarloDistribution {
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const pct = (p: number) => {
    if (n === 0) return 0;
    const idx = Math.max(0, Math.min(n - 1, Math.floor(p * (n - 1))));
    return sorted[idx];
  };
  const mean = n > 0 ? samples.reduce((s, x) => s + x, 0) / n : 0;
  const variance = n > 0 ? samples.reduce((s, x) => s + (x - mean) ** 2, 0) / n : 0;
  return {
    p5: pct(0.05),
    p25: pct(0.25),
    p50: pct(0.5),
    p75: pct(0.75),
    p95: pct(0.95),
    mean,
    stdev: Math.sqrt(variance),
    samples,
  };
}

// ── Main driver ───────────────────────────────────────────────────────────────

/**
 * Run the Monte Carlo simulation against a fund configuration. The
 * deterministic base is computed once; each iteration replays the exit +
 * waterfall using stochastic per-investment draws.
 */
export function runMonteCarlo(
  inputs: FundInputs,
  options: MonteCarloOptions = {},
): MonteCarloResult {
  const iterations = options.iterations ?? 10000;
  const seed = options.seed ?? Date.now();
  const sigma = options.multipleSigma ?? 1.0;
  const rng = mulberry32(seed);

  // Deterministic base — everything except exit outcomes.
  const base = computeFund(inputs);

  // Total # of investments comes from the stage plan / capacity. Round up
  // so fractional residuals still get their draw (writeoffs already cancel
  // out, and this keeps the expected value unbiased).
  const totalInvestments = Math.max(
    1,
    Math.round(base.tiers.reduce((s, t) => s + t.numInvestments, 0)),
  );

  const tierWeights = inputs.returnTiers.map((t) => t.pctOfCapital);
  const tierMultiples = inputs.returnTiers.map((t) => t.multiple);
  const tierHolds = inputs.returnTiers.map((t) => t.holdingPeriodYears);

  // Per-tier σ. Variability scales with tier multiple — small exits cluster
  // tight around their stated multiple, large exits have wide tails (e.g.
  // 10x–100x+ around a 32x mean). `sigma` is the σ at the highest-multiple
  // tier; smaller tiers get proportionally less spread. Writeoff (multiple = 0)
  // stays at 0 because lognormal of 0 is undefined.
  const maxMultiple = Math.max(...tierMultiples, 0);
  const maxLogMult = Math.log(1 + maxMultiple);
  const tierSigmas = tierMultiples.map((m) => {
    if (m <= 0 || maxLogMult === 0) return 0;
    return sigma * (Math.log(1 + m) / maxLogMult);
  });

  const investedTotal = base.investedCapital.total;
  const investedPerInvestment = investedTotal > 0 ? investedTotal / totalInvestments : 0;
  const invLPFraction = investedTotal > 0 ? base.investedCapital.lp / investedTotal : 0;
  const invGPFraction = investedTotal > 0 ? base.investedCapital.gp / investedTotal : 0;
  const calledLP = base.calledCapital.lp;
  const calledTotal = base.calledCapital.total;
  const recycledLP = base.recycledCapital.lp;
  const recycledGP = base.recycledCapital.gp;

  // Fixed weighted hold for IRR annualization across all iterations. Using
  // the deterministic hold (instead of a per-iteration proceeds-weighted hold)
  // removes the covariance between MOIC and hold — high-MOIC iterations would
  // otherwise tilt toward longer holds (more large-tier exits) and compress
  // IRR. With a fixed hold, IRR is a clean deterministic transform of MOIC and
  // the simulation IRR mean tracks the deterministic IRR within the residual
  // Jensen gap, which is small at typical inputs.
  const fixedHold = base.weightedHoldPeriodYears;

  const grossMultSamples = new Array<number>(iterations);
  const netMultTotalSamples = new Array<number>(iterations);
  const netMultLPSamples = new Array<number>(iterations);
  const grossIRRSamples = new Array<number>(iterations);
  const netIRRTotalSamples = new Array<number>(iterations);
  const netIRRLPSamples = new Array<number>(iterations);

  // tierHolds is read inside the loop only when the deterministic hold
  // calculation needs it — currently we annualize at `fixedHold` for every
  // iteration, so per-iter hold accumulation is unused.
  void tierHolds;

  for (let it = 0; it < iterations; it++) {
    let totalProceeds = 0;

    for (let i = 0; i < totalInvestments; i++) {
      const tierIdx = pickIndex(rng, tierWeights);
      const drawnMult = lognormal(rng, tierMultiples[tierIdx], tierSigmas[tierIdx]);
      const investmentProceeds = investedPerInvestment * drawnMult;
      totalProceeds += investmentProceeds;
    }

    const weightedHold = fixedHold;

    // Per-side waterfall matching compute.ts:
    //   profit.lp = max(0, proceeds.lp − recycled.lp − called.lp)
    //   carry.lp = profit.lp × carryPct
    //   dist.lp = max(0, proceeds.lp − recycled.lp − carry.lp)
    //   dist.gp = max(0, proceeds.gp − recycled.gp)  // GP carry = 0
    const proceedsLP = totalProceeds * invLPFraction;
    const proceedsGP = totalProceeds * invGPFraction;
    const profitLP = Math.max(0, proceedsLP - recycledLP - calledLP);
    const carryLP = profitLP * inputs.carryPct;
    const distLP = Math.max(0, proceedsLP - recycledLP - carryLP);
    const distGP = Math.max(0, proceedsGP - recycledGP);
    const distTotal = distLP + distGP;

    const grossMult = investedTotal > 0 ? totalProceeds / investedTotal : 0;
    const netMultTotal = calledTotal > 0 ? distTotal / calledTotal : 0;
    const netMultLP = calledLP > 0 ? distLP / calledLP : 0;
    const grossIRR =
      weightedHold > 0 && grossMult > 0 ? Math.pow(grossMult, 1 / weightedHold) - 1 : 0;
    const netIRRTotal =
      weightedHold > 0 && netMultTotal > 0 ? Math.pow(netMultTotal, 1 / weightedHold) - 1 : 0;
    const netIRRLP =
      weightedHold > 0 && netMultLP > 0 ? Math.pow(netMultLP, 1 / weightedHold) - 1 : 0;

    grossMultSamples[it] = grossMult;
    netMultTotalSamples[it] = netMultTotal;
    netMultLPSamples[it] = netMultLP;
    grossIRRSamples[it] = grossIRR;
    netIRRTotalSamples[it] = netIRRTotal;
    netIRRLPSamples[it] = netIRRLP;
  }

  const probLossOfCapital =
    netMultLPSamples.filter((m) => m < 1).length / iterations;

  return {
    iterations,
    seed,
    multipleSigma: sigma,
    distributions: {
      grossMultiple: summarize(grossMultSamples),
      netMultiple: {
        total: summarize(netMultTotalSamples),
        lp: summarize(netMultLPSamples),
      },
      grossIRR: summarize(grossIRRSamples),
      netIRR: {
        total: summarize(netIRRTotalSamples),
        lp: summarize(netIRRLPSamples),
      },
    },
    probLossOfCapital,
  };
}
