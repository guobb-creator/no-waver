import { afterEach, describe, expect, it, vi } from 'vitest';
import { AmapMapRoutingClient } from '@/lib/map-routing/amap-client';
import { getMapRoutingClient } from '@/lib/map-routing/client-factory';
import { MockMapRoutingClient } from '@/lib/map-routing/mock-client';

describe('map routing clients', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MAP_PROVIDER;
    delete process.env.AMAP_WEB_SERVICE_KEY;
  });

  it('returns mock route data without external network access', async () => {
    const client = new MockMapRoutingClient();
    const result = await client.planCandidateRoutes({
      originName: '西湖',
      candidateNames: ['灵隐寺', '岳王庙'],
      cityHint: '杭州',
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.summary.candidates[0].routes.some((route) => route.mode === 'transit')).toBe(true);
    }
  });

  it('selects the amap client only when configured', () => {
    process.env.MAP_PROVIDER = 'amap';
    process.env.AMAP_WEB_SERVICE_KEY = 'amap-test-key';

    expect(getMapRoutingClient()).toBeInstanceOf(AmapMapRoutingClient);
  });

  it('does not leak the amap key when configuration is missing', () => {
    process.env.MAP_PROVIDER = 'amap';

    expect(() => getMapRoutingClient()).toThrow('AMAP_WEB_SERVICE_KEY is required');
  });

  it('parses geocoding and routes from Amap responses', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/v3/geocode/geo')) {
        const address = new URL(url).searchParams.get('address') || '';
        return jsonResponse({
          status: '1',
          count: '1',
          geocodes: [
            {
              formatted_address: `杭州市${address}`,
              location: address === '西湖' ? '120.141,30.259' : '120.100,30.240',
              city: '杭州市',
              citycode: '0571',
              adcode: '330100',
            },
          ],
        });
      }

      if (url.includes('/v4/direction/bicycling')) {
        return jsonResponse({ errcode: 0, data: { paths: [{ duration: 1200, distance: 4500 }] } });
      }

      if (url.includes('/v3/direction/transit/integrated')) {
        return jsonResponse({ status: '1', route: { transits: [{ duration: '1800', distance: '5500' }] } });
      }

      return jsonResponse({ status: '1', route: { paths: [{ duration: '900', distance: '4200' }] } });
    });

    const client = new AmapMapRoutingClient({
      apiKey: 'amap-test-key',
      baseUrl: 'https://restapi.amap.com',
      timeoutMs: 8000,
    });
    const result = await client.planCandidateRoutes({
      originName: '西湖',
      candidateNames: ['灵隐寺', '岳王庙'],
      cityHint: '杭州',
    });

    expect(result.status).toBe('success');
    expect(fetchMock).toHaveBeenCalled();
    if (result.status === 'success') {
      expect(result.summary.candidates[0].routes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ mode: 'transit', durationMinutes: 30, available: true }),
          expect.objectContaining({ mode: 'driving', durationMinutes: 15, available: true }),
          expect.objectContaining({ mode: 'cycling', durationMinutes: 20, available: true }),
          expect.objectContaining({ mode: 'walking', durationMinutes: 15, available: true }),
        ]),
      );
    }
  });

  it('asks for clarification when Amap cannot geocode a place', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      jsonResponse({ status: '1', count: '0', geocodes: [], pois: [] }),
    );

    const client = new AmapMapRoutingClient({
      apiKey: 'amap-test-key',
      baseUrl: 'https://restapi.amap.com',
      timeoutMs: 8000,
    });
    const result = await client.planCandidateRoutes({
      originName: '西湖',
      candidateNames: ['未知地点', '岳王庙'],
    });

    expect(result.status).toBe('needs_clarification');
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
