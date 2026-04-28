import { describe, it, expect } from 'vitest';
import { DEFAULT_INPUTS } from '../src/index.js';
import { runMonteCarlo } from '../src/mc.js';

describe('runMonteCarlo', () => {
  it('is deterministic with a fixed seed', () => {
    const a = runMonteCarlo(DEFAULT_INPUTS, { iterations: 500, seed: 42 });
    const b = runMonteCarlo(DEFAULT_INPUTS, { iterations: 500, seed: 42 });
    expect(a.distributions.netMultiple.lp.p50).toBe(b.distributions.netMultiple.lp.p50);
    expect(a.distributions.grossMultiple.mean).toBe(b.distributions.grossMultiple.mean);
  });

  it('different seeds give different distributions', () => {
    const a = runMonteCarlo(DEFAULT_INPUTS, { iterations: 500, seed: 1 });
    const b = runMonteCarlo(DEFAULT_INPUTS, { iterations: 500, seed: 2 });
    expect(a.distributions.netMultiple.lp.mean).not.toBe(b.distributions.netMultiple.lp.mean);
  });

  it('mean gross multiple matches the deterministic value (within sampling noise)', () => {
    // Deterministic gross multiple on defaults = 4.0. Tier multiples are now
    // re-centered as lognormal means (not medians), so MC mean of gross MOIC
    // converges to the deterministic value as iterations grow. ±25% band at
    // N=4000 to absorb sampling noise from the heavy-tailed large tier.
    const r = runMonteCarlo(DEFAULT_INPUTS, { iterations: 4000, seed: 7 });
    const mean = r.distributions.grossMultiple.mean;
    expect(mean).toBeGreaterThan(3.0);
    expect(mean).toBeLessThan(5.0);
  });

  it('percentiles are monotone', () => {
    const r = runMonteCarlo(DEFAULT_INPUTS, { iterations: 1000, seed: 3 });
    const d = r.distributions.netMultiple.lp;
    expect(d.p5).toBeLessThanOrEqual(d.p25);
    expect(d.p25).toBeLessThanOrEqual(d.p50);
    expect(d.p50).toBeLessThanOrEqual(d.p75);
    expect(d.p75).toBeLessThanOrEqual(d.p95);
  });

  it('net MOIC total is >= LP (LP shoulders fees)', () => {
    const r = runMonteCarlo(DEFAULT_INPUTS, { iterations: 1000, seed: 4 });
    // Default has GP commit counted → LP invested < pro-rata → LP net MOIC < Total.
    expect(r.distributions.netMultiple.total.p50).toBeGreaterThanOrEqual(
      r.distributions.netMultiple.lp.p50,
    );
  });

  it('writeoff-dominated fund has most samples below 1x (high loss probability)', () => {
    const allLoss = {
      ...DEFAULT_INPUTS,
      returnTiers: [
        { name: 'writeoff', pctOfCapital: 0.95, multiple: 0, holdingPeriodYears: 2 },
        { name: 'small', pctOfCapital: 0.05, multiple: 1.5, holdingPeriodYears: 3 },
      ],
    };
    const r = runMonteCarlo(allLoss, { iterations: 1000, seed: 5 });
    expect(r.probLossOfCapital).toBeGreaterThan(0.9);
  });
});
