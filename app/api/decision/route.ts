import { NextResponse } from 'next/server';
import { getDecisionModelClient } from '@/lib/decision-model/client-factory';
import { getMapRoutingClient } from '@/lib/map-routing/client-factory';
import { validateExtractedPlaces, validateQuestionPlaceholders } from '@/lib/place-sanity';
import { buildTrafficSummary } from '@/lib/traffic-summary/build-traffic-summary';
import { validateQuestion } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const client = getDecisionModelClient();
  const mapClient = getMapRoutingClient();
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        message: '请求内容无效，请检查输入后重试。',
        maxInputChars: client.maxInputChars,
      },
      { status: 400 },
    );
  }

  const question = typeof body === 'object' && body !== null ? (body as { question?: unknown }).question : undefined;
  const validation = validateQuestion(question, client.maxInputChars);
  if (!validation.valid) {
    return NextResponse.json(
      { status: 'error', message: validation.message, maxInputChars: client.maxInputChars },
      { status: 400 },
    );
  }

  const questionSanity = validateQuestionPlaceholders(validation.question);
  if (!questionSanity.valid) {
    return NextResponse.json({
      status: 'needs_clarification',
      message: questionSanity.message,
      maxInputChars: client.maxInputChars,
    });
  }

  try {
    const places = await client.extractPlaces(validation.question);
    if (places.status === 'needs_clarification') {
      return NextResponse.json({ ...places, maxInputChars: client.maxInputChars });
    }

    const placeSanity = validateExtractedPlaces(places);
    if (!placeSanity.valid) {
      return NextResponse.json({
        status: 'needs_clarification',
        message: placeSanity.message,
        maxInputChars: client.maxInputChars,
      });
    }

    const routeResult = await mapClient.planCandidateRoutes({
      originName: places.origin,
      candidateNames: places.candidates,
      cityHint: places.cityHint,
    });

    if (routeResult.status === 'needs_clarification') {
      return NextResponse.json({ ...routeResult, maxInputChars: client.maxInputChars });
    }

    if (routeResult.status === 'success') {
      const trafficSummary = buildTrafficSummary(routeResult.summary);
      if (!trafficSummary) {
        return NextResponse.json({
          status: 'needs_clarification',
          message: '有一个目的地暂时无法获取可靠的地图导航路线。请核实地点名称是否有误，或补充城市/区域后再试。',
          maxInputChars: client.maxInputChars,
        });
      }

      const result = await client.decideWithRoutes(validation.question, routeResult.summary);
      return NextResponse.json({
        ...result,
        trafficSummary,
        maxInputChars: client.maxInputChars,
      });
    }

    return NextResponse.json({
      status: 'needs_clarification',
      message: `${routeResult.message} 请核实地点名称是否有误，或补充城市/区域后再试。`,
      maxInputChars: client.maxInputChars,
    });
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        message: '暂时无法生成建议，请稍后重试。',
        maxInputChars: client.maxInputChars,
      },
      { status: 503 },
    );
  }
}
