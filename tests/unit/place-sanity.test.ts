import { describe, expect, it } from 'vitest';
import { isPlaceholderPlace, validateExtractedPlaces, validateQuestionPlaceholders } from '@/lib/place-sanity';

describe('place sanity validation', () => {
  it('recognizes placeholder place names from the default example', () => {
    expect(isPlaceholderPlace('目的地 A')).toBe(true);
    expect(isPlaceholderPlace('目的地B')).toBe(true);
    expect(isPlaceholderPlace('地点 C')).toBe(true);
  });

  it('allows real place names', () => {
    expect(isPlaceholderPlace('杭州西湖')).toBe(false);
    expect(isPlaceholderPlace('灵隐寺')).toBe(false);
  });

  it('rejects extracted placeholder places before map routing', () => {
    const result = validateExtractedPlaces({
      status: 'success',
      origin: '目的地 A',
      candidates: ['目的地 B', '目的地 C'],
    });

    expect(result).toEqual({
      valid: false,
      message:
        '你输入里还包含“目的地 A / 目的地 B / 目的地 C”这类示例占位符，我没法把它们当作真实地点查询路线。请把 A、B、C 改成真实地点名，最好补充城市或区域，例如“杭州西湖、灵隐寺、岳王庙”。',
    });
  });

  it('rejects raw questions that still contain default placeholder places', () => {
    const result = validateQuestionPlaceholders(
      '我上午已经到了目的地 A，下午想去目的地 B 或目的地 C。请帮我比较。',
    );

    expect(result.valid).toBe(false);
  });
});
