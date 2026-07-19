export type TravelMode = 'transit' | 'driving' | 'cycling' | 'walking';

export type RouteOption = {
  mode: TravelMode;
  durationMinutes: number;
  distanceMeters?: number;
  available: boolean;
  note?: string;
};

export type CandidateRouteSummary = {
  destinationName: string;
  resolvedDestinationName: string;
  city?: string;
  routes: RouteOption[];
};

export type RouteSummary = {
  originName: string;
  resolvedOriginName?: string;
  candidates: [CandidateRouteSummary, CandidateRouteSummary];
};

export type MapRoutingResult =
  | { status: 'success'; summary: RouteSummary }
  | { status: 'needs_clarification'; message: string }
  | { status: 'unavailable'; message: string };

export interface MapRoutingClient {
  planCandidateRoutes(input: {
    originName: string;
    candidateNames: [string, string];
    cityHint?: string;
  }): Promise<MapRoutingResult>;
}
