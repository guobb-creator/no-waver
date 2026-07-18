'use client';

import type { FormEvent } from 'react';

type DecisionFormProps = {
  value: string;
  maxInputChars: number;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function DecisionForm({
  value,
  maxInputChars,
  isLoading,
  onChange,
  onSubmit,
}: DecisionFormProps) {
  const trimmed = value.trim();
  const isTooLong = value.length > maxInputChars;
  const isDisabled = isLoading || !trimmed || isTooLong;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDisabled) onSubmit();
  }

  return (
    <form className="decision-form" onSubmit={handleSubmit}>
      <label htmlFor="question">告诉我你的旅行选择</label>
      <textarea
        id="question"
        name="question"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={isLoading}
        maxLength={maxInputChars + 1}
        rows={8}
        aria-describedby="input-help input-count"
      />
      <p id="input-help" className="input-help">
        请说明你上午所在的地点，以及下午想去的两个候选目的地。可补充出发时间、交通方式或关注点。
      </p>
      <div className="form-footer">
        <p id="input-count" className={isTooLong ? 'input-count input-count--error' : 'input-count'}>
          {value.length} / {maxInputChars} 字
        </p>
        <button type="submit" disabled={isDisabled}>
          {isLoading ? '正在分析…' : '帮我做决定'}
        </button>
      </div>
      {isTooLong && <p className="inline-error">输入内容过长，请缩短后再提交。</p>}
    </form>
  );
}
