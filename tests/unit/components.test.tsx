import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DecisionForm } from '@/components/DecisionForm';
import { DecisionResponse } from '@/components/DecisionResponse';
import { TrafficSummaryCard } from '@/components/TrafficSummaryCard';
import type { TrafficSummary } from '@/lib/traffic-summary/types';

describe('decision components', () => {
  it('renders model content as text', () => {
    render(<DecisionResponse kind="success" message={'第一行\n第二行'} />);

    expect(screen.getByText((_, element) => element?.textContent === '第一行\n第二行')).toBeInTheDocument();
  });

  it('prevents submitting blank content', () => {
    const onSubmit = vi.fn();
    render(
      <DecisionForm
        title="说说你在纠结什么，我帮你做决定。"
        helpText="请补充你在意的因素。"
        value="   "
        maxInputChars={20}
        isLoading={false}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('button', { name: '帮我做决定' })).toBeDisabled();
  });

  it('notifies the owner when the input changes', () => {
    const onChange = vi.fn();
    render(
      <DecisionForm
        title="说说你想去哪里，我帮你做决定。"
        helpText="请说明你所在的地点/出发的地点及想去的目的地。"
        value="我在西湖，去灵隐寺或岳庙"
        maxInputChars={30}
        isLoading={false}
        onChange={onChange}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.input(screen.getByRole('textbox', { name: '说说你想去哪里，我帮你做决定。' }), {
      target: { value: '新的旅行问题' },
    });
    expect(onChange).toHaveBeenCalledWith('新的旅行问题');
  });

  it('renders dynamic title and help text', () => {
    render(
      <DecisionForm
        title="说说你在纠结什么，我帮你做决定。"
        helpText="请说明你的选项、当前状态和主要关注点。"
        value="今晚做饭还是点外卖"
        maxInputChars={100}
        isLoading={false}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('textbox', { name: '说说你在纠结什么，我帮你做决定。' })).toBeInTheDocument();
    expect(screen.getByText('请说明你的选项、当前状态和主要关注点。')).toBeInTheDocument();
  });

  it('renders trusted traffic summary cards and Amap verification links', () => {
    render(<TrafficSummaryCard summary={trafficSummary} />);

    expect(screen.getByRole('heading', { name: '交通对比' })).toBeInTheDocument();
    expect(screen.getByText('数据来源：高德地图路线数据 · 刚刚查询')).toBeInTheDocument();
    expect(screen.getByText('7路')).toBeInTheDocument();
    expect(screen.getByText('交通判断：灵隐寺明显更方便')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '高德查看' })).toHaveLength(3);
    expect(screen.getAllByRole('link', { name: '高德查看' })[0]).toHaveAttribute(
      'href',
      expect.stringContaining('uri.amap.com/navigation'),
    );
  });
});

const trafficSummary: TrafficSummary = {
  source: '高德地图路线数据',
  queriedAtText: '刚刚查询',
  origin: { name: '西湖', resolvedName: '杭州西湖', location: '120.141,30.259' },
  candidates: [
    {
      id: 'candidate-0',
      name: '灵隐寺',
      resolvedName: '灵隐寺',
      location: '120.100,30.240',
      routes: [
        {
          mode: 'transit',
          label: '公交/地铁',
          durationMinutes: 25,
          durationText: '约 25 分钟',
          lineNames: ['7路'],
          lineNamesText: '7路',
          verificationUrl: 'https://uri.amap.com/navigation?mode=bus',
        },
        {
          mode: 'driving',
          label: '驾车/打车',
          durationMinutes: 12,
          durationText: '约 12 分钟',
          verificationUrl: 'https://uri.amap.com/navigation?mode=car',
        },
      ],
    },
    {
      id: 'candidate-1',
      name: '岳王庙',
      resolvedName: '岳王庙',
      location: '120.140,30.253',
      routes: [
        {
          mode: 'transit',
          label: '公交/地铁',
          durationMinutes: 45,
          durationText: '约 45 分钟',
          verificationUrl: 'https://uri.amap.com/navigation?mode=bus',
        },
      ],
    },
  ],
  trafficInsight: {
    type: 'obvious',
    title: '灵隐寺明显更方便',
    reasons: ['公交/地铁去灵隐寺少 20 分钟'],
  },
  notice: '交通数据来自高德地图路线数据；AI 只基于这些路线数据比较交通。实际导航以高德为准。',
};
