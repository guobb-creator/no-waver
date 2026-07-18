import { NextResponse } from 'next/server';
import { getDecisionModelClient } from '@/lib/decision-model/client-factory';
import { validateQuestion } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const client = getDecisionModelClient();
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
    const result = await client.decide(validation.question);
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
