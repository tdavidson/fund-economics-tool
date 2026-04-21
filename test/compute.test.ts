import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeFund, validateInputs, DEFAULT_INPUTS } from '../src/index.js';
import type { FundInputs } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const FIXTURE_DECIMALS = 0; // dollar-level match; tighten once Excel fixtures are captured

type Fixture = {
  inputs: FundInputs;
  expected: Record<string, unknown>;
};

function loadFixture(name: string): Fixture {
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
  return JSON.parse(raw) as Fixture;
}

function readByPath(obj: unknown, p: string): number | undefined {
  const parts = p.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'number' ? cur : undefined;
}

describe('computeFund', () => {
  describe('defaults — sanity checks', () => {
    const result = computeFund(DEFAULT_INPUTS);

    it('called capital equals committed capital', () => {
      expect(result.calledCapital.total).toBe(25_000_000);
    });

    it('LP + GP called capital add up to total', () => {
      expect(result.calledCapital.lp + result.calledCapital.gp).toBeCloseTo(result.calledCapital.total, 6);
    });

    it('LP/GP split on called is pro-rata on gpCommitPct', () => {
      expect(result.calledCapital.gp).toBeCloseTo(25_000_000 * 0.02, 6);
      expect(result.calledCapital.lp).toBeCloseTo(25_000_000 * 0.98, 6);
    });

    it('tiers sum to the full invested capital', () => {
      const tierSum = result.tiers.reduce((s, t) => s + t.investedCapital, 0);
      expect(tierSum).toBeCloseTo(result.investedCapital.total, 2);
    });

    it('gross multiple matches SUMPRODUCT(multiples, pct)', () => {
      // 0.60*0 + 0.20*1.5 + 0.10*5 + 0.10*32 = 4.0
      expect(result.grossMultiple.total).toBeCloseTo(4.0, 6);
    });

    it('tier pctOfProceeds sums to 1.0', () => {
      const sum = result.tiers.reduce((s, t) => s + t.pctOfProceeds, 0);
      expect(sum).toBeCloseTo(1.0, 6);
    });

    it('management fees: GP pays 0 when commit is counted', () => {
      expect(result.managementFees.gp).toBe(0);
      expect(result.managementFees.total).toBe(result.managementFees.lp);
    });

    it('management fees: GP pays pro-rata when commit NOT counted', () => {
      const r = computeFund({ ...DEFAULT_INPUTS, gpCommitCountedTowardInvested: false });
      expect(r.managementFees.gp).toBeGreaterThan(0);
      expect(r.managementFees.gp).toBeCloseTo(
        r.managementFees.total * (r.calledCapital.gp / r.calledCapital.total),
        6,
      );
    });

    it('without waterfall, preferred return and catchup are 0', () => {
      expect(result.preferredReturn.total).toBe(0);
      expect(result.gpCatchup.total).toBe(0);
    });

    it('carried interest paid equals carried interest earned', () => {
      expect(result.carriedInterestPaid.total).toBeCloseTo(result.carriedInterestEarned.total, 6);
      expect(result.carriedInterestPaid.lp).toBeCloseTo(result.carriedInterestEarned.gp, 6);
    });

    it('DPI + RVPI = TVPI', () => {
      expect(result.dpi + result.rvpi).toBeCloseTo(result.tvpi, 6);
    });

    it('IRR uses geometric annualization (mult^(1/hold) - 1)', () => {
      const expectedGross = Math.pow(result.grossMultiple.total, 1 / result.weightedHoldPeriodYears) - 1;
      expect(result.grossIRR.total).toBeCloseTo(expectedGross, 6);
    });

    it('gross IRR >= net IRR (fees + carry drag)', () => {
      expect(result.grossIRR.total).toBeGreaterThanOrEqual(result.netIRR.total);
    });
  });

  // Excel-verified fixtures are captured in test/fixtures/*.json. Any file
  // in that directory runs as a parity test. Capture more scenarios by
  // running them in the Excel Fund Economics Tool and pasting outputs.
  const fixtureFiles = fs.existsSync(FIXTURES_DIR)
    ? fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'))
    : [];

  describe.skipIf(fixtureFiles.length === 0)('fixtures (Excel parity)', () => {
    for (const file of fixtureFiles) {
      describe(file, () => {
        const fixture = loadFixture(file);
        const result = computeFund(fixture.inputs);
        for (const [key, expected] of Object.entries(fixture.expected)) {
          if (typeof expected !== 'number') continue;
          it(`${key} matches fixture`, () => {
            const actual = readByPath(result, key);
            expect(actual).toBeDefined();
            expect(actual).toBeCloseTo(expected, FIXTURE_DECIMALS);
          });
        }
      });
    }
  });

  describe('input validation', () => {
    it('accepts the default inputs', () => {
      expect(() => validateInputs(DEFAULT_INPUTS)).not.toThrow();
    });

    it('rejects tiers that do not sum to 1.0', () => {
      const bad = {
        ...DEFAULT_INPUTS,
        returnTiers: [
          { name: 'a', pctOfCapital: 0.5, multiple: 1, holdingPeriodYears: 3 },
          { name: 'b', pctOfCapital: 0.3, multiple: 1, holdingPeriodYears: 3 },
        ],
      };
      expect(() => validateInputs(bad)).toThrow(/sum to 1\.0/);
    });

    it('rejects portfolio allocation that does not sum to 1.0', () => {
      const bad: FundInputs = {
        ...DEFAULT_INPUTS,
        portfolio: { newPct: 0.5, followPct: 0.3, avgCheckSizeNew: 1, avgCheckSizeFollow: 1 },
      };
      expect(() => validateInputs(bad)).toThrow(/sum to 1\.0/);
    });
  });

  describe('edge cases', () => {
    it('all-writeoff fund has 0 proceeds and 0 carry', () => {
      const allLoss: FundInputs = {
        ...DEFAULT_INPUTS,
        returnTiers: [{ name: 'writeoff', pctOfCapital: 1.0, multiple: 0, holdingPeriodYears: 5 }],
      };
      const r = computeFund(allLoss);
      expect(r.proceeds.total).toBe(0);
      expect(r.distributions.total).toBe(0);
      expect(r.carriedInterestPaid.total).toBe(0);
    });

    it('1x-everything fund has 0 carry (no gain)', () => {
      const breakeven: FundInputs = {
        ...DEFAULT_INPUTS,
        mgmtFeePct: 0,
        operationalExpensesAnnual: 0,
        organizationalExpenses: 0,
        recycledCapitalPct: 0,
        returnTiers: [{ name: 'even', pctOfCapital: 1.0, multiple: 1.0, holdingPeriodYears: 3 }],
      };
      const r = computeFund(breakeven);
      expect(r.carriedInterestPaid.total).toBe(0);
      expect(r.netMultiple.total).toBeCloseTo(1.0, 6);
    });
  });

  describe('waterfall (preferred return + GP catchup)', () => {
    const withWaterfall: FundInputs = {
      ...DEFAULT_INPUTS,
      waterfall: { preferredReturnPct: 0.08, gpCatchupPct: 1.0 },
    };
    const result = computeFund(withWaterfall);

    it('preferred return is positive when pref > 0 and fund is profitable', () => {
      expect(result.preferredReturn.total).toBeGreaterThan(0);
      expect(result.preferredReturn.lp).toBeGreaterThan(0);
      expect(result.preferredReturn.gp).toBe(0);
    });

    it('GP catchup is positive when LP has been made whole on pref', () => {
      expect(result.gpCatchup.total).toBeGreaterThan(0);
      expect(result.gpCatchup.gp).toBeGreaterThan(0);
      expect(result.gpCatchup.lp).toBe(0);
    });

    it('carried interest earned goes to GP', () => {
      expect(result.carriedInterestEarned.gp).toBeGreaterThan(0);
      expect(result.carriedInterestEarned.lp).toBe(0);
    });
  });
});
