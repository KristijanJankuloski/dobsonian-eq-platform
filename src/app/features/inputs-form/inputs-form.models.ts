import { PlatformInputs, PlatformOptions } from '@core/calculator';

/** A valid form state: inputs plus the tunable options. */
export interface PlatformFormValue {
  inputs: PlatformInputs;
  options: PlatformOptions;
}
