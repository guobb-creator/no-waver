import { MAX_INPUT_CHARS } from '@/lib/app-config';
import type { DecisionModelClient, DecisionResult } from './types';

type SiliconFlowClientOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  enableThinking: boolean;
  maxTokens: number;
  temperature: number;
};

type SiliconFlowResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const systemPrompt = [
  '你是“不再摇摆”的中文旅行决策助手。',
  '当前产品版本是单轮对话：用户只会提交一段中文文字，你只返回一次结果。',
  '用户通常是青年，在旅行途中的某一天上午已经到达目的地 A，下午纠结去同城目的地 B 或 C。',
  '决策重点是交通便利度和游客评价。当前版本不调用地图、搜索、点评或实时交通工具，只能基于模型已学习的通用知识进行判断，不能声称掌握实时信息或最新评价。',
  '如果地点无法识别、缺少当前地点或两个候选目的地、候选地点明显不在同城或距离过远，返回 needs_clarification，并提醒用户确认地点是否有误、补充当前地点和两个候选目的地。',
  '如果信息足够，返回 success，并用中文纯文本给出简短比较和明确建议。',
  '只输出 JSON，不要输出 Markdown、代码块或额外解释。格式为 {"status":"success|needs_clarification","message":"给用户看的中文纯文本"}。',
].join('\n');

export class SiliconFlowDecisionModelClient implements DecisionModelClient {
  readonly maxInputChars = MAX_INPUT_CHARS;

  constructor(private readonly options: SiliconFlowClientOptions) {}

  async decide(question: string): Promise<DecisionResult> {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.options.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        enable_thinking: this.options.enableThinking,
        max_tokens: this.options.maxTokens,
        temperature: this.options.temperature,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`SiliconFlow request failed with status ${response.status}`);
    }

    const data = (await response.json()) as SiliconFlowResponse;
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('SiliconFlow returned an empty response');
    }

    return parseDecisionResult(content);
  }
}

function parseDecisionResult(content: string): DecisionResult {
  const jsonText = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(jsonText) as Partial<DecisionResult>;
    if (
      (parsed.status === 'success' || parsed.status === 'needs_clarification') &&
      typeof parsed.message === 'string' &&
      parsed.message.trim()
    ) {
      return { status: parsed.status, message: parsed.message.trim() };
    }
  } catch {
    // Some providers may return plain text despite the JSON instruction.
  }

  return { status: 'success', message: content };
}
