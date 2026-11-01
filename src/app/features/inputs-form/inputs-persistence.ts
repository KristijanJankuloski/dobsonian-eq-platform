import {
  DEFAULT_INPUTS,
  DEFAULT_OPTIONS,
  MAX_LATITUDE_DEG,
  MIN_LATITUDE_DEG,
} from '@core/calculator';
import { PlatformFormValue } from './inputs-form.models';

/**
 * Pure (de)serialisation of the form state to a query string.
 *
 * The same format is used for the URL and for localStorage. Both are
 * untrusted: every field is parsed strictly, limited to the same range as the
 * form, and falls back to its default when it is missing or invalid.
 */

/** Largest absolute value accepted for any field. Stops absurd input. */
const MAX_ABS = 1_000_000;

type Rule = 'latitude' | 'nonNegative' | 'positive';

interface Field {
  /** Short query key; letters match the spec's diagram where possible. */
  key: string;
  rule: Rule;
  get: (v: PlatformFormValue) => number;
  set: (v: PlatformFormValue, n: number) => void;
}

const FIELDS: Field[] = [
  field('lat', 'latitude', 'inputs', 'latitudeDeg'),
  field('a', 'nonNegative', 'inputs', 'scopeMassKg'),
  field('b', 'nonNegative', 'inputs', 'scopeCogHeightMm'),
  field('c', 'nonNegative', 'inputs', 'mountMassKg'),
  field('d', 'nonNegative', 'inputs', 'mountCogHeightMm'),
  field('e', 'positive', 'inputs', 'mountBaseWidthMm'),
  field('f', 'positive', 'inputs', 'platformThicknessMm'),
  field('travel', 'nonNegative', 'options', 'extraTravelDeg'),
  field('margin', 'nonNegative', 'options', 'chordMarginMm'),
  field('middle', 'nonNegative', 'options', 'unusedMiddlePercent'),
];

function field<G extends 'inputs' | 'options'>(
  key: string,
  rule: Rule,
  group: G,
  name: keyof PlatformFormValue[G] & string,
): Field {
  return {
    key,
    rule,
    get: (v) => v[group][name] as number,
    set: (v, n) => {
      (v[group] as unknown as Record<string, unknown>)[name] = n;
    },
  };
}

export function defaultFormValue(): PlatformFormValue {
  return { inputs: { ...DEFAULT_INPUTS }, options: { ...DEFAULT_OPTIONS } };
}

/** Writes a form state as query parameters. */
export function toQueryParams(value: PlatformFormValue): URLSearchParams {
  const params = new URLSearchParams();
  for (const f of FIELDS) params.set(f.key, String(f.get(value)));
  return params;
}

/** Strict decimal parse. Returns null for anything else. */
function parseNumber(raw: string | null): number | null {
  if (raw === null || !/^-?(\d+\.?\d*|\.\d+)$/.test(raw.trim())) return null;
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n) <= MAX_ABS ? n : null;
}

function sanitise(rule: Rule, n: number | null, fallback: number): number {
  if (n === null) return fallback;
  switch (rule) {
    case 'latitude': {
      // The absolute value is used, so keep the sign and clamp the size.
      const size = Math.min(Math.max(Math.abs(n), MIN_LATITUDE_DEG), MAX_LATITUDE_DEG);
      return n < 0 ? -size : size;
    }
    case 'nonNegative':
      return Math.max(n, 0);
    case 'positive':
      return n > 0 ? n : fallback;
  }
}

/**
 * Reads a form state from query parameters. Returns null when none of the
 * known keys are present, so callers can tell "nothing saved" from "defaults".
 */
export function fromQueryParams(params: URLSearchParams): PlatformFormValue | null {
  if (!FIELDS.some((f) => params.has(f.key))) return null;
  const defaults = defaultFormValue();
  const value = defaultFormValue();
  for (const f of FIELDS) {
    f.set(value, sanitise(f.rule, parseNumber(params.get(f.key)), f.get(defaults)));
  }
  if (value.inputs.scopeMassKg + value.inputs.mountMassKg <= 0) {
    value.inputs.scopeMassKg = defaults.inputs.scopeMassKg;
    value.inputs.mountMassKg = defaults.inputs.mountMassKg;
  }
  return value;
}
