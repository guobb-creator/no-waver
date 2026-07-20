import type { TravelMode } from '@/lib/map-routing/types';

export type TrafficSummaryMode = TravelMode;

export type TrafficSummaryPlace = {
  name: string;
  resolvedName?: string;
  location: string;
};

export type TrafficRouteItem = {
  mode: TrafficSummaryMode;
  label: string;
  durationMinutes: number;
  durationText: string;
  distanceMeters?: number;
  distanceText?: string;
  walkingDistanceMeters?: number;
  walkingDistanceText?: string;
  transfers?: number;
  transfersText?: string;
  lineNames?: string[];
  lineNamesText?: string;
  note?: string;
  verificationUrl: string;
};

export type TrafficSummaryCandidate = {
  id: string;
  name: string;
  resolvedName?: string;
  location: string;
  routes: TrafficRouteItem[];
};

export type TrafficInsight = {
  type: 'obvious' | 'slight' | 'similar' | 'insufficient';
  title: string;
  reasons: string[];
};

export type TrafficSummary = {
  source: string;
  queriedAtText: string;
  origin: TrafficSummaryPlace;
  candidates: [TrafficSummaryCandidate, TrafficSummaryCandidate];
  trafficInsight: TrafficInsight;
  notice: string;
};
