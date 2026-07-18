import { MAX_INPUT_CHARS } from '@/lib/app-config';
import type { DecisionModelClient, DecisionResult } from './types';

const clarificationMessage =
  '请确认目的地名称是否有误，并补充当前地点和两个下午候选目的地后再试。';

/** A local stand-in that exercises the product flow without any external call. */
export class MockDecisionModelClient implements DecisionModelClient {
  readonly maxInputChars = MAX_INPUT_CHARS;

  async decide(question: string): Promise<DecisionResult> {
    const text = question.trim();

    if (this.needsClarification(text)) {
      return { status: 'needs_clarification', message: clarificationMessage };
    }

    return {
      status: 'success',
      message:
        '演示建议：请优先选择交通更顺路、且更符合你下午可用时间的目的地。这个回复仅用于演示单轮决策流程，基于模型已有知识，不代表实时交通或最新游客评价。',
    };
  }

  private needsClarification(text: string): boolean {
    const hasUnknownPlace = /(xxx|未知|不清楚|不知道|随便哪里)/i.test(text);
    const hasObviousCrossCity =
      (text.includes('北京') && text.includes('上海')) ||
      (text.includes('广州') && text.includes('深圳'));
    const hasCurrentPlace = /(到(了|达)|目前在|现在在|当前|我在).{0,24}/.test(text);
    const hasTwoOptions = /(或|还是|、)/.test(text);

    return hasUnknownPlace || hasObviousCrossCity || !hasCurrentPlace || !hasTwoOptions;
  }
}
