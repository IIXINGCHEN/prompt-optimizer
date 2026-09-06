import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import {
  VIDEO_IMAGE2VIDEO_SESSION_KEY,
  computeStableImageId,
  scheduleImageStorageGc,
  queueImageStorageMaintenance,
} from './imageStorageMaintenance'
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
  inputImageId: string | null
  inputImageMime: string | null
  endImageB64: string | null
  endImageId: string | null
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

const sanitizeVariantResultsForSnapshot = (
  results: Record<VideoTestVariantId, VideoResult | null>
): Record<VideoTestVariantId, VideoResult | null> => {
  const clean: Record<VideoTestVariantId, VideoResult | null> = {
    a: null,
    b: null,
    c: null,
    d: null,
  }
  for (const key of ['a', 'b', 'c', 'd'] as VideoTestVariantId[]) {
    const item = results[key]
    if (!item) {
      clean[key] = null
      continue
    }
    let videoUrl = item.video?.url
    if (videoUrl && videoUrl.startsWith('data:')) {
      videoUrl = ''
    }
    let coverUrl = item.video?.coverImageUrl
    if (coverUrl && coverUrl.startsWith('data:')) {
      coverUrl = ''
    }
    clean[key] = {
      ...item,
      video: {
        ...item.video,
        url: videoUrl,
        coverImageUrl: coverUrl,
      },
    }
  }
  return clean
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
  const endImageId = ref<string | null>(null)
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
    endImageId.value = null
    endImageMime.value = null
    variantResults.value = { a: null, b: null, c: null, d: null }
    variantTasks.value = { a: null, b: null, c: null, d: null }
    lastActiveAt.value = Date.now()
  }

  const saveSession = async () => {
    return await queueImageStorageMaintenance(async () => {
      const $services = getPiniaServices()
      if (!$services?.preferenceService) return

      let imageIdToSave: string | null = null
      if (inputImageB64.value && $services.imageStorageService) {
        try {
          const normalizedMime = inputImageMime.value || 'image/png'
          const raw = inputImageB64.value.startsWith('data:')
            ? inputImageB64.value.split(',')[1]
            : inputImageB64.value
          const stableId = await computeStableImageId(raw, normalizedMime)
          const existing = await $services.imageStorageService.getMetadata(stableId)
          if (!existing) {
            await $services.imageStorageService.saveImage({
              metadata: {
                id: stableId,
                mimeType: normalizedMime,
                sizeBytes: Math.floor(raw.length * 0.75),
                createdAt: Date.now(),
                accessedAt: Date.now(),
                source: 'uploaded',
              },
              data: raw,
            })
          }
          imageIdToSave = stableId
          inputImageId.value = stableId
        } catch (e) {
          console.warn('[VideoSession] Failed to persist input image to storage:', e)
          // 保留既有引用，避免快照引用被清空后 GC 误删仍存在的图像资产
          imageIdToSave = inputImageId.value
        }
      } else if (!inputImageB64.value) {
        inputImageId.value = null
      }

      let endImageIdToSave: string | null = null
      if (endImageB64.value && $services.imageStorageService) {
        try {
          const normalizedMime = endImageMime.value || 'image/png'
          const raw = endImageB64.value.startsWith('data:')
            ? endImageB64.value.split(',')[1]
            : endImageB64.value
          const stableId = await computeStableImageId(raw, normalizedMime)
          const existing = await $services.imageStorageService.getMetadata(stableId)
          if (!existing) {
            await $services.imageStorageService.saveImage({
              metadata: {
                id: stableId,
                mimeType: normalizedMime,
                sizeBytes: Math.floor(raw.length * 0.75),
                createdAt: Date.now(),
                accessedAt: Date.now(),
                source: 'uploaded',
              },
              data: raw,
            })
          }
          endImageIdToSave = stableId
          endImageId.value = stableId
        } catch (e) {
          console.warn('[VideoSession] Failed to persist end image to storage:', e)
          endImageIdToSave = endImageId.value
        }
      } else if (!endImageB64.value) {
        endImageId.value = null
      }

      const snapshot = {
        originalPrompt: originalPrompt.value,
        optimizedPrompt: optimizedPrompt.value,
        reasoning: reasoning.value,
        chainId: chainId.value,
        versionId: versionId.value,
        inputImageId: imageIdToSave,
        inputImageMime: inputImageMime.value,
        endImageId: endImageIdToSave,
        endImageMime: endImageMime.value,
        selectedTextModelKey: selectedTextModelKey.value,
        selectedTemplateId: selectedTemplateId.value,
        selectedIterateTemplateId: selectedIterateTemplateId.value,
        mainSplitLeftPct: mainSplitLeftPct.value,
        testColumnCount: testColumnCount.value,
        variants: variants.value,
        variantResults: sanitizeVariantResultsForSnapshot(variantResults.value),
        origin: origin.value,
        assetBinding: assetBinding.value,
        lastActiveAt: Date.now(),
      }

      try {
        await $services.preferenceService.set(VIDEO_IMAGE2VIDEO_SESSION_KEY, JSON.stringify(snapshot))
        if ($services.imageStorageService) {
          scheduleImageStorageGc($services.preferenceService, $services.imageStorageService)
        }
      } catch (e) {
        console.warn('[VideoSession] Failed to save session preference:', e)
      }
    })
  }

  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) return
    const raw = await $services.preferenceService.get<string | null>(VIDEO_IMAGE2VIDEO_SESSION_KEY, null)
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
        if (data.endImageId) {
          endImageId.value = data.endImageId
          if ($services.imageStorageService) {
            try {
              const fullImg = await $services.imageStorageService.getImage(data.endImageId)
              if (fullImg) {
                endImageB64.value = `data:${fullImg.metadata.mimeType || 'image/png'};base64,${fullImg.data}`
                endImageMime.value = fullImg.metadata.mimeType || 'image/png'
              }
            } catch (e) {
              console.warn('[VideoSession] Failed to restore end image from storage:', e)
            }
          }
        } else if (data.endImageB64) {
          endImageB64.value = data.endImageB64
          endImageMime.value = data.endImageMime || 'image/png'
        }
        if (data.selectedTextModelKey !== undefined) selectedTextModelKey.value = data.selectedTextModelKey
        if (data.selectedTemplateId !== undefined) selectedTemplateId.value = data.selectedTemplateId
        if (data.selectedIterateTemplateId !== undefined) selectedIterateTemplateId.value = data.selectedIterateTemplateId
        if (data.mainSplitLeftPct !== undefined) mainSplitLeftPct.value = data.mainSplitLeftPct
        // 逐列归一化 variants：部分/旧格式快照（如 {}）不能直接覆盖，
        // 否则模板里 session.variants['a'].modelKey 会因 undefined 崩掉整个工作区。
        // 逐列克隆，避免残留列与模块级 DEFAULT_VARIANTS 共享引用被 v-model 污染。
        if (data.variants && typeof data.variants === 'object' && !Array.isArray(data.variants)) {
          const restored = {} as Record<VideoTestVariantId, VideoTestVariantConfig>
          for (const id of ['a', 'b', 'c', 'd'] as VideoTestVariantId[]) {
            const v = (data.variants as Record<string, unknown>)[id]
            if (v && typeof v === 'object') {
              const r = v as Record<string, unknown>
              const version = r['version']
              restored[id] = {
                id,
                version:
                  version === 'workspace' || version === 'previous' || typeof version === 'number'
                    ? version
                    : DEFAULT_VARIANTS[id].version,
                modelKey: typeof r['modelKey'] === 'string' ? r['modelKey'] : '',
                duration: typeof r['duration'] === 'number' ? r['duration'] : DEFAULT_VARIANTS[id].duration,
                aspectRatio: typeof r['aspectRatio'] === 'string' ? r['aspectRatio'] : DEFAULT_VARIANTS[id].aspectRatio,
                ...(typeof r['motionStrength'] === 'number' ? { motionStrength: r['motionStrength'] as number } : {}),
              }
            } else {
              restored[id] = { ...DEFAULT_VARIANTS[id] }
            }
          }
          variants.value = restored
        }
        if (data.variantResults && typeof data.variantResults === 'object') {
          variantResults.value = { a: null, b: null, c: null, d: null, ...data.variantResults }
        }
        if (data.origin) origin.value = data.origin
        if (data.assetBinding) assetBinding.value = data.assetBinding
        // 列数只接受合法枚举，避免垃圾值破坏网格与单选组
        if ([2, 3, 4].includes(data.testColumnCount)) testColumnCount.value = data.testColumnCount
        lastActiveAt.value = data.lastActiveAt || Date.now()
      }
    } catch {}
  }

  const updateTextModel = (key: string) => {
    selectedTextModelKey.value = key || ''
    void saveSession()
  }

  // 收藏/历史外部应用所需的写入口（与图像模式 session 对齐）
  const updatePrompt = (prompt: string) => {
    originalPrompt.value = prompt || ''
    void saveSession()
  }

  const updateAssetBinding = (binding: PromptAssetBinding | undefined, originValue?: PromptSessionOrigin) => {
    assetBinding.value = binding || { assetId: '' }
    if (originValue) origin.value = originValue
    void saveSession()
  }

  const clearAssetBinding = () => {
    assetBinding.value = { assetId: '' }
    void saveSession()
  }

  const updateTemplate = (id: string | null) => {
    selectedTemplateId.value = id || ''
    void saveSession()
  }

  const updateIterateTemplate = (id: string | null) => {
    selectedIterateTemplateId.value = id || ''
    void saveSession()
  }

  const updateOptimizedResult = (result: {
    optimizedPrompt: string
    reasoning?: string
    chainId?: string
    versionId?: string
  }) => {
    optimizedPrompt.value = result.optimizedPrompt
    if (result.reasoning !== undefined) reasoning.value = result.reasoning
    if (result.chainId !== undefined) chainId.value = result.chainId
    if (result.versionId !== undefined) versionId.value = result.versionId
    void saveSession()
  }

  return {
    originalPrompt,
    optimizedPrompt,
    reasoning,
    chainId,
    versionId,
    inputImageB64,
    inputImageId,
    inputImageMime,
    endImageB64,
    endImageId,
    endImageMime,
    selectedTextModelKey,
    selectedTemplateId,
    selectedIterateTemplateId,
    updateTextModel,
    updatePrompt,
    updateAssetBinding,
    clearAssetBinding,
    updateTemplate,
    updateIterateTemplate,
    updateOptimizedResult,
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
