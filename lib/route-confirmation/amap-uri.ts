import type { RouteConfirmationCandidate, RouteConfirmationMode, RouteConfirmationPlace } from './types';

const modeToAmapUriMode: Record<RouteConfirmationMode, string> = {
  transit: 'bus',
  driving: 'car',
  walking: 'walk',
  cycling: 'ride',
};

const modeToMobilePath: Record<RouteConfirmationMode, string> = {
  transit: 'buslist/sort=spd',
  driving: 'carmap/sort=dist',
  walking: 'walkmap',
  cycling: 'ridemap',
};

export function buildAmapNavigationUrl(input: {
  origin: RouteConfirmationPlace;
  destination: RouteConfirmationCandidate;
  mode: RouteConfirmationMode;
  callnative: boolean;
}): string {
  const url = new URL('https://uri.amap.com/navigation');
  url.searchParams.set('from', formatAmapPoint(input.origin.location, input.origin.name));
  url.searchParams.set('to', formatAmapPoint(input.destination.location, input.destination.name));
  url.searchParams.set('mode', modeToAmapUriMode[input.mode]);
  url.searchParams.set('policy', input.mode === 'transit' ? '0' : '1');
  url.searchParams.set('src', 'buzaiyaobai');
  url.searchParams.set('callnative', input.callnative ? '1' : '0');
  return url.toString();
}

export function buildAmapMobileIframeUrl(input: {
  origin: RouteConfirmationPlace;
  destination: RouteConfirmationCandidate;
  mode: RouteConfirmationMode;
}): string {
  const path = modeToMobilePath[input.mode];
  const url = new URL(`https://m.amap.com/navigation/${path}`);
  url.searchParams.set('saddr', formatAmapPoint(input.origin.location, input.origin.name));
  url.searchParams.set('daddr', formatAmapPoint(input.destination.location, input.destination.name));
  url.searchParams.set('src', 'buzaiyaobai');
  url.searchParams.set('callnative', '0');
  url.searchParams.set('innersrc', 'uriapi');
  return url.toString();
}

function formatAmapPoint(location: string, name: string): string {
  return `${location},${name}`;
}
