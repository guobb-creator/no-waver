import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DecisionForm } from '@/components/DecisionForm';
import { DecisionResponse } from '@/components/DecisionResponse';

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
});
