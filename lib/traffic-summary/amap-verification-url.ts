import type { TrafficSummaryMode, TrafficSummaryPlace } from './types';

const amapModeMap: Record<TrafficSummaryMode, string> = {
  transit: 'bus',
  driving: 'car',
  cycling: 'ride',
  walking: 'walk',
};

export function buildAmapVerificationUrl(input: {
  origin: TrafficSummaryPlace;
  destination: TrafficSummaryPlace;
  mode: TrafficSummaryMode;
}): string {
  const url = new URL('https://uri.amap.com/navigation');
  url.searchParams.set('from', `${input.origin.location},${input.origin.name}`);
  url.searchParams.set('to', `${input.destination.location},${input.destination.name}`);
  url.searchParams.set('mode', amapModeMap[input.mode]);
  url.searchParams.set('policy', '0');
  url.searchParams.set('src', 'buzaiyaobai');
  url.searchParams.set('callnative', '1');
  return url.toString();
}
