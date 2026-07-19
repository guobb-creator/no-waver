import { WALKING_DISPLAY_MAX_MINUTES } from '@/lib/app-config';
import type { CandidateRouteSummary, RouteOption, RouteSummary, TravelMode } from './types';

const modeLabels: Record<TravelMode, string> = {
  transit: '公交/地铁',
  driving: '驾车/打车',
  cycling: '骑行',
  walking: '步行',
};

const displayOrder: TravelMode[] = ['transit', 'driving', 'cycling', 'walking'];

export function formatDuration(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded < 60) return `约 ${rounded} 分钟`;

  const hours = Math.floor(rounded / 60);
  const restMinutes = rounded % 60;
  return restMinutes === 0 ? `约 ${hours} 小时` : `约 ${hours} 小时 ${restMinutes} 分钟`;
}

export function getDisplayableRoutes(
  routes: RouteOption[],
  walkingMaxMinutes = WALKING_DISPLAY_MAX_MINUTES,
): RouteOption[] {
  return displayOrder
    .map((mode) => routes.find((route) => route.mode === mode && route.available))
    .filter((route): route is RouteOption => Boolean(route))
    .filter((route) => route.mode !== 'walking' || route.durationMinutes <= walkingMaxMinutes);
}

export function hasLongWalkingRoute(
  routes: RouteOption[],
  walkingMaxMinutes = WALKING_DISPLAY_MAX_MINUTES,
): boolean {
  return routes.some(
    (route) => route.mode === 'walking' && route.available && route.durationMinutes > walkingMaxMinutes,
  );
}

export function formatCandidateRouteLine(
  candidate: CandidateRouteSummary,
  walkingMaxMinutes = WALKING_DISPLAY_MAX_MINUTES,
): string {
  const routes = getDisplayableRoutes(candidate.routes, walkingMaxMinutes);
  const name = candidate.destinationName || candidate.resolvedDestinationName;

  if (routes.length === 0) {
    return `${name}：地图暂未返回可用路线`;
  }

  const parts = routes.map((route) => `${modeLabels[route.mode]}${formatDuration(route.durationMinutes)}`);
  if (hasLongWalkingRoute(candidate.routes, walkingMaxMinutes)) {
    parts.push('步行时间较长，不建议步行');
  }

  return `${name}：${parts.join('，')}`;
}

export function formatRouteSummaryForPrompt(
  summary: RouteSummary,
  walkingMaxMinutes = WALKING_DISPLAY_MAX_MINUTES,
): string {
  return [
    `出发地：${summary.originName}${summary.resolvedOriginName ? `（地图识别为：${summary.resolvedOriginName}）` : ''}`,
    '路线对比：',
    '',
    ...summary.candidates.map((candidate) => formatCandidateRouteLine(candidate, walkingMaxMinutes)),
  ].join('\n');
}
