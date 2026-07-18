export type ValidationResult =
  | { valid: true; question: string }
  | { valid: false; message: string };

export function validateQuestion(value: unknown, maxInputChars: number): ValidationResult {
  if (typeof value !== 'string') {
    return { valid: false, message: '请输入一段旅行决策描述。' };
  }

  const question = value.trim();
  if (!question) {
    return { valid: false, message: '请输入一段旅行决策描述。' };
  }

  if (question.length > maxInputChars) {
    return {
      valid: false,
      message: `输入内容过长，请控制在 ${maxInputChars} 个字符以内。`,
    };
  }

  return { valid: true, question };
}
