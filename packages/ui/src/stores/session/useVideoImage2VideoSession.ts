import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import type {
  VideoResult,
  VideoTask,
  PromptAssetBinding,
  PromptSessionOrigin,
} from '@prompt-optimizer/core'

export type VideoTestVariantId = 'a' | 'b' | 'c' | 'd'
export type VideoTestColumnCount = 2 | 3 | 4
export type VideoTestPanelVersionValue = 'workspace' | 'previous' | 0 | number

export interface VideoTestVariantConfig {
  id: VideoTestVariantId
  version: VideoTestPanelVersionValue
  modelKey: string
  duration?: number
  aspectRatio?: string
  motionStrength?: number
}

export interface VideoImage2VideoSessionState {
  originalPrompt: string
  optimizedPrompt: string
  reasoning: string
  chainId: string
  versionId: string

  inputImageB64: string | null
  inputImageMime: string | null
  endImageB64: string | null
  endImageMime: string | null

  selectedTextModelKey: string
  selectedTemplateId: string
  selectedIterateTemplateId: string

  mainSplitLeftPct: number
  testColumnCount: VideoTestColumnCount

  variants: Record<VideoTestVariantId, VideoTestVariantConfig>
  variantResults: Record<VideoTestVariantId, VideoResult | null>
  variantTasks: Record<VideoTestVariantId, VideoTask | null>

  origin: PromptSessionOrigin
  assetBinding: PromptAssetBinding
  lastActiveAt?: number
}

const DEFAULT_VARIANTS: Record<VideoTestVariantId, VideoTestVariantConfig> = {
  a: { id: 'a', version: 'workspace', modelKey: '', duration: 5, aspectRatio: '16:9' },
  b: { id: 'b', version: 0, modelKey: '', duration: 5, aspectRatio: '16:9' },
  c: { id: 'c', version: 'workspace', modelKey: '', duration: 5, aspectRatio: '16:9' },
  d: { id: 'd', version: 'workspace', modelKey: '', duration: 5, aspectRatio: '16:9' },
}

export const useVideoImage2VideoSession = defineStore('session-video-image2video', () => {
  const originalPrompt = ref('')
  const optimizedPrompt = ref('')
  const reasoning = ref('')
  const chainId = ref('')
  const versionId = ref('')

  const inputImageB64 = ref<string | null>(null)
  const inputImageId = ref<string | null>(null)
  const inputImageMime = ref<string | null>(null)
  const endImageB64 = ref<string | null>(null)
  const endImageMime = ref<string | null>(null)

  const selectedTextModelKey = ref('')
  const selectedTemplateId = ref('image2video-general-optimize')
  const selectedIterateTemplateId = ref('video-iterate-general')

  const mainSplitLeftPct = ref(38)
  const testColumnCount = ref<VideoTestColumnCount>(2)
  const lastActiveAt = ref(Date.now())

  const layout = computed(() => ({
    mainSplitLeftPct: mainSplitLeftPct.value,
    testColumnCount: testColumnCount.value,
  }))

  const variants = ref<Record<VideoTestVariantId, VideoTestVariantConfig>>({ ...DEFAULT_VARIANTS })
  const variantResults = ref<Record<VideoTestVariantId, VideoResult | null>>({
    a: null,
    b: null,
    c: null,
    d: null,
  })
  const variantTasks = ref<Record<VideoTestVariantId, VideoTask | null>>({
    a: null,
    b: null,
    c: null,
    d: null,
  })

  const origin = ref<PromptSessionOrigin>({ kind: 'blank' })
  const assetBinding = ref<PromptAssetBinding>({ assetId: '' })

  const clearContent = () => {
    originalPrompt.value = ''
    optimizedPrompt.value = ''
    reasoning.value = ''
    inputImageB64.value = null
    inputImageId.value = null
    inputImageMime.value = null
    endImageB64.value = null
    endImageMime.value = null
    variantResults.value = { a: null, b: null, c: null, d: null }
    variantTasks.value = { a: null, b: null, c: null, d: null }
    lastActiveAt.value = Date.now()
  }

  const saveSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) return

    let imageIdToSave = inputImageId.value
    if (inputImageB64.value && $services.imageStorageService) {
      if (!imageIdToSave) {
        try {
          const id = `img_v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          const raw = inputImageB64.value.startsWith('data:')
            ? inputImageB64.value.split(',')[1]
            : inputImageB64.value
          await $services.imageStorageService.saveImage({
            metadata: {
              id,
              mimeType: inputImageMime.value || 'image/png',
              sizeBytes: Math.floor(raw.length * 0.75),
              createdAt: Date.now(),
              accessedAt: Date.now(),
              source: 'uploaded',
            },
            data: raw,
          })
          imageIdToSave = id
          inputImageId.value = id
        } catch (e) {
          console.warn('[VideoSession] Failed to persist input image to storage:', e)
        }
      }
    }

    const snapshot = {
      originalPrompt: originalPrompt.value,
      optimizedPrompt: optimizedPrompt.value,
      reasoning: reasoning.value,
      chainId: chainId.value,
      versionId: versionId.value,
      inputImageId: imageIdToSave,
      inputImageMime: inputImageMime.value,
      endImageMime: endImageMime.value,
      selectedTextModelKey: selectedTextModelKey.value,
      selectedTemplateId: selectedTemplateId.value,
      selectedIterateTemplateId: selectedIterateTemplateId.value,
      mainSplitLeftPct: mainSplitLeftPct.value,
      testColumnCount: testColumnCount.value,
      variants: variants.value,
      variantResults: variantResults.value,
      origin: origin.value,
      assetBinding: assetBinding.value,
      lastActiveAt: Date.now(),
    }
    await $services.preferenceService.set('session/v1/video-image2video', JSON.stringify(snapshot))
  }

  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) return
    const raw = await $services.preferenceService.get<string | null>('session/v1/video-image2video', null)
    if (!raw) return
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (data) {
        if (data.originalPrompt !== undefined) originalPrompt.value = data.originalPrompt
        if (data.optimizedPrompt !== undefined) optimizedPrompt.value = data.optimizedPrompt
        if (data.reasoning !== undefined) reasoning.value = data.reasoning
        if (data.chainId !== undefined) chainId.value = data.chainId
        if (data.versionId !== undefined) versionId.value = data.versionId
        if (data.inputImageId) {
          inputImageId.value = data.inputImageId
          if ($services.imageStorageService) {
            try {
              const fullImg = await $services.imageStorageService.getImage(data.inputImageId)
              if (fullImg) {
                inputImageB64.value = `data:${fullImg.metadata.mimeType || 'image/png'};base64,${fullImg.data}`
                inputImageMime.value = fullImg.metadata.mimeType || 'image/png'
              }
            } catch (e) {
              console.warn('[VideoSession] Failed to restore input image from storage:', e)
            }
          }
        } else if (data.inputImageB64) {
          inputImageB64.value = data.inputImageB64
          inputImageMime.value = data.inputImageMime || 'image/png'
        }
        if (data.endImageB64 !== undefined) endImageB64.value = data.endImageB64
        if (data.endImageMime !== undefined) endImageMime.value = data.endImageMime
        if (data.selectedTextModelKey !== undefined) selectedTextModelKey.value = data.selectedTextModelKey
        if (data.selectedTemplateId !== undefined) selectedTemplateId.value = data.selectedTemplateId
        if (data.selectedIterateTemplateId !== undefined) selectedIterateTemplateId.value = data.selectedIterateTemplateId
        if (data.mainSplitLeftPct !== undefined) mainSplitLeftPct.value = data.mainSplitLeftPct
        if (data.testColumnCount !== undefined) testColumnCount.value = data.testColumnCount
        if (data.variants) variants.value = data.variants
        if (data.variantResults) variantResults.value = data.variantResults
        if (data.origin) origin.value = data.origin
        if (data.assetBinding) assetBinding.value = data.assetBinding
        lastActiveAt.value = data.lastActiveAt || Date.now()
      }
    } catch {}
  }

  return {
    originalPrompt,
    optimizedPrompt,
    reasoning,
    chainId,
    versionId,
    inputImageB64,
    inputImageMime,
    endImageB64,
    endImageMime,
    selectedTextModelKey,
    selectedTemplateId,
    selectedIterateTemplateId,
    mainSplitLeftPct,
    testColumnCount,
    layout,
    lastActiveAt,
    variants,
    variantResults,
    variantTasks,
    origin,
    assetBinding,
    clearContent,
    saveSession,
    restoreSession,
  }
})

export type VideoImage2VideoSessionApi = ReturnType<typeof useVideoImage2VideoSession>
