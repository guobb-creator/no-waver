import type { RouteSummary, TravelMode } from '@/lib/map-routing/types';
import { formatDuration } from '@/lib/map-routing/route-summary';
import type { TrafficInsight } from './types';

const primaryModes: TravelMode[] = ['transit', 'driving', 'cycling', 'walking'];

const modeLabels: Record<TravelMode, string> = {
  transit: '公交/地铁',
  driving: '驾车/打车',
  cycling: '骑行',
  walking: '步行',
};

export function buildTrafficInsight(summary: RouteSummary): TrafficInsight {
  const [first, second] = summary.candidates;
  const comparisons = primaryModes
    .map((mode) => {
      const firstRoute = first.routes.find((route) => route.mode === mode && route.available);
      const secondRoute = second.routes.find((route) => route.mode === mode && route.available);
      if (!firstRoute || !secondRoute) return undefined;

      const diff = secondRoute.durationMinutes - firstRoute.durationMinutes;
      return {
        mode,
        fasterCandidateIndex: diff > 0 ? 0 : diff < 0 ? 1 : undefined,
        diffMinutes: Math.abs(diff),
      };
    })
    .filter((item): item is { mode: TravelMode; fasterCandidateIndex: 0 | 1 | undefined; diffMinutes: number } =>
      Boolean(item),
    );

  const meaningfulComparisons = comparisons.filter((comparison) => comparison.fasterCandidateIndex !== undefined);
  if (meaningfulComparisons.length === 0) {
    return {
      type: 'insufficient',
      title: '交通差异暂不明显',
      reasons: ['高德返回的主要交通方式耗时接近，交通不是本次决策的决定性因素。'],
    };
  }

  const score = meaningfulComparisons.reduce<[number, number]>(
    (current, comparison) => {
      if (comparison.fasterCandidateIndex === undefined) return current;
      current[comparison.fasterCandidateIndex] += comparison.diffMinutes;
      return current;
    },
    [0, 0],
  );
  const winnerIndex = score[0] >= score[1] ? 0 : 1;
  const winner = summary.candidates[winnerIndex];
  const winnerName = winner.destinationName || winner.resolvedDestinationName;
  const winnerComparisons = meaningfulComparisons
    .filter((comparison) => comparison.fasterCandidateIndex === winnerIndex)
    .sort((a, b) => b.diffMinutes - a.diffMinutes);
  const largestDiff = winnerComparisons[0]?.diffMinutes ?? 0;

  if (largestDiff >= 15) {
    return {
      type: 'obvious',
      title: `${winnerName}明显更方便`,
      reasons: buildReasons(winnerComparisons, winnerName),
    };
  }

  if (largestDiff >= 5) {
    return {
      type: 'slight',
      title: `${winnerName}略微更方便`,
      reasons: [
        ...buildReasons(winnerComparisons, winnerName).slice(0, 2),
        '交通差距存在但不算悬殊，游客体验和你的体力状态仍值得一起考虑。',
      ],
    };
  }

  return {
    type: 'similar',
    title: '两者交通差异不大',
    reasons: [
      '主要交通方式耗时差距小于 5 分钟。',
      '本次决策更适合重点比较游客体验、体力消耗和下午安排。',
    ],
  };
}

function buildReasons(
  comparisons: Array<{ mode: TravelMode; diffMinutes: number }>,
  winnerName: string,
): string[] {
  const reasons = comparisons
    .filter((comparison) => comparison.diffMinutes > 0)
    .slice(0, 3)
    .map((comparison) => `${modeLabels[comparison.mode]}去${winnerName}少 ${formatDuration(comparison.diffMinutes).replace('约 ', '')}`);

  return reasons.length > 0 ? reasons : [`多种交通方式都显示${winnerName}更省时间。`];
}
