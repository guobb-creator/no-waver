import { AMAP_REQUEST_TIMEOUT_MS } from '@/lib/app-config';
import { AmapMapRoutingClient } from './amap-client';
import { MockMapRoutingClient } from './mock-client';
import type { MapRoutingClient } from './types';

export function getMapRoutingClient(): MapRoutingClient {
  if (process.env.MAP_PROVIDER === 'amap') {
    const apiKey = process.env.AMAP_WEB_SERVICE_KEY;
    if (!apiKey) {
      throw new Error('AMAP_WEB_SERVICE_KEY is required when MAP_PROVIDER=amap');
    }

    return new AmapMapRoutingClient({
      apiKey,
      baseUrl: process.env.AMAP_BASE_URL || 'https://restapi.amap.com',
      timeoutMs: AMAP_REQUEST_TIMEOUT_MS,
    });
  }

  return new MockMapRoutingClient();
}
