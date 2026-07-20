import type { TravelMode } from '@/lib/map-routing/types';

export type RouteConfirmationMode = TravelMode;

export type RouteConfirmationPlace = {
  name: string;
  resolvedName?: string;
  location: string;
};

export type RouteConfirmationCandidate = {
  id: string;
  name: string;
  resolvedName?: string;
  location: string;
  availableModes: RouteConfirmationMode[];
};

export type RouteConfirmation = {
  origin: RouteConfirmationPlace;
  candidates: [RouteConfirmationCandidate, RouteConfirmationCandidate];
  defaultCandidateId: string;
  defaultMode: RouteConfirmationMode;
  notice: string;
};
