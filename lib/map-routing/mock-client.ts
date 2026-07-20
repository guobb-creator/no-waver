import type { MapRoutingClient, MapRoutingResult } from './types';

export class MockMapRoutingClient implements MapRoutingClient {
  async planCandidateRoutes(input: {
    originName: string;
    candidateNames: [string, string];
    cityHint?: string;
  }): Promise<MapRoutingResult> {
    const combined = `${input.originName} ${input.candidateNames.join(' ')}`;

    if (/地图失败|路线失败|服务不可用/.test(combined)) {
      return { status: 'unavailable', message: '暂时无法获取地图导航数据。' };
    }

    if (/未知|不清楚|随便哪里|xxx/i.test(combined)) {
      return {
        status: 'needs_clarification',
        message: '我没能准确识别出其中一个地点。请确认 A、B、C 的地点名是否正确，最好补充城市或区域。',
      };
    }

    return {
      status: 'success',
      summary: {
        originName: input.originName,
        resolvedOriginName: input.originName,
        originLocation: '120.141,30.259',
        candidates: [
          {
            destinationName: input.candidateNames[0],
            resolvedDestinationName: input.candidateNames[0],
            location: '120.100,30.240',
            city: input.cityHint,
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
              { mode: 'cycling', durationMinutes: 18, distanceMeters: 4300, available: true },
              { mode: 'walking', durationMinutes: 42, distanceMeters: 3600, available: true },
            ],
          },
          {
            destinationName: input.candidateNames[1],
            resolvedDestinationName: input.candidateNames[1],
            location: '120.140,30.253',
            city: input.cityHint,
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
              { mode: 'walking', durationMinutes: 96, distanceMeters: 7900, available: true },
            ],
          },
        ],
      },
    };
  }
}
