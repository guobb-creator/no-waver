import { MAX_INPUT_CHARS } from '@/lib/app-config';
import type { RouteSummary } from '@/lib/map-routing/types';
import type { DecisionModelClient, DecisionResult, ExtractedTripPlaces } from './types';

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

  async decideDaily(question: string): Promise<DecisionResult> {
    const text = question.trim();

    if (needsDailySafetyClarification(text)) {
      return {
        status: 'needs_clarification',
        message: '这个选择可能涉及健康、法律、财务或人身安全等高风险后果，我不能直接替你做决定。请先咨询专业人士，或把问题改成低风险的日常小选择。',
      };
    }

    if (needsDailyDetailClarification(text)) {
      return {
        status: 'needs_clarification',
        message: '请补充你在纠结的两个选项，以及最在意的因素，比如时间、预算、精力、心情或风险。',
      };
    }

    return {
      status: 'success',
      message: [
        '我先帮你把选择拆开看：',
        '选项一的优点通常是更可控、更贴近当前状态；缺点是可能需要投入更多精力或时间。',
        '选项二的优点通常是更省心、更快得到结果；缺点是成本、体验或后续影响可能没那么理想。',
        '',
        '我的建议：如果你现在最想降低负担，就选更省心的那个；如果你还能承受一点投入，并且长期收益更明显，就选更可控的那个。这个演示回复用于验证日常决策流程。',
      ].join('\n'),
    };
  }

  async extractPlaces(question: string): Promise<ExtractedTripPlaces> {
    const text = question.trim();
    if (this.needsClarification(text)) {
      return { status: 'needs_clarification', message: clarificationMessage };
    }

    const places = extractMockPlaces(text);
    if (!places) {
      return { status: 'needs_clarification', message: clarificationMessage };
    }

    return places;
  }

  async decideWithRoutes(_question: string, routeSummary: RouteSummary): Promise<DecisionResult> {
    return {
      status: 'success',
      message: [
        `${routeSummary.candidates[0].destinationName} 的优点是路程更短、下午安排更轻松；缺点是景点体验可能没那么完整。`,
        `${routeSummary.candidates[1].destinationName} 的优点是游客评价和经典程度通常更强；缺点是路上时间更长，返程压力更大。`,
        '',
        `我的建议：如果你今天下午想稳一点、少折腾，优先选 ${routeSummary.candidates[0].destinationName}；如果你更看重经典体验且不介意多花路上时间，可以选 ${routeSummary.candidates[1].destinationName}。`,
      ].join('\n'),
    };
  }

  async decideWithoutMapData(question: string, unavailableReason: string): Promise<DecisionResult> {
    const fallback = await this.decide(question);
    if (fallback.status === 'needs_clarification') return fallback;

    return {
      status: 'success',
      message: [
        `我暂时没有获取到地图导航数据：${unavailableReason}`,
        '下面只能基于常识和模型已有知识给出非实时建议。',
        '',
        fallback.message,
      ].join('\n'),
    };
  }

  private needsClarification(text: string): boolean {
    const hasUnknownPlace = /(xxx|未知|不清楚|不知道|随便哪里|目的地\s*[ABCＡＢＣ]|地点\s*[ABCＡＢＣ])/i.test(text);
    const hasObviousCrossCity =
      (text.includes('北京') && text.includes('上海')) ||
      (text.includes('广州') && text.includes('深圳'));
    const hasCurrentPlace = /(到(了|达)|目前在|现在在|当前|我在).{0,24}/.test(text);
    const hasTwoOptions = /(或|还是|、)/.test(text);

    return hasUnknownPlace || hasObviousCrossCity || !hasCurrentPlace || !hasTwoOptions;
  }
}

function needsDailySafetyClarification(text: string): boolean {
  return /(自杀|自残|伤害|打架|报警|诊断|用药|停药|手术|怀孕|股票|基金|投资|贷款|借钱|全部积蓄|离婚诉讼|起诉|违法|犯罪)/.test(
    text,
  );
}

function needsDailyDetailClarification(text: string): boolean {
  const hasChoiceSignal = /(还是|或|或者|纠结|选|选择|要不要|该不该)/.test(text);
  const hasContextSignal = /(因为|想|但|不过|担心|预算|时间|精力|心情|风险|明天|今天|今晚|周末|累|钱|贵|便宜)/.test(
    text,
  );

  return text.length < 12 || !hasChoiceSignal || !hasContextSignal;
}

function extractMockPlaces(text: string): ExtractedTripPlaces | null {
  const cityHint = ['杭州', '北京', '上海', '广州', '深圳', '南京', '苏州', '成都', '重庆', '西安'].find((city) =>
    text.includes(city),
  );

  const arrivedMatch = text.match(/(?:已经|上午)?(?:到(?:了|达)|目前在|现在在|当前在|我在)([^，。；,.、]{2,20})/);
  const optionsMatch = text.match(/(?:下午)?(?:想)?去([^，。；,.、]{2,20}?)(?:或|还是)([^，。；,.、]{2,20})/);

  if (arrivedMatch?.[1] && optionsMatch?.[1] && optionsMatch?.[2]) {
    return {
      status: 'success',
      origin: cleanPlace(arrivedMatch[1]),
      candidates: [cleanPlace(optionsMatch[1]), cleanPlace(optionsMatch[2])],
      cityHint,
    };
  }

  return null;
}

function cleanPlace(value: string): string {
  return value.replace(/^(目的地|景点)/, '').replace(/(，|。|；).*$/, '').trim();
}
