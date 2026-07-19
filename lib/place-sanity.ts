import type { ExtractedTripPlaces } from '@/lib/decision-model/types';

export const placeholderPlaceMessage =
  '你输入里还包含“目的地 A / 目的地 B / 目的地 C”这类示例占位符，我没法把它们当作真实地点查询路线。请把 A、B、C 改成真实地点名，最好补充城市或区域，例如“杭州西湖、灵隐寺、岳王庙”。';

const placeholderPatterns = [
  /^目的地\s*[ABCＡＢＣ]$/i,
  /^地点\s*[ABCＡＢＣ]$/i,
  /^景点\s*[ABCＡＢＣ]$/i,
  /^[ABCＡＢＣ]$/,
  /^候选(?:目的地|地点)?\s*[ABCＡＢＣ]$/i,
];

export function validateExtractedPlaces(
  places: ExtractedTripPlaces,
): { valid: true } | { valid: false; message: string } {
  if (places.status === 'needs_clarification') return { valid: false, message: places.message };

  const allPlaces = [places.origin, ...places.candidates];
  if (allPlaces.some(isPlaceholderPlace)) {
    return { valid: false, message: placeholderPlaceMessage };
  }

  return { valid: true };
}

export function validateQuestionPlaceholders(question: string): { valid: true } | { valid: false; message: string } {
  if (containsPlaceholderPlaces(question)) {
    return { valid: false, message: placeholderPlaceMessage };
  }

  return { valid: true };
}

export function isPlaceholderPlace(place: string): boolean {
  const normalized = place
    .trim()
    .replace(/[“”"'`]/g, '')
    .replace(/\s+/g, ' ');

  return placeholderPatterns.some((pattern) => pattern.test(normalized));
}

function containsPlaceholderPlaces(question: string): boolean {
  return /(目的地|地点|景点)\s*[ABCＡＢＣ]/i.test(question);
}
