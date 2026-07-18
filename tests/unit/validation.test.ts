import { describe, expect, it } from 'vitest';
import { validateQuestion } from '@/lib/validation';

describe('validateQuestion', () => {
  it('rejects blank and non-string questions', () => {
    expect(validateQuestion('   ', 10)).toEqual({ valid: false, message: '请输入一段旅行决策描述。' });
    expect(validateQuestion(null, 10)).toEqual({ valid: false, message: '请输入一段旅行决策描述。' });
  });

  it('trims valid questions', () => {
    expect(validateQuestion('  我在西湖，去灵隐寺或岳庙  ', 100)).toEqual({
      valid: true,
      question: '我在西湖，去灵隐寺或岳庙',
    });
  });

  it('rejects input beyond the configured maximum', () => {
    expect(validateQuestion('超过', 1)).toEqual({
      valid: false,
      message: '输入内容过长，请控制在 1 个字符以内。',
    });
  });
});
