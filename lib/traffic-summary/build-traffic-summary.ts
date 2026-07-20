import { WALKING_DISPLAY_MAX_MINUTES } from '@/lib/app-config';
import { formatDuration } from '@/lib/map-routing/route-summary';
import type { CandidateRouteSummary, RouteOption, RouteSummary, TravelMode } from '@/lib/map-routing/types';
import { buildAmapVerificationUrl } from './amap-verification-url';
import { buildTrafficInsight } from './traffic-insight';
import type { TrafficRouteItem, TrafficSummary, TrafficSummaryCandidate, TrafficSummaryPlace } from './types';

const modeLabels: Record<TravelMode, string> = {
  transit: '公交/地铁',
  driving: '驾车/打车',
  cycling: '骑行',
  walking: '步行',
};

const displayOrder: TravelMode[] = ['transit', 'driving', 'cycling', 'walking'];

export function buildTrafficSummary(summary: RouteSummary): TrafficSummary | undefined {
  if (!summary.originLocation) return undefined;

  const origin: TrafficSummaryPlace = {
    name: summary.originName,
    resolvedName: summary.resolvedOriginName,
    location: summary.originLocation,
  };

  const candidates = summary.candidates.map((candidate, index) =>
    buildCandidateSummary(candidate, index, origin),
  ) as [TrafficSummaryCandidate | undefined, TrafficSummaryCandidate | undefined];

  if (!candidates[0] || !candidates[1]) return undefined;

  return {
    source: '高德地图路线数据',
    queriedAtText: '刚刚查询',
    origin,
    candidates: [candidates[0], candidates[1]],
    trafficInsight: buildTrafficInsight(summary),
    notice: '交通数据来自高德地图路线数据；AI 只基于这些路线数据比较交通。实际导航以高德为准。',
  };
}

function buildCandidateSummary(
  candidate: CandidateRouteSummary,
  index: number,
  origin: TrafficSummaryPlace,
): TrafficSummaryCandidate | undefined {
  if (!candidate.location) return undefined;

  const destination: TrafficSummaryPlace = {
    name: candidate.destinationName,
    resolvedName: candidate.resolvedDestinationName,
    location: candidate.location,
  };

  const routes = displayOrder
    .map((mode) => candidate.routes.find((route) => route.mode === mode && route.available))
    .filter((route): route is RouteOption => Boolean(route))
    .map((route) => buildRouteItem(route, origin, destination))
    .filter((route): route is TrafficRouteItem => Boolean(route));

  if (routes.length === 0) return undefined;

  return {
    id: `candidate-${index}`,
    name: candidate.destinationName,
    resolvedName: candidate.resolvedDestinationName,
    location: candidate.location,
    routes,
  };
}

function buildRouteItem(
  route: RouteOption,
  origin: TrafficSummaryPlace,
  destination: TrafficSummaryPlace,
): TrafficRouteItem | undefined {
  if (route.mode === 'walking' && route.durationMinutes > WALKING_DISPLAY_MAX_MINUTES) {
    return {
      mode: route.mode,
      label: modeLabels[route.mode],
      durationMinutes: route.durationMinutes,
      durationText: formatDuration(route.durationMinutes),
      distanceMeters: route.distanceMeters,
      distanceText: formatDistance(route.distanceMeters),
      note: '时间较长，不建议步行',
      verificationUrl: buildAmapVerificationUrl({ origin, destination, mode: route.mode }),
    };
  }

  return {
    mode: route.mode,
    label: modeLabels[route.mode],
    durationMinutes: route.durationMinutes,
    durationText: formatDuration(route.durationMinutes),
    distanceMeters: route.distanceMeters,
    distanceText: formatDistance(route.distanceMeters),
    walkingDistanceMeters: route.walkingDistanceMeters,
    walkingDistanceText:
      typeof route.walkingDistanceMeters === 'number' ? `步行${formatDistance(route.walkingDistanceMeters)}` : undefined,
    transfers: route.transfers,
    transfersText: typeof route.transfers === 'number' ? `换乘 ${route.transfers} 次` : undefined,
    lineNames: route.lineNames,
    lineNamesText: route.lineNames?.join(' / '),
    note: route.note,
    verificationUrl: buildAmapVerificationUrl({ origin, destination, mode: route.mode }),
  };
}

export function formatDistance(distanceMeters: number | undefined): string | undefined {
  if (typeof distanceMeters !== 'number' || !Number.isFinite(distanceMeters) || distanceMeters <= 0) return undefined;
  if (distanceMeters < 1000) return `约 ${Math.round(distanceMeters)} 米`;
  return `约 ${(distanceMeters / 1000).toFixed(distanceMeters >= 10000 ? 0 : 1)} 公里`;
}
