import type {
  CandidateRouteSummary,
  MapRoutingClient,
  MapRoutingResult,
  RouteOption,
  TravelMode,
} from './types';

type AmapClientOptions = {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
};

type ResolvedPlace = {
  inputName: string;
  resolvedName: string;
  location: string;
  city?: string;
  citycode?: string;
  adcode?: string;
};

type AmapGeocodeResponse = {
  status?: string;
  info?: string;
  count?: string;
  geocodes?: Array<{
    formatted_address?: string;
    location?: string;
    city?: string | string[];
    citycode?: string;
    adcode?: string;
    level?: string;
  }>;
};

type AmapPoiSearchResponse = {
  status?: string;
  info?: string;
  count?: string;
  pois?: Array<{
    name?: string;
    location?: string;
    cityname?: string | string[];
    citycode?: string;
    adcode?: string;
    adname?: string;
  }>;
};

type AmapRouteResponse = {
  status?: string;
  info?: string;
  count?: string;
  route?: {
    paths?: Array<{ distance?: string; duration?: string }>;
    transits?: Array<{
      distance?: string;
      duration?: string;
      walking_distance?: string;
      segments?: Array<{
        walking?: { distance?: string };
        bus?: {
          buslines?: Array<{
            name?: string;
          }>;
        };
      }>;
    }>;
  };
};

type AmapCyclingResponse = {
  errcode?: number;
  errmsg?: string;
  data?: {
    paths?: Array<{ distance?: number | string; duration?: number | string }>;
  };
};

const clarificationMessage =
  '我没能准确识别出其中一个地点。请确认 A、B、C 的地点名是否正确，最好补充城市或区域，例如“杭州西湖、灵隐寺、岳王庙”。';

const farAwayMessage =
  '地图结果显示这些地点可能不在同一城市，或距离明显超过一次下午行程的合理范围。请确认地点是否有误，或补充更准确的城市/区域。';

export class AmapMapRoutingClient implements MapRoutingClient {
  constructor(private readonly options: AmapClientOptions) {}

  async planCandidateRoutes(input: {
    originName: string;
    candidateNames: [string, string];
    cityHint?: string;
  }): Promise<MapRoutingResult> {
    try {
      const origin = await this.geocode(input.originName, input.cityHint);
      const candidates = await Promise.all(
        input.candidateNames.map((candidate) => this.geocode(candidate, input.cityHint)) as [
          Promise<ResolvedPlace>,
          Promise<ResolvedPlace>,
        ],
      );

      if (this.isLikelyCrossCity(origin, candidates)) {
        return { status: 'needs_clarification', message: farAwayMessage };
      }

      const summaries = await Promise.all(
        candidates.map((candidate) => this.planRoutesForCandidate(origin, candidate)) as [
          Promise<CandidateRouteSummary>,
          Promise<CandidateRouteSummary>,
        ],
      );

      if (summaries.some((summary) => summary.routes.every((route) => !route.available))) {
        return {
          status: 'needs_clarification',
          message: '有一个目的地暂时无法获取可靠的地图导航路线。请核实地点名称是否有误，或补充城市/区域后再试。',
        };
      }

      return {
        status: 'success',
        summary: {
          originName: input.originName,
          resolvedOriginName: origin.resolvedName,
          originLocation: origin.location,
          candidates: summaries,
        },
      };
    } catch (error) {
      if (error instanceof AmapClarificationError) {
        return { status: 'needs_clarification', message: error.message };
      }

      return { status: 'unavailable', message: '暂时无法获取地图导航数据。' };
    }
  }

  private async geocode(address: string, cityHint?: string): Promise<ResolvedPlace> {
    const data = await this.getJson<AmapGeocodeResponse>('/v3/geocode/geo', {
      address,
      city: cityHint,
      output: 'JSON',
    });

    if (data.status === '1') {
      const geocodes = (data.geocodes || []).filter((item) => Boolean(item.location));
      if (geocodes.length > 0) {
        const first = geocodes[0];
        const sameNamedAlternatives = geocodes.filter((item) => {
          const city = normalizeAmapString(item.city);
          return city && city !== normalizeAmapString(first.city);
        });

        if (!cityHint && geocodes.length > 1 && sameNamedAlternatives.length > 0) {
          throw new AmapClarificationError(clarificationMessage);
        }

        return {
          inputName: address,
          resolvedName: first.formatted_address || address,
          location: first.location || '',
          city: normalizeAmapString(first.city),
          citycode: first.citycode,
          adcode: first.adcode,
        };
      }
    }

    return this.searchPoi(address, cityHint);
  }

  private async searchPoi(keywords: string, cityHint?: string): Promise<ResolvedPlace> {
    const data = await this.getJson<AmapPoiSearchResponse>('/v3/place/text', {
      keywords,
      city: cityHint,
      citylimit: cityHint ? 'true' : undefined,
      offset: '10',
      page: '1',
      extensions: 'base',
      output: 'JSON',
    });

    if (data.status !== '1') {
      throw new AmapUnavailableError(data.info || 'Amap POI search failed');
    }

    const pois = (data.pois || []).filter((item) => Boolean(item.location));
    if (pois.length === 0) {
      throw new AmapClarificationError(clarificationMessage);
    }

    const first = pois[0];
    const sameNamedAlternatives = pois.filter((item) => {
      const city = normalizeAmapString(item.cityname);
      return city && city !== normalizeAmapString(first.cityname);
    });

    if (!cityHint && pois.length > 1 && sameNamedAlternatives.length > 0) {
      throw new AmapClarificationError(clarificationMessage);
    }

    return {
      inputName: keywords,
      resolvedName: first.name || keywords,
      location: first.location || '',
      city: normalizeAmapString(first.cityname),
      citycode: first.citycode,
      adcode: first.adcode,
    };
  }

  private async planRoutesForCandidate(
    origin: ResolvedPlace,
    destination: ResolvedPlace,
  ): Promise<CandidateRouteSummary> {
    const routeResults = await Promise.all([
      this.getTransitRoute(origin, destination),
      this.getBasicRoute('driving', '/v3/direction/driving', origin, destination),
      this.getCyclingRoute(origin, destination),
      this.getBasicRoute('walking', '/v3/direction/walking', origin, destination),
    ]);

    return {
      destinationName: destination.inputName,
      resolvedDestinationName: destination.resolvedName,
      location: destination.location,
      city: destination.city,
      routes: routeResults,
    };
  }

  private async getTransitRoute(origin: ResolvedPlace, destination: ResolvedPlace): Promise<RouteOption> {
    try {
      const data = await this.getJson<AmapRouteResponse>('/v3/direction/transit/integrated', {
        origin: origin.location,
        destination: destination.location,
        city: origin.citycode || origin.city,
        cityd: destination.citycode || destination.city,
        strategy: '0',
        output: 'JSON',
      });

      if (data.status !== '1') throw new AmapUnavailableError(data.info || 'Transit route failed');

      const first = data.route?.transits?.[0];
      return toTransitRouteOption(first);
    } catch {
      return unavailableRoute('transit', '地图未返回有效公交/地铁路线');
    }
  }

  private async getBasicRoute(
    mode: Extract<TravelMode, 'driving' | 'walking'>,
    path: string,
    origin: ResolvedPlace,
    destination: ResolvedPlace,
  ): Promise<RouteOption> {
    try {
      const data = await this.getJson<AmapRouteResponse>(path, {
        origin: origin.location,
        destination: destination.location,
        output: 'JSON',
      });

      if (data.status !== '1') throw new AmapUnavailableError(data.info || `${mode} route failed`);

      const first = data.route?.paths?.[0];
      return toRouteOption(mode, first?.duration, first?.distance);
    } catch {
      return unavailableRoute(mode);
    }
  }

  private async getCyclingRoute(origin: ResolvedPlace, destination: ResolvedPlace): Promise<RouteOption> {
    try {
      const data = await this.getJson<AmapCyclingResponse>('/v4/direction/bicycling', {
        origin: origin.location,
        destination: destination.location,
        output: 'JSON',
      });

      if (data.errcode && data.errcode !== 0) {
        throw new AmapUnavailableError(data.errmsg || 'Cycling route failed');
      }

      const first = data.data?.paths?.[0];
      return toRouteOption('cycling', first?.duration, first?.distance);
    } catch {
      return unavailableRoute('cycling');
    }
  }

  private isLikelyCrossCity(origin: ResolvedPlace, candidates: ResolvedPlace[]): boolean {
    if (!origin.city) return false;

    return candidates.some((candidate) => candidate.city && candidate.city !== origin.city);
  }

  private async getJson<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
    const url = new URL(path, this.options.baseUrl.replace(/\/$/, ''));
    url.searchParams.set('key', this.options.apiKey);

    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new AmapUnavailableError(`Amap request failed with status ${response.status}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

class AmapClarificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmapClarificationError';
    Object.setPrototypeOf(this, AmapClarificationError.prototype);
  }
}

class AmapUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmapUnavailableError';
    Object.setPrototypeOf(this, AmapUnavailableError.prototype);
  }
}

function normalizeAmapString(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return undefined;
  return value || undefined;
}

function toRouteOption(
  mode: TravelMode,
  durationSeconds: string | number | undefined,
  distanceMeters?: string | number,
): RouteOption {
  const seconds = Number(durationSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return unavailableRoute(mode);

  const distance = Number(distanceMeters);
  return {
    mode,
    durationMinutes: Math.max(1, Math.round(seconds / 60)),
    distanceMeters: Number.isFinite(distance) && distance > 0 ? Math.round(distance) : undefined,
    available: true,
  };
}

function toTransitRouteOption(transit: NonNullable<NonNullable<AmapRouteResponse['route']>['transits']>[number] | undefined): RouteOption {
  const base = toRouteOption('transit', transit?.duration, transit?.distance);
  if (!base.available) return base;

  const walkingDistance = Number(transit?.walking_distance);
  const lineNames = extractLineNames(transit);

  return {
    ...base,
    walkingDistanceMeters:
      Number.isFinite(walkingDistance) && walkingDistance > 0
        ? Math.round(walkingDistance)
        : extractWalkingDistance(transit),
    transfers: Math.max(0, lineNames.length - 1),
    lineNames,
  };
}

function extractLineNames(transit: NonNullable<NonNullable<AmapRouteResponse['route']>['transits']>[number] | undefined): string[] {
  const names = new Set<string>();

  for (const segment of transit?.segments || []) {
    for (const busline of segment.bus?.buslines || []) {
      const name = busline.name?.split('(')[0]?.trim();
      if (name) names.add(name);
    }
  }

  return Array.from(names).slice(0, 4);
}

function extractWalkingDistance(
  transit: NonNullable<NonNullable<AmapRouteResponse['route']>['transits']>[number] | undefined,
): number | undefined {
  const total = (transit?.segments || []).reduce((sum, segment) => {
    const distance = Number(segment.walking?.distance);
    return Number.isFinite(distance) && distance > 0 ? sum + distance : sum;
  }, 0);

  return total > 0 ? Math.round(total) : undefined;
}

function unavailableRoute(mode: TravelMode, note?: string): RouteOption {
  return {
    mode,
    durationMinutes: 0,
    available: false,
    note,
  };
}
