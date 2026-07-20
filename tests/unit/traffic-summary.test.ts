import { describe, expect, it } from 'vitest';
import { buildTrafficSummary, formatDistance } from '@/lib/traffic-summary/build-traffic-summary';
import { buildAmapVerificationUrl } from '@/lib/traffic-summary/amap-verification-url';
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
        {
          mode: 'transit',
          durationMinutes: 25,
          distanceMeters: 5200,
          walkingDistanceMeters: 680,
          transfers: 0,
          lineNames: ['7路'],
          available: true,
        },
        { mode: 'driving', durationMinutes: 12, distanceMeters: 4100, available: true },
        { mode: 'walking', durationMinutes: 42, distanceMeters: 3600, available: true },
      ],
    },
    {
      destinationName: '岳王庙',
      resolvedDestinationName: '岳王庙',
      location: '120.140,30.253',
      routes: [
        {
          mode: 'transit',
          durationMinutes: 45,
          distanceMeters: 9800,
          walkingDistanceMeters: 1100,
          transfers: 1,
          lineNames: ['7路', '地铁1号线'],
          available: true,
        },
        { mode: 'driving', durationMinutes: 28, distanceMeters: 8700, available: true },
        { mode: 'cycling', durationMinutes: 35, distanceMeters: 8900, available: true },
      ],
    },
  ],
};

describe('traffic summary', () => {
  it('builds trusted traffic summary with per-mode Amap links', () => {
    const summary = buildTrafficSummary(routeSummary);

    expect(summary).toMatchObject({
      source: '高德地图路线数据',
      origin: { name: '西湖', location: '120.141,30.259' },
      trafficInsight: { type: 'obvious', title: '灵隐寺明显更方便' },
    });
    expect(summary?.candidates[0].routes[0]).toMatchObject({
      mode: 'transit',
      label: '公交/地铁',
      durationText: '约 25 分钟',
      lineNamesText: '7路',
      transfersText: '换乘 0 次',
      walkingDistanceText: '步行约 680 米',
    });
    expect(summary?.candidates[0].routes.map((route) => route.verificationUrl)).toHaveLength(3);
    expect(summary?.candidates[0].routes[0].verificationUrl).toContain('mode=bus');
    expect(summary?.candidates[0].routes[1].verificationUrl).toContain('mode=car');
  });

  it('does not build summary when coordinates are missing', () => {
    expect(buildTrafficSummary({ ...routeSummary, originLocation: undefined })).toBeUndefined();
  });

  it('keeps long walking visible but marks it as not recommended', () => {
    const summary = buildTrafficSummary(routeSummary);
    const walking = summary?.candidates[0].routes.find((route) => route.mode === 'walking');

    expect(walking).toMatchObject({
      durationText: '约 42 分钟',
      note: '时间较长，不建议步行',
    });
  });

  it('formats distances for route cards', () => {
    expect(formatDistance(680)).toBe('约 680 米');
    expect(formatDistance(5200)).toBe('约 5.2 公里');
    expect(formatDistance(12000)).toBe('约 12 公里');
  });

  it('builds encoded Amap verification URLs', () => {
    const url = buildAmapVerificationUrl({
      origin: { name: '杭州西湖', location: '120.141,30.259' },
      destination: { name: '灵隐寺', location: '120.100,30.240' },
      mode: 'cycling',
    });

    expect(url).toContain('https://uri.amap.com/navigation');
    expect(url).toContain('mode=ride');
    expect(url).toContain('callnative=1');
    expect(url).toContain('%E7%81%B5%E9%9A%90%E5%AF%BA');
  });
});
