/**
 * The mock's capacity. Replace this value together with the real model adapter
 * when a provider is selected.
 */
export const MAX_INPUT_CHARS = 12_000;

export const WALKING_DISPLAY_MAX_MINUTES = toPositiveInteger(
  process.env.WALKING_DISPLAY_MAX_MINUTES,
  30,
);

export const AMAP_REQUEST_TIMEOUT_MS = toPositiveInteger(
  process.env.AMAP_REQUEST_TIMEOUT_MS,
  8_000,
);

function toPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
