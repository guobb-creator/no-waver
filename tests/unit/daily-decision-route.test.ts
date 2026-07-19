import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/daily-decision/route';

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/daily-decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('POST /api/daily-decision', () => {
  it('returns a pure-text success response for a low-risk daily request', async () => {
    const response = await post({
      question: '我今晚纠结是自己做饭还是点外卖，想省钱但也不想太累，明天还要早起。',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('success');
    expect(body.message).toContain('我的建议');
    expect(body.maxInputChars).toBeGreaterThan(0);
  });

  it('returns a 400 response for an empty question without internal details', async () => {
    const response = await post({ question: '   ' });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.status).toBe('error');
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it('asks for more context when daily options are unclear', async () => {
    const response = await post({ question: '我该怎么办？' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('needs_clarification');
    expect(body.message).toContain('补充');
  });

  it('does not directly decide high-risk issues', async () => {
    const response = await post({ question: '我纠结要不要把全部积蓄拿去投资股票。' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('needs_clarification');
    expect(body.message).toContain('高风险');
  });
});
