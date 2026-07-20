import { MAX_INPUT_CHARS } from '@/lib/app-config';
import { formatRouteSummaryForPrompt } from '@/lib/map-routing/route-summary';
import type { RouteSummary } from '@/lib/map-routing/types';
import type { DecisionModelClient, DecisionResult, ExtractedTripPlaces } from './types';

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
  '决策重点是地图导航数据、交通便利度和游客评价。地图数据由服务端提供；游客评价只能基于模型已学习的通用知识，不能声称掌握实时评分或最新评论。',
  '如果地点无法识别、缺少当前地点或两个候选目的地、候选地点明显不在同城或距离过远，返回 needs_clarification，并提醒用户确认地点是否有误、补充当前地点和两个候选目的地。',
  '如果信息足够，返回 success，并用中文纯文本给出简短比较和明确建议。',
  '只输出 JSON，不要输出 Markdown、代码块或额外解释。格式为 {"status":"success|needs_clarification","message":"给用户看的中文纯文本"}。',
].join('\n');

const extractionSystemPrompt = [
  '你是中文旅行问题的信息抽取器。',
  '用户会用一段话描述：上午已经到达地点 A，下午纠结去候选地点 B 或 C。',
  '你的任务是抽取当前地点 origin、两个候选目的地 candidates，以及可选城市线索 cityHint。',
  '如果缺少 origin，或不是两个候选目的地，或地点名称是“这里/附近/那个地方”等无法定位表达，返回 needs_clarification。',
  '只输出 JSON，不要输出 Markdown、代码块或额外解释。',
  '成功格式：{"status":"success","origin":"地点A","candidates":["地点B","地点C"],"cityHint":"城市或空字符串"}',
  '需补充格式：{"status":"needs_clarification","message":"给用户看的中文补充提示"}',
].join('\n');

const dailySystemPrompt = [
  '你是“不再摇摆”的中文日常决策助手。',
  '当前产品版本是单轮对话：用户只会提交一段中文文字，你只返回一次结果。',
  '你只处理低风险、轻量生活选择，例如吃什么、是否出门、先做哪件小事、买不买低价日用品、休息还是运动等。',
  '本期日常板块不调用外部工具或实时数据，只能基于用户输入和模型已有的通用知识分析。',
  '如果用户没有写清楚至少两个选项，或缺少主要关注点，返回 needs_clarification，并引导补充选项、当前状态和在意因素。',
  '如果问题涉及医疗健康、法律纠纷、投资理财、大额消费、职业重大决策、人身安全、违法行为或其他高风险后果，返回 needs_clarification，不要直接替用户做决定，并建议用户咨询专业人士或改成低风险日常小选择。',
  '如果信息足够，返回 success。回复需要理性分析每个选项的优点和缺点，最后必须以“我的建议：”开头给出明确建议。',
  '结果必须是中文纯文本，语气轻松、直接、有帮助。',
  '只输出 JSON，不要输出 Markdown、代码块或额外解释。格式为 {"status":"success|needs_clarification","message":"给用户看的中文纯文本"}。',
].join('\n');

export class SiliconFlowDecisionModelClient implements DecisionModelClient {
  readonly maxInputChars = MAX_INPUT_CHARS;

  constructor(private readonly options: SiliconFlowClientOptions) {}

  async decide(question: string): Promise<DecisionResult> {
    return this.chatForDecision(systemPrompt, question);
  }

  async decideDaily(question: string): Promise<DecisionResult> {
    return this.chatForDecision(dailySystemPrompt, question);
  }

  async extractPlaces(question: string): Promise<ExtractedTripPlaces> {
    const content = await this.chat(extractionSystemPrompt, question, 600, 0.1);
    return parseExtractedTripPlaces(content);
  }

  async decideWithRoutes(question: string, routeSummary: RouteSummary): Promise<DecisionResult> {
    const routeSummaryText = formatRouteSummaryForPrompt(routeSummary);
    const prompt = [
      '请基于以下用户问题和地图路线摘要，生成最终中文回复。',
      '',
      '用户问题：',
      question,
      '',
      '地图路线摘要：',
      routeSummaryText,
      '',
      '回复要求：',
      '1. 前端会单独展示高德交通摘要，你不需要重复输出完整路线表。',
      '2. 交通时间、距离、换乘、步行距离和线路名只能引用上方地图路线摘要，不得自行估算或补充。',
      '3. 如果引用交通数据，只引用关键差异，不要虚构地图摘要中没有的交通方式或时间。',
      '4. 分别理性分析两个目的地的优点和缺点。',
      '5. 游客评价只能基于你已有知识，不要说成实时评分、最新评论或刚查询到的评价。',
      '6. 最后必须以“我的建议：”开头给出明确建议。',
      '7. 只输出 JSON，格式为 {"status":"success","message":"给用户看的中文纯文本"}。',
    ].join('\n');

    return this.chatForDecision(systemPrompt, prompt);
  }

  async decideWithoutMapData(question: string, unavailableReason: string): Promise<DecisionResult> {
    const prompt = [
      '本次没有成功获取地图导航数据，请基于模型已有知识给出非实时建议。',
      `地图失败原因（只可概括，不要暴露技术细节）：${unavailableReason}`,
      '',
      '回复必须明确说明：暂时没有获取到地图导航数据，所以路程和交通判断不是实时导航结果。',
      '仍需理性分析两个候选目的地优缺点，游客评价只能基于已有知识。',
      '',
      '用户问题：',
      question,
    ].join('\n');

    return this.chatForDecision(systemPrompt, prompt);
  }

  private async chatForDecision(system: string, user: string): Promise<DecisionResult> {
    const content = await this.chat(system, user, this.options.maxTokens, this.options.temperature);
    return parseDecisionResult(content);
  }

  private async chat(system: string, user: string, maxTokens: number, temperature: number): Promise<string> {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.options.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        enable_thinking: this.options.enableThinking,
        max_tokens: maxTokens,
        temperature,
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

    return content;
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

function parseExtractedTripPlaces(content: string): ExtractedTripPlaces {
  const jsonText = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(jsonText) as {
      status?: string;
      origin?: unknown;
      candidates?: unknown;
      cityHint?: unknown;
      message?: unknown;
    };

    if (parsed.status === 'needs_clarification' && typeof parsed.message === 'string' && parsed.message.trim()) {
      return { status: 'needs_clarification', message: parsed.message.trim() };
    }

    if (
      parsed.status === 'success' &&
      typeof parsed.origin === 'string' &&
      Array.isArray(parsed.candidates) &&
      parsed.candidates.length === 2 &&
      parsed.candidates.every((candidate) => typeof candidate === 'string' && candidate.trim())
    ) {
      return {
        status: 'success',
        origin: parsed.origin.trim(),
        candidates: [parsed.candidates[0].trim(), parsed.candidates[1].trim()],
        cityHint: typeof parsed.cityHint === 'string' && parsed.cityHint.trim() ? parsed.cityHint.trim() : undefined,
      };
    }
  } catch {
    // The caller maps unclear extraction to a user-facing clarification.
  }

  return {
    status: 'needs_clarification',
    message: '我没能准确识别出当前地点和两个候选目的地。请补充城市或区域，并写清楚 A、B、C。',
  };
}
