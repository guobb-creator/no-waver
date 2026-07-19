import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiliconFlowDecisionModelClient } from '@/lib/decision-model/siliconflow-client';

const options = {
  apiKey: 'test-key',
  baseUrl: 'https://api.siliconflow.cn/v1',
  model: 'deepseek-ai/DeepSeek-V3.2',
  enableThinking: false,
  maxTokens: 1200,
  temperature: 0.4,
};

describe('SiliconFlowDecisionModelClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls SiliconFlow chat completions with configurable model options', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: 'success',
                  message: '建议去灵隐寺，因为交通更顺路，游客评价也更稳定。',
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const client = new SiliconFlowDecisionModelClient(options);
    const result = await client.decide('我已经到了西湖，下午去灵隐寺或岳庙，想比较交通和游客评价。');

    expect(result).toEqual({
      status: 'success',
      message: '建议去灵隐寺，因为交通更顺路，游客评价也更稳定。',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.siliconflow.cn/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
      }),
    );

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      model: string;
      enable_thinking: boolean;
      max_tokens: number;
      temperature: number;
      stream: boolean;
    };
    expect(requestBody).toMatchObject({
      model: 'deepseek-ai/DeepSeek-V3.2',
      enable_thinking: false,
      max_tokens: 1200,
      temperature: 0.4,
      stream: false,
    });
  });

  it('maps a provider error to a thrown error for the API route to handle', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('rate limited', { status: 429 }));

    const client = new SiliconFlowDecisionModelClient(options);

    await expect(client.decide('我已经到了西湖，下午去灵隐寺或岳庙。')).rejects.toThrow(
      'SiliconFlow request failed',
    );
  });

  it('extracts places with a structured model call', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: 'success',
                  origin: '西湖',
                  candidates: ['灵隐寺', '岳王庙'],
                  cityHint: '杭州',
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const client = new SiliconFlowDecisionModelClient(options);
    const result = await client.extractPlaces('我已经到了杭州西湖，下午去灵隐寺或岳王庙。');

    expect(result).toEqual({
      status: 'success',
      origin: '西湖',
      candidates: ['灵隐寺', '岳王庙'],
      cityHint: '杭州',
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { messages: Array<{ content: string }> };
    expect(requestBody.messages[0].content).toContain('信息抽取器');
  });

  it('builds a route-enhanced decision prompt without exposing map keys', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: 'success',
                  message: '路线对比：\n\n灵隐寺：公交/地铁约 25 分钟\n岳王庙：公交/地铁约 15 分钟\n\n我的建议：选岳王庙。',
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const client = new SiliconFlowDecisionModelClient(options);
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
    const serializedRequest = String(fetchMock.mock.calls[0][1]?.body);
    expect(serializedRequest).toContain('路线对比');
    expect(serializedRequest).toContain('我的建议');
    expect(serializedRequest).not.toContain('amap-test-key');
  });
});
