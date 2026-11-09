export const VISUAL_COACH_PREFIX = "Quick coaching note:"

export function isVisualCoachingMessage(text: string) {
  return text.trimStart().toLowerCase().startsWith(VISUAL_COACH_PREFIX.toLowerCase())
}
