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

  describe('per-side carry attribution', () => {
    const result = computeFund(DEFAULT_INPUTS);

    it('GP pays 0% carry on its own profit', () => {
      expect(result.carriedInterestPaid.gp).toBe(0);
    });

    it('GP earns the full carry pool', () => {
      expect(result.carriedInterestEarned.gp).toBeGreaterThan(0);
      expect(result.carriedInterestEarned.lp).toBe(0);
      expect(result.carriedInterestEarned.total).toBeCloseTo(
        result.carriedInterestPaid.total,
        6,
      );
    });

    it('LP carry = LP profit × carryPct', () => {
      const profitLP = Math.max(
        0,
        result.proceeds.lp - result.recycledCapital.lp - result.calledCapital.lp,
      );
      expect(result.carriedInterestPaid.lp).toBeCloseTo(profitLP * DEFAULT_INPUTS.carryPct, 6);
    });
  });

  describe('per-side reconciliation', () => {
    const result = computeFund(DEFAULT_INPUTS);

    it('invested LP + GP = invested total', () => {
      expect(result.investedCapital.lp + result.investedCapital.gp).toBeCloseTo(
        result.investedCapital.total,
        4,
      );
    });

    it('proceeds per side = invested × gross multiple', () => {
      expect(result.proceeds.lp).toBeCloseTo(
        result.investedCapital.lp * result.grossMultiple.total,
        4,
      );
      expect(result.proceeds.gp).toBeCloseTo(
        result.investedCapital.gp * result.grossMultiple.total,
        4,
      );
    });

    it('distributions total = proceeds − recycled − carry', () => {
      expect(result.distributions.total).toBeCloseTo(
        result.proceeds.total - result.recycledCapital.total - result.carriedInterestPaid.total,
        4,
      );
    });

    it('LP invested is less than pro-rata when GP commit is counted (fee asymmetry)', () => {
      // GP pays 0 fees on its own commit, so fees come out of LP's share only.
      // LP's invested is therefore below lpPct × invested.total.
      const lpPct = 1 - DEFAULT_INPUTS.gpCommitPct;
      expect(result.investedCapital.lp).toBeLessThan(result.investedCapital.total * lpPct);
    });
  });

  describe('integer mode (tierFractional = false)', () => {
    it('stage count floors and reduces called capital', () => {
      // Default stage: 1 stage, 100% pct, $750k check → raw count = 28.6 → floor = 28.
      // Deployed = 28 × 750k = 21.0M (was 21.45M). Called drops accordingly.
      const r = computeFund({ ...DEFAULT_INPUTS, tierFractional: false });
      const deployed = 28 * 750_000;
      const expectedCalled =
        deployed + r.managementFees.total + r.partnershipExpenses.total - r.recycledCapital.total;
      expect(r.calledCapital.total).toBeCloseTo(expectedCalled, 0);
      expect(r.calledCapital.total).toBeLessThan(DEFAULT_INPUTS.committedCapital);
    });

    it('invested equals deployed when in integer mode', () => {
      const r = computeFund({ ...DEFAULT_INPUTS, tierFractional: false });
      expect(r.investedCapital.total).toBeCloseTo(28 * 750_000, 0);
    });
  });

  describe('reserve ratio', () => {
    it('deployed per stage = floor(count) × check / (1 − reserve)', () => {
      // Single stage, 100% pct, 30% reserve, $1M check, $25M committed.
      // Pre-solve invested = 21.45M. Initial count = 21.45 × 0.7 / 1 = 15.015.
      // Fractional: deployed = 15.015 × 1M / 0.7 = 21.45M.
      const inputs: FundInputs = {
        ...DEFAULT_INPUTS,
        portfolio: {
          newPct: 1.0,
          followPct: 0,
          avgCheckSizeNew: 1_000_000,
          avgCheckSizeFollow: 0,
          entryStages: [
            {
              name: 'seed',
              numInvestments: 0,
              avgCheckSize: 1_000_000,
              pctAllocation: 1.0,
              reserveRatio: 0.3,
            },
          ],
        },
      };
      const r = computeFund(inputs);
      // With fractional counts, deployed equals the full allocation.
      expect(r.investedCapital.total).toBeCloseTo(21_450_000, 0);
    });

    it('reserve + floor compound: deployed shrinks when count rounds down', () => {
      const inputs: FundInputs = {
        ...DEFAULT_INPUTS,
        tierFractional: false,
        portfolio: {
          newPct: 1.0,
          followPct: 0,
          avgCheckSizeNew: 1_000_000,
          avgCheckSizeFollow: 0,
          entryStages: [
            {
              name: 'seed',
              numInvestments: 0,
              avgCheckSize: 1_000_000,
              pctAllocation: 1.0,
              reserveRatio: 0.3,
            },
          ],
        },
      };
      const r = computeFund(inputs);
      // Raw count = 15.015 → floor = 15. Deployed = 15 × 1M / 0.7 = 21.428M (< 21.45M).
      expect(r.investedCapital.total).toBeCloseTo(15_000_000 / 0.7, 0);
      expect(r.investedCapital.total).toBeLessThan(21_450_000);
    });
  });

  describe('stageInputMode independence', () => {
    const baseStages: FundInputs = {
      ...DEFAULT_INPUTS,
      portfolio: {
        newPct: 1.0,
        followPct: 0,
        avgCheckSizeNew: 750_000,
        avgCheckSizeFollow: 0,
        entryStages: [
          { name: 'seed', numInvestments: 20, avgCheckSize: 750_000, pctAllocation: 1.0 },
        ],
      },
    };

    it('tierInputMode does not affect stage-derived capital when stageInputMode is pinned', () => {
      // With stageInputMode pinned, toggling tierInputMode shouldn't reach
      // back into stage math — that's the independence guarantee.
      const pct = computeFund({
        ...baseStages,
        stageInputMode: 'pct-capital',
        tierInputMode: 'pct-capital',
      });
      const num = computeFund({
        ...baseStages,
        stageInputMode: 'pct-capital',
        tierInputMode: 'num-companies',
      });
      expect(pct.investedCapital.total).toBeCloseTo(num.investedCapital.total, 2);
      expect(pct.calledCapital.total).toBeCloseTo(num.calledCapital.total, 2);
    });

    it('stageInputMode can differ from tierInputMode', () => {
      const r = computeFund({
        ...baseStages,
        stageInputMode: 'num-companies',
        tierInputMode: 'pct-capital',
      });
      // Stage uses numInvestments (20) → deployed = 20 × 750k = 15M
      expect(r.investedCapital.total).toBeCloseTo(15_000_000, 0);
    });
  });
});
