import { describe, expect, it } from 'vitest';
import {
  formatCandidateRouteLine,
  formatDuration,
  formatRouteSummaryForPrompt,
  getDisplayableRoutes,
} from '@/lib/map-routing/route-summary';
import type { CandidateRouteSummary, RouteSummary } from '@/lib/map-routing/types';

describe('route summary formatting', () => {
  const candidate: CandidateRouteSummary = {
    destinationName: '灵隐寺',
    resolvedDestinationName: '浙江省杭州市西湖区灵隐寺',
    routes: [
      { mode: 'walking', durationMinutes: 48, available: true },
      { mode: 'driving', durationMinutes: 12, available: true },
      { mode: 'transit', durationMinutes: 25, available: true },
      { mode: 'cycling', durationMinutes: 18, available: true },
    ],
  };

  it('formats short and long durations in Chinese', () => {
    expect(formatDuration(25)).toBe('约 25 分钟');
    expect(formatDuration(70)).toBe('约 1 小时 10 分钟');
  });

  it('filters walking routes longer than the configured display threshold', () => {
    const displayableRoutes = getDisplayableRoutes(candidate.routes, 30);

    expect(displayableRoutes.map((route) => route.mode)).toEqual(['transit', 'driving', 'cycling']);
  });

  it('formats a short pure-text line without markdown table syntax', () => {
    expect(formatCandidateRouteLine(candidate, 30)).toBe(
      '灵隐寺：公交/地铁约 25 分钟，驾车/打车约 12 分钟，骑行约 18 分钟，步行时间较长，不建议步行',
    );
  });

  it('formats a route summary for the model prompt', () => {
    const summary: RouteSummary = {
      originName: '西湖',
      resolvedOriginName: '浙江省杭州市西湖风景名胜区',
      candidates: [candidate, { ...candidate, destinationName: '岳王庙', resolvedDestinationName: '岳王庙' }],
    };

    expect(formatRouteSummaryForPrompt(summary)).toContain('路线对比：');
    expect(formatRouteSummaryForPrompt(summary)).toContain('西湖');
    expect(formatRouteSummaryForPrompt(summary)).toContain('岳王庙');
  });
});
