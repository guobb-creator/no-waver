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
});
