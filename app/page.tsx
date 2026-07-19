'use client';

import { useState } from 'react';
import { DecisionForm } from '@/components/DecisionForm';
import { DecisionResponse } from '@/components/DecisionResponse';
import { MAX_INPUT_CHARS } from '@/lib/app-config';

type DecisionCategory = 'daily' | 'travel';

type PageStatus = 'idle' | 'loading' | 'success' | 'needs_clarification' | 'error';

type CategoryConfig = {
  label: string;
  title: string;
  helpText: string;
  defaultQuestion: string;
  endpoint: string;
  loadingText: string;
};

type CategoryState = {
  question: string;
  status: PageStatus;
  message: string;
};

const categoryConfigs = {
  daily: {
    label: '日常',
    title: '说说你在纠结什么，我帮你做决定。',
    helpText: '请说明你的选项、当前状态和主要关注点，例如时间、预算、精力、心情或风险。',
    defaultQuestion: '我今晚纠结是自己做饭还是点外卖，想省钱但也不想太累，明天还要早起。请帮我比较并建议我怎么选。',
    endpoint: '/api/daily-decision',
    loadingText: '正在整理你的选择，请稍候…',
  },
  travel: {
    label: '旅行',
    title: '说说你想去哪里，我帮你做决定。',
    helpText: '请说明你所在的地点/出发的地点及想去的目的地，可补充出发时间、交通方式等关注点。',
    defaultQuestion:
      '我上午已经到了目的地 A，下午想去目的地 B 或目的地 C。请从交通便利度和游客评价两个方面帮我比较，并建议我去哪里。',
    endpoint: '/api/decision',
    loadingText: '正在查询路线并生成建议，请稍候…',
  },
} satisfies Record<DecisionCategory, CategoryConfig>;

const categoryOrder: DecisionCategory[] = ['daily', 'travel'];

function createInitialCategoryState(): Record<DecisionCategory, CategoryState> {
  return {
    daily: {
      question: categoryConfigs.daily.defaultQuestion,
      status: 'idle',
      message: '',
    },
    travel: {
      question: categoryConfigs.travel.defaultQuestion,
      status: 'idle',
      message: '',
    },
  };
}

type DecisionApiResponse = {
  status: Exclude<PageStatus, 'idle' | 'loading'>;
  message: string;
  maxInputChars: number;
};

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<DecisionCategory>('travel');
  const [categoryStates, setCategoryStates] = useState(createInitialCategoryState);
  const [maxInputChars, setMaxInputChars] = useState(MAX_INPUT_CHARS);
  const activeConfig = categoryConfigs[activeCategory];
  const activeState = categoryStates[activeCategory];

  function updateCategoryState(category: DecisionCategory, patch: Partial<CategoryState>) {
    setCategoryStates((current) => ({
      ...current,
      [category]: {
        ...current[category],
        ...patch,
      },
    }));
  }

  async function submitDecision() {
    const submittedCategory = activeCategory;
    const submittedConfig = categoryConfigs[submittedCategory];
    const submittedQuestion = categoryStates[submittedCategory].question;

    updateCategoryState(submittedCategory, { status: 'loading', message: '' });

    try {
      const response = await fetch(submittedConfig.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: submittedQuestion }),
      });
      const data = (await response.json()) as DecisionApiResponse;

      if (typeof data.maxInputChars === 'number') setMaxInputChars(data.maxInputChars);
      if (!response.ok || data.status === 'error') {
        updateCategoryState(submittedCategory, {
          status: 'error',
          message: data.message || '暂时无法生成建议，请稍后重试。',
        });
        return;
      }

      updateCategoryState(submittedCategory, { status: data.status, message: data.message });
    } catch {
      updateCategoryState(submittedCategory, { status: 'error', message: '网络连接异常，请检查网络后重试。' });
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
          {categoryOrder.map((category) => {
            const isActive = category === activeCategory;
            return (
              <button
                key={category}
                className={isActive ? 'category-tab category-tab--active' : 'category-tab'}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveCategory(category)}
              >
                {categoryConfigs[category].label}
              </button>
            );
          })}
        </nav>
      </section>

      <DecisionForm
        title={activeConfig.title}
        helpText={activeConfig.helpText}
        value={activeState.question}
        maxInputChars={maxInputChars}
        isLoading={activeState.status === 'loading'}
        onChange={(question) => updateCategoryState(activeCategory, { question })}
        onSubmit={submitDecision}
      />

      {activeState.status === 'loading' && <p className="loading" aria-live="polite">{activeConfig.loadingText}</p>}
      {(activeState.status === 'success' ||
        activeState.status === 'needs_clarification' ||
        activeState.status === 'error') && (
        <DecisionResponse kind={activeState.status} message={activeState.message} />
      )}
    </main>
  );
}
