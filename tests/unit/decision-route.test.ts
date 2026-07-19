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
    expect(body.message).toContain('路线对比');
    expect(body.message).toContain('我的建议');
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
  });

  it('falls back when map routing is unavailable', async () => {
    const response = await post({ question: '我已经到了西湖，下午去地图失败或岳王庙。' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('success');
    expect(body.message).toContain('暂时没有获取到地图导航数据');
  });
});
