import { MockDecisionModelClient } from './mock-client';
import { SiliconFlowDecisionModelClient } from './siliconflow-client';
import type { DecisionModelClient } from './types';

export function getDecisionModelClient(): DecisionModelClient {
  if (process.env.MODEL_PROVIDER === 'siliconflow') {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      throw new Error('SILICONFLOW_API_KEY is required when MODEL_PROVIDER=siliconflow');
    }

    return new SiliconFlowDecisionModelClient({
      apiKey,
      baseUrl: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1',
      model: process.env.SILICONFLOW_MODEL || 'deepseek-ai/DeepSeek-V3.2',
      enableThinking: process.env.SILICONFLOW_ENABLE_THINKING === 'true',
      maxTokens: toPositiveNumber(process.env.SILICONFLOW_MAX_TOKENS, 1200),
      temperature: toPositiveNumber(process.env.SILICONFLOW_TEMPERATURE, 0.4),
    });
  }

  return new MockDecisionModelClient();
}

function toPositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
