import { DriveFormValue } from './drive.models';

/**
 * Pure (de)serialisation of the drive inputs to a query string, with the same
 * rules as the platform inputs: strict parsing, positive values only, and a
 * default for anything missing or invalid. URL and localStorage are untrusted.
 */

const MAX_ABS = 1_000_000;

export function defaultDriveValue(): DriveFormValue {
  return {
    spindleDiameterMm: 12.5,
    motorRpm: 3,
    siderealCorrection: true,
    motorRph: null,
    shaftDiameterMm: null,
  };
}

const KEYS = ['sd', 'rpm', 'sid', 'rph', 'shaft'] as const;

/** Writes every key, with an empty value for an unset optional field. */
export function toDriveQueryParams(value: DriveFormValue): URLSearchParams {
  const params = new URLSearchParams();
  params.set('sd', String(value.spindleDiameterMm));
  params.set('rpm', String(value.motorRpm));
  params.set('sid', value.siderealCorrection ? '1' : '0');
  params.set('rph', value.motorRph === null ? '' : String(value.motorRph));
  params.set('shaft', value.shaftDiameterMm === null ? '' : String(value.shaftDiameterMm));
  return params;
}

/** A strict positive decimal, or null. */
function parsePositive(raw: string | null): number | null {
  if (raw === null || !/^(\d+\.?\d*|\.\d+)$/.test(raw.trim())) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= MAX_ABS ? n : null;
}

/** Returns null when none of the drive keys are present. */
export function fromDriveQueryParams(params: URLSearchParams): DriveFormValue | null {
  if (!KEYS.some((k) => params.has(k))) return null;
  const d = defaultDriveValue();
  const sid = params.get('sid');
  return {
    spindleDiameterMm: parsePositive(params.get('sd')) ?? d.spindleDiameterMm,
    motorRpm: parsePositive(params.get('rpm')) ?? d.motorRpm,
    siderealCorrection: sid === '1' ? true : sid === '0' ? false : d.siderealCorrection,
    motorRph: parsePositive(params.get('rph')),
    shaftDiameterMm: parsePositive(params.get('shaft')),
  };
}
