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
});
