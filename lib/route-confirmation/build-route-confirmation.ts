import type { CandidateRouteSummary, RouteSummary, TravelMode } from '@/lib/map-routing/types';
import type { RouteConfirmation, RouteConfirmationCandidate } from './types';

const modeOrder: TravelMode[] = ['transit', 'driving', 'cycling', 'walking'];

export function buildRouteConfirmation(summary: RouteSummary): RouteConfirmation | undefined {
  if (!summary.originLocation) return undefined;

  const candidates = summary.candidates.map((candidate, index) =>
    toConfirmationCandidate(candidate, index),
  ) as [RouteConfirmationCandidate | undefined, RouteConfirmationCandidate | undefined];

  if (!candidates[0] || !candidates[1]) return undefined;

  const defaultMode = pickDefaultMode(candidates[0], candidates[1]);
  if (!defaultMode) return undefined;

  return {
    origin: {
      name: summary.originName,
      resolvedName: summary.resolvedOriginName,
      location: summary.originLocation,
    },
    candidates: [candidates[0], candidates[1]],
    defaultCandidateId: pickDefaultCandidateId(summary, defaultMode),
    defaultMode,
    notice: 'AI 建议基于本次高德路线数据生成；下方为高德路线页，实际导航以高德为准。',
  };
}

function toConfirmationCandidate(
  candidate: CandidateRouteSummary,
  index: number,
): RouteConfirmationCandidate | undefined {
  if (!candidate.location) return undefined;

  const availableModes = modeOrder.filter((mode) =>
    candidate.routes.some((route) => route.mode === mode && route.available),
  );

  if (availableModes.length === 0) return undefined;

  return {
    id: `candidate-${index}`,
    name: candidate.destinationName,
    resolvedName: candidate.resolvedDestinationName,
    location: candidate.location,
    availableModes,
  };
}

function pickDefaultMode(
  first: RouteConfirmationCandidate,
  second: RouteConfirmationCandidate,
): TravelMode | undefined {
  return modeOrder.find((mode) => first.availableModes.includes(mode) || second.availableModes.includes(mode));
}

function pickDefaultCandidateId(summary: RouteSummary, mode: TravelMode): string {
  const [first, second] = summary.candidates;
  const firstRoute = first.routes.find((route) => route.mode === mode && route.available);
  const secondRoute = second.routes.find((route) => route.mode === mode && route.available);

  if (firstRoute && secondRoute) {
    return firstRoute.durationMinutes <= secondRoute.durationMinutes ? 'candidate-0' : 'candidate-1';
  }

  if (secondRoute) return 'candidate-1';
  return 'candidate-0';
}
