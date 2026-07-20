import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/decision/route';

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('POST /api/decision', () => {
  it('returns a pure-text success response for a valid request', async () => {
    const response = await post({ question: '我已经到了西湖，下午去灵隐寺或岳庙。' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('success');
    expect(typeof body.message).toBe('string');
    expect(body.message).toContain('我的建议');
    expect(body.trafficSummary).toMatchObject({
      origin: { name: '西湖' },
      source: '高德地图路线数据',
    });
    expect(body.trafficSummary.candidates).toHaveLength(2);
    expect(body.trafficSummary.candidates[0].routes[0].lineNamesText).toBe('7路');
    expect(body.trafficSummary.candidates[0].routes[0].verificationUrl).toContain('uri.amap.com/navigation');
    expect(body.maxInputChars).toBeGreaterThan(0);
  });

  it('returns a 400 response for an empty question without internal details', async () => {
    const response = await post({ question: '   ' });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ status: 'error', message: '请输入一段旅行决策描述。' });
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it('returns a clarification response for incomplete location information', async () => {
    const response = await post({ question: '下午我应该去哪里？' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('needs_clarification');
    expect(body.trafficSummary).toBeUndefined();
  });

  it('asks the user to replace placeholder A/B/C place names before map routing', async () => {
    const response = await post({
      question:
        '我上午已经到了目的地 A，下午想去目的地 B 或目的地 C。请从交通便利度和游客评价两个方面帮我比较，并建议我去哪里。',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('needs_clarification');
    expect(body.message).toContain('示例占位符');
    expect(body.trafficSummary).toBeUndefined();
  });

  it('asks the user to verify places when map routing is unavailable', async () => {
    const response = await post({ question: '我已经到了西湖，下午去地图失败或岳王庙。' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('needs_clarification');
    expect(body.message).toContain('核实地点');
    expect(body.trafficSummary).toBeUndefined();
  });
});
