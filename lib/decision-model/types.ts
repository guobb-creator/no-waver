import type { RouteSummary } from '@/lib/map-routing/types';

export type DecisionResult =
  | { status: 'success'; message: string }
  | { status: 'needs_clarification'; message: string };

export type ExtractedTripPlaces =
  | {
      status: 'success';
      origin: string;
      candidates: [string, string];
      cityHint?: string;
    }
  | { status: 'needs_clarification'; message: string };

export interface DecisionModelClient {
  readonly maxInputChars: number;
  decide(question: string): Promise<DecisionResult>;
  extractPlaces(question: string): Promise<ExtractedTripPlaces>;
  decideWithRoutes(question: string, routeSummary: RouteSummary): Promise<DecisionResult>;
  decideWithoutMapData(question: string, unavailableReason: string): Promise<DecisionResult>;
}
