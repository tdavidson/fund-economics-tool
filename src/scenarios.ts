/**
 * Scenario helpers. A "scenario" is a deep-partial delta over a base FundInputs.
 * `applyScenario` merges the delta in, producing a fully-resolved FundInputs
 * that you can hand to `computeFund`. Arrays (e.g. `returnTiers`) are treated
 * as atomic — pass the full array in the delta if you want to change it.
 */

import type { FundInputs } from './types.js';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export interface Scenario {
  name: string;
  delta: DeepPartial<FundInputs>;
}

export interface ScenarioResult {
  name: string;
  inputs: FundInputs;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, delta: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(delta)) {
    return (delta ?? base) as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(delta)) {
    if (value === undefined) continue;
    const current = (base as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      // Arrays replace wholesale — deep-merging by index is rarely what you want
      // for things like `returnTiers` where order + membership matter.
      out[key] = value;
    } else if (isPlainObject(value) && isPlainObject(current)) {
      out[key] = deepMerge(current as unknown, value as DeepPartial<unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/** Merge a scenario's delta into a base FundInputs. */
export function applyScenario(base: FundInputs, delta: DeepPartial<FundInputs>): FundInputs {
  return deepMerge(base, delta);
}

/** Apply a list of scenarios against a base. Returns each scenario's resolved inputs. */
export function resolveScenarios(base: FundInputs, scenarios: Scenario[]): ScenarioResult[] {
  return scenarios.map((s) => ({ name: s.name, inputs: applyScenario(base, s.delta) }));
}
