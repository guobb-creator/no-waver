import { describe, expect, it } from 'vitest';
import { MockDecisionModelClient } from '@/lib/decision-model/mock-client';

describe('MockDecisionModelClient', () => {
  const client = new MockDecisionModelClient();

  it('returns a non-real-time plain-text demo suggestion for a complete request', async () => {
    const result = await client.decide('我已经到了西湖，下午去灵隐寺或岳庙，想比较交通和游客评价。');

    expect(result.status).toBe('success');
    expect(result.message).toContain('不代表实时交通');
  });

  it('asks for clarification when location details are incomplete', async () => {
    const result = await client.decide('下午我应该去哪里？');

    expect(result).toEqual({
      status: 'needs_clarification',
      message: '请确认目的地名称是否有误，并补充当前地点和两个下午候选目的地后再试。',
    });
  });

  it('asks for clarification for an obviously cross-city request', async () => {
    const result = await client.decide('我已经到了北京，下午去上海外滩或北京故宫。');

    expect(result.status).toBe('needs_clarification');
  });

  it('generates a daily suggestion for a low-risk choice', async () => {
    const result = await client.decideDaily('我今晚纠结是自己做饭还是点外卖，想省钱但也不想太累，明天还要早起。');

    expect(result.status).toBe('success');
    expect(result.message).toContain('我的建议');
  });

  it('asks for daily clarification when options are too vague', async () => {
    const result = await client.decideDaily('我该怎么办？');

    expect(result.status).toBe('needs_clarification');
    expect(result.message).toContain('两个选项');
  });

  it('does not directly decide high-risk daily requests', async () => {
    const result = await client.decideDaily('我纠结要不要把全部积蓄拿去投资股票。');

    expect(result.status).toBe('needs_clarification');
    expect(result.message).toContain('高风险');
  });

  it('extracts A/B/C places for map routing', async () => {
    const result = await client.extractPlaces('我已经到了杭州西湖，下午去灵隐寺或岳王庙，想比较交通和游客评价。');

    expect(result).toMatchObject({
      status: 'success',
      origin: '杭州西湖',
      candidates: ['灵隐寺', '岳王庙'],
      cityHint: '杭州',
    });
  });

  it('generates route-enhanced text with a lightweight comparison', async () => {
    const result = await client.decideWithRoutes('我已经到了西湖，下午去灵隐寺或岳王庙。', {
      originName: '西湖',
      candidates: [
        {
          destinationName: '灵隐寺',
          resolvedDestinationName: '灵隐寺',
          routes: [{ mode: 'transit', durationMinutes: 25, available: true }],
        },
        {
          destinationName: '岳王庙',
          resolvedDestinationName: '岳王庙',
          routes: [{ mode: 'transit', durationMinutes: 15, available: true }],
        },
      ],
    });

    expect(result.status).toBe('success');
    expect(result.message).toContain('路线对比');
    expect(result.message).toContain('我的建议');
  });

  it('makes map fallback explicit', async () => {
    const result = await client.decideWithoutMapData('我已经到了西湖，下午去灵隐寺或岳王庙。', '暂时无法获取地图导航数据。');

    expect(result.status).toBe('success');
    expect(result.message).toContain('暂时没有获取到地图导航数据');
  });
});
