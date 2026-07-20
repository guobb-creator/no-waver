import { describe, expect, it } from 'vitest';
import { buildAmapMobileIframeUrl, buildAmapNavigationUrl } from '@/lib/route-confirmation/amap-uri';
import { buildRouteConfirmation } from '@/lib/route-confirmation/build-route-confirmation';
import type { RouteSummary } from '@/lib/map-routing/types';

const routeSummary: RouteSummary = {
  originName: '西湖',
  resolvedOriginName: '杭州西湖',
  originLocation: '120.141,30.259',
  candidates: [
    {
      destinationName: '灵隐寺',
      resolvedDestinationName: '灵隐寺',
      location: '120.100,30.240',
      routes: [
        { mode: 'transit', durationMinutes: 25, available: true },
        { mode: 'driving', durationMinutes: 12, available: true },
      ],
    },
    {
      destinationName: '岳王庙',
      resolvedDestinationName: '岳王庙',
      location: '120.140,30.253',
      routes: [
        { mode: 'transit', durationMinutes: 15, available: true },
        { mode: 'cycling', durationMinutes: 10, available: true },
      ],
    },
  ],
};

describe('route confirmation', () => {
  it('builds a mobile-first route confirmation with public transit as default', () => {
    const confirmation = buildRouteConfirmation(routeSummary);

    expect(confirmation).toMatchObject({
      origin: { name: '西湖', location: '120.141,30.259' },
      defaultCandidateId: 'candidate-1',
      defaultMode: 'transit',
      notice: expect.stringContaining('实际导航以高德为准'),
    });
    expect(confirmation?.candidates[0].availableModes).toEqual(['transit', 'driving']);
    expect(confirmation?.candidates[1].availableModes).toEqual(['transit', 'cycling']);
  });

  it('does not build confirmation when coordinates are missing', () => {
    expect(buildRouteConfirmation({ ...routeSummary, originLocation: undefined })).toBeUndefined();
  });

  it('builds iframe and navigation urls with correct callnative values', () => {
    const confirmation = buildRouteConfirmation(routeSummary);
    if (!confirmation) throw new Error('expected confirmation');

    const destination = confirmation.candidates[1];
    const iframeUrl = buildAmapMobileIframeUrl({ origin: confirmation.origin, destination, mode: 'transit' });
    const navigationUrl = buildAmapNavigationUrl({
      origin: confirmation.origin,
      destination,
      mode: 'transit',
      callnative: true,
    });

    expect(iframeUrl).toContain('https://m.amap.com/navigation/buslist/sort=spd');
    expect(iframeUrl).toContain('callnative=0');
    expect(iframeUrl).toContain('saddr=120.141%2C30.259%2C');
    expect(navigationUrl).toContain('https://uri.amap.com/navigation');
    expect(navigationUrl).toContain('mode=bus');
    expect(navigationUrl).toContain('callnative=1');
  });
});
