export type NormalizedFavoriteFunctionMode = 'basic' | 'context' | 'image' | 'video'

export const normalizeFavoriteFunctionMode = (mode: unknown): NormalizedFavoriteFunctionMode => {
  if (mode === 'image') return 'image'
  if (mode === 'context' || mode === 'pro') return 'context'
  if (mode === 'video') return 'video'
  return 'basic'
}
