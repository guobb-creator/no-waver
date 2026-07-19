'use client';

import { useState } from 'react';
import { DecisionForm } from '@/components/DecisionForm';
import { DecisionResponse } from '@/components/DecisionResponse';
import { MAX_INPUT_CHARS } from '@/lib/app-config';

const defaultQuestion =
  '我上午已经到了目的地 A，下午想去目的地 B 或目的地 C。请从交通便利度和游客评价两个方面帮我比较，并建议我去哪里。';

type PageStatus = 'idle' | 'loading' | 'success' | 'needs_clarification' | 'error';

type DecisionApiResponse = {
  status: Exclude<PageStatus, 'idle' | 'loading'>;
  message: string;
  maxInputChars: number;
};

export default function Home() {
  const [question, setQuestion] = useState(defaultQuestion);
  const [status, setStatus] = useState<PageStatus>('idle');
  const [message, setMessage] = useState('');
  const [maxInputChars, setMaxInputChars] = useState(MAX_INPUT_CHARS);

  async function submitDecision() {
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = (await response.json()) as DecisionApiResponse;

      if (typeof data.maxInputChars === 'number') setMaxInputChars(data.maxInputChars);
      if (!response.ok || data.status === 'error') {
        setStatus('error');
        setMessage(data.message || '暂时无法生成建议，请稍后重试。');
        return;
      }

      setStatus(data.status);
      setMessage(data.message);
    } catch {
      setStatus('error');
      setMessage('网络连接异常，请检查网络后重试。');
    }
  }

  return (
    <main className="page-shell">
      <section className="hero" aria-labelledby="page-title">
        <div className="brand-row">
          <h1 id="page-title">不再摇摆</h1>
          <p className="tagline">你的快速决策助手</p>
        </div>
        <nav className="category-tabs" aria-label="决策分类">
          <button className="category-tab" type="button">日常</button>
          <button className="category-tab category-tab--active" type="button" aria-current="page">旅行</button>
        </nav>
        <p className="intro">说说你想去哪里，我帮你做决定。</p>
      </section>

      <DecisionForm
        value={question}
        maxInputChars={maxInputChars}
        isLoading={status === 'loading'}
        onChange={setQuestion}
        onSubmit={submitDecision}
      />

      {status === 'loading' && <p className="loading" aria-live="polite">正在查询路线并生成建议，请稍候…</p>}
      {(status === 'success' || status === 'needs_clarification' || status === 'error') && (
        <DecisionResponse kind={status} message={message} />
      )}
    </main>
  );
}
