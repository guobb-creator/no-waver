import { NextResponse } from 'next/server';
import { getDecisionModelClient } from '@/lib/decision-model/client-factory';
import { getMapRoutingClient } from '@/lib/map-routing/client-factory';
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

  try {
    const places = await client.extractPlaces(validation.question);
    if (places.status === 'needs_clarification') {
      return NextResponse.json({ ...places, maxInputChars: client.maxInputChars });
    }

    const routeResult = await mapClient.planCandidateRoutes({
      originName: places.origin,
      candidateNames: places.candidates,
      cityHint: places.cityHint,
    });

    if (routeResult.status === 'needs_clarification') {
      return NextResponse.json({ ...routeResult, maxInputChars: client.maxInputChars });
    }

    const result =
      routeResult.status === 'success'
        ? await client.decideWithRoutes(validation.question, routeResult.summary)
        : await client.decideWithoutMapData(validation.question, routeResult.message);

    return NextResponse.json({ ...result, maxInputChars: client.maxInputChars });
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
