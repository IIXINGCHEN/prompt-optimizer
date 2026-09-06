<template>
  <div class="video-image2video-workspace" data-testid="workspace" data-mode="video-image2video">
    <div class="workspace-page-tools">
      <WorkspaceUtilityMenu
        :disabled="isOptimizing || isIterating || isAnyVariantRunning"
        :source="resolveSourceAssetRef(session.origin, session.assetBinding)"
        test-id="video-image2video-workspace-utility-menu"
        @clear="handleClearContent"
      />
    </div>

    <div
      ref="splitRootRef"
      class="video-image2video-split"
      :style="{ gridTemplateColumns: `${mainSplitLeftPct}% 12px 1fr` }"
    >
      <!-- 左侧：提示词优化区域（文本模型） -->
      <div class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
        <NFlex vertical :style="{ overflow: 'auto', height: '100%', minHeight: 0 }" :size="12">
          <!-- 输入控制区域 -->
          <NCard size="small" :style="{ flexShrink: 0 }">
            <NSpace vertical :size="14">
              <NFlex justify="space-between" align="center">
                <NText strong style="font-size: 16px;">
                  {{ t('videoWorkspace.input.originalPrompt') }}
                </NText>
              </NFlex>

              <!-- 原始意图输入框 -->
              <NInput
                v-model:value="session.originalPrompt"
                type="textarea"
                data-testid="video-image2video-input"
                :placeholder="t('videoWorkspace.input.originalPromptPlaceholder')"
                :autosize="{ minRows: 3, maxRows: 8 }"
                clearable
                show-count
                :disabled="isOptimizing"
              />

              <!-- 图片上传区域（首帧 + 尾帧） -->
              <NSpace vertical :size="8">
                <NText depth="2" style="font-size: 13px; font-weight: 500;">
                  {{ t('videoWorkspace.input.firstFrameImage') }}
                </NText>

                <NFlex align="center" :size="8">
                  <NButton
                    data-testid="video-image2video-open-upload"
                    :disabled="isOptimizing"
                    size="small"
                    @click="triggerFirstFrameUpload"
                  >
                    {{ t('videoWorkspace.input.selectFirstFrame') }}
                  </NButton>

                  <input
                    ref="firstFrameInputRef"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style="display: none;"
                    @change="handleFirstFrameFileChange"
                  />

                  <!-- 首帧预览缩略图 -->
                  <div v-if="session.inputImageB64" class="thumbnail-preview">
                    <img
                      :src="firstFrameSrc"
                      alt="First Frame Preview"
                      class="thumbnail-img"
                    />
                    <NButton
                      size="tiny"
                      quaternary
                      circle
                      type="error"
                      class="thumbnail-clear"
                      @click="clearFirstFrame"
                    >
                      ×
                    </NButton>
                  </div>
                </NFlex>
              </NSpace>

              <!-- 文本模型与模板选择 -->
              <NGrid :cols="24" :x-gap="8" responsive="screen">
                <NGridItem :span="8" :xs="24" :sm="8">
                  <NSpace vertical :size="4">
                    <NFlex justify="space-between" align="center">
                      <NText depth="3" style="font-size: 12px;">
                        {{ t('imageWorkspace.input.textModel') }}
                      </NText>
                      <NButton
                        v-if="appOpenModelManager"
                        quaternary
                        size="tiny"
                        :title="t('model.select.configure')"
                        @click="appOpenModelManager('text')"
                      >
                        ⚙️
                      </NButton>
                    </NFlex>
                    <NSelect
                      v-model:value="selectedTextModelKey"
                      :options="textModelOptions"
                      size="small"
                      :disabled="isOptimizing"
                      filterable
                      tag
                      :placeholder="t('imageWorkspace.input.modelPlaceholder')"
                    />
                  </NSpace>
                </NGridItem>

                <NGridItem :span="10" :xs="24" :sm="10">
                  <NSpace vertical :size="4">
                    <NFlex justify="space-between" align="center">
                      <NText depth="3" style="font-size: 12px;">
                        {{ t('videoWorkspace.input.template') }}
                      </NText>
                      <NButton
                        v-if="appOpenTemplateManager"
                        quaternary
                        size="tiny"
                        :title="t('template.configure')"
                        @click="appOpenTemplateManager('image2videoOptimize')"
                      >
                        ⚙️
                      </NButton>
                    </NFlex>
                    <NSelect
                      v-model:value="session.selectedTemplateId"
                      :options="videoTemplateOptions"
                      size="small"
                      :disabled="isOptimizing"
                      filterable
                      tag
                      :placeholder="t('videoWorkspace.input.templatePlaceholder')"
                    />
                  </NSpace>
                </NGridItem>

                <!-- 优化按钮 -->
                <NGridItem :span="6" :xs="24" :sm="6" class="flex items-end justify-end">
                  <NButton
                    type="primary"
                    size="small"
                    data-testid="video-image2video-optimize-button"
                    :loading="isOptimizing"
                    :disabled="isOptimizing || !session.originalPrompt.trim() || !session.inputImageB64"
                    @click="handleOptimizePrompt"
                  >
                    {{ isOptimizing ? t('common.loading') : t('promptOptimizer.optimize') }}
                  </NButton>
                </NGridItem>
              </NGrid>
            </NSpace>
          </NCard>

          <!-- 优化结果区域 -->
          <NCard size="small" :style="{ flex: 1, minHeight: '240px', overflow: 'hidden' }">
            <PromptPanelUI
              test-id="video-image2video"
              v-model:optimized-prompt="session.optimizedPrompt"
              :reasoning="session.reasoning"
              :original-prompt="session.originalPrompt"
              :is-optimizing="isOptimizing"
              :is-iterating="isIterating"
              :optimization-mode="'user'"
              v-model:selected-iterate-template="selectedIterateTemplate"
              :versions="currentVersions"
              :current-version-id="currentVersionId"
              show-preview
              iterate-template-type="videoIterate"
              @iterate="handleIteratePrompt"
              @openTemplateManager="appOpenTemplateManager?.($event)"
              @switchVersion="handleSwitchVersion"
              @open-preview="handleOpenPromptPreview"
            />
          </NCard>
        </NFlex>
      </div>

      <!-- 分隔线 -->
      <div class="split-divider" role="separator" />

      <!-- 右侧：视频生成多列测试区域 -->
      <div ref="testPaneRef" class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
        <NFlex vertical :style="{ height: '100%', gap: '12px' }">
          <!-- 顶部：列数切换与全部运行 -->
          <NCard size="small" :style="{ flexShrink: 0 }">
            <NFlex justify="space-between" align="center">
              <NFlex align="center" :size="8">
                <NText depth="2">{{ t('test.layout.columns') }}：</NText>
                <NRadioGroup
                  v-model:value="session.testColumnCount"
                  size="small"
                  :disabled="isAnyVariantRunning"
                >
                  <NRadioButton :value="2">2</NRadioButton>
                  <NRadioButton :value="3">3</NRadioButton>
                  <NRadioButton :value="4">4</NRadioButton>
                </NRadioGroup>
              </NFlex>

              <NButton
                type="primary"
                size="small"
                :loading="isAnyVariantRunning"
                :disabled="isAnyVariantRunning || !session.inputImageB64"
                @click="runAllVariants"
              >
                {{ t('test.layout.runAll') }}
              </NButton>
            </NFlex>
          </NCard>

          <!-- 配置甲板 Deck -->
          <NCard size="small" :style="{ flexShrink: 0 }">
            <div class="variant-deck" :style="{ gridTemplateColumns: testGridColumns }">
              <div v-for="id in activeVariantIds" :key="id" class="variant-cell">
                <NFlex vertical :size="8">
                  <NFlex justify="space-between" align="center">
                    <NTag size="small" type="primary" round>{{ id.toUpperCase() }}</NTag>
                    <NButton
                      type="primary"
                      size="tiny"
                      circle
                      :loading="variantRunning[id]"
                      :disabled="variantRunning[id] || !session.inputImageB64"
                      @click="() => runVariant(id)"
                    >
                      ▶
                    </NButton>
                  </NFlex>

                  <!-- 视频模型选择 -->
                  <NSelect
                    v-model:value="session.variants[id].modelKey"
                    :options="videoModelOptions"
                    size="small"
                    :placeholder="t('video.config.selectModel')"
                    :disabled="variantRunning[id]"
                  />
                </NFlex>
              </div>
            </div>
          </NCard>

          <!-- 结果展示区 -->
          <div class="variant-results-wrap" style="flex: 1; min-height: 0; overflow-y: auto;">
            <div class="variant-results" :style="{ gridTemplateColumns: testGridColumns }">
              <NCard
                v-for="id in activeVariantIds"
                :key="id"
                size="small"
                class="variant-result-card"
              >
                <!-- 运行中状态卡片 -->
                <div v-if="variantRunning[id]" class="variant-running-state">
                  <NSpace vertical align="center" :size="12">
                    <NSpin size="medium" />
                    <NText depth="2">
                      {{ session.variantTasks[id]?.status === 'queued' ? t('video.task.queued') : t('video.task.generating') }}
                    </NText>
                    <NProgress
                      type="line"
                      :percentage="session.variantTasks[id]?.progressPercent || 30"
                      :show-indicator="false"
                      style="width: 140px;"
                    />
                    <NButton
                      size="tiny"
                      secondary
                      type="error"
                      @click="cancelVariant(id)"
                    >
                      {{ t('common.cancel') }}
                    </NButton>
                  </NSpace>
                </div>

                <!-- 结果播放器展示 -->
                <div v-else-if="session.variantResults[id]?.video?.url" class="variant-result-body">
                  <AppVideoPlayer
                    :src="session.variantResults[id]!.video.url!"
                    :reference-image="firstFrameSrc"
                    :poster="session.variantResults[id]?.video?.coverImageUrl"
                  />
                  <div style="margin-top: 8px; font-size: 11px; color: #888;">
                    {{ t('video.metadata.model') }}: {{ session.variantResults[id]?.metadata?.modelId }}
                    <span v-if="session.variantResults[id]?.metadata?.generationTimeMs">
                      | {{ Math.round(session.variantResults[id]!.metadata!.generationTimeMs! / 1000) }}s
                    </span>
                  </div>
                </div>

                <!-- 空状态 -->
                <NEmpty
                  v-else
                  size="small"
                  :description="t('test.results.empty')"
                  style="padding: 32px 0;"
                />
              </NCard>
            </div>
          </div>
        </NFlex>
      </div>
    </div>

    <!-- 提示词全屏预览面板 -->
    <PromptPreviewPanel
      v-model:show="showPromptPreview"
      :previewContent="previewContent"
      :missingVariables="[]"
      :hasMissingVariables="false"
      :variableStats="{ total: 0, builtin: 0, custom: 0, missing: 0, provided: 0 }"
      contextMode="system"
      renderPhase="optimize"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, watch, type Ref } from 'vue'
import {
  NFlex,
  NCard,
  NText,
  NInput,
  NButton,
  NSelect,
  NGrid,
  NGridItem,
  NRadioGroup,
  NRadioButton,
  NTag,
  NSpin,
  NProgress,
  NEmpty,
  NSpace,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { AppServices } from '../../types/services'
import { useToast } from '../../composables/ui/useToast'
import { resolveSourceAssetRef } from '../../utils/source-asset'
import WorkspaceUtilityMenu from '../common/WorkspaceUtilityMenu.vue'
import PromptPanelUI from '../PromptPanel.vue'
import PromptPreviewPanel from '../PromptPreviewPanel.vue'
import AppVideoPlayer from './AppVideoPlayer.vue'
import { useWorkspaceTextModelSelection } from '../../composables/workspaces/useWorkspaceTextModelSelection'
import {
  useVideoImage2VideoSession,
  type VideoTestVariantId,
} from '../../stores/session/useVideoImage2VideoSession'
import type { VideoModelConfig, PromptRecord, Template } from '@prompt-optimizer/core'

const { t } = useI18n()
const toast = useToast()
const session = useVideoImage2VideoSession()
const services = inject<Ref<AppServices | null>>('services', ref(null))
const appOpenModelManager = inject<((tab?: string) => void) | null>('openModelManager', null)
const appOpenTemplateManager = inject<((type?: string) => void) | null>('openTemplateManager', null)

const textModelSelection = useWorkspaceTextModelSelection(services, session)
const textModelOptions = textModelSelection.textModelOptions
const selectedTextModelKey = textModelSelection.selectedTextModelKey

const splitRootRef = ref<HTMLDivElement | null>(null)
const firstFrameInputRef = ref<HTMLInputElement | null>(null)
const mainSplitLeftPct = ref(38)

const isOptimizing = ref(false)
const isIterating = ref(false)
const selectedIterateTemplate = ref<Template | null>(null)
const variantRunning = ref<Record<VideoTestVariantId, boolean>>({
  a: false,
  b: false,
  c: false,
  d: false,
})
const variantAbortControllers = new Map<VideoTestVariantId, AbortController>()

const showPromptPreview = ref(false)
const previewContent = ref('')

const currentVersions = ref<PromptRecord[]>([])
const currentVersionId = ref('')

const firstFrameSrc = computed(() => {
  if (!session.inputImageB64) return ''
  return session.inputImageB64.startsWith('data:')
    ? session.inputImageB64
    : `data:${session.inputImageMime || 'image/png'};base64,${session.inputImageB64}`
})

const activeVariantIds = computed<VideoTestVariantId[]>(() => {
  if (session.testColumnCount === 2) return ['a', 'b']
  if (session.testColumnCount === 3) return ['a', 'b', 'c']
  return ['a', 'b', 'c', 'd']
})

const testGridColumns = computed(() => `repeat(${session.testColumnCount}, minmax(0, 1fr))`)

const isAnyVariantRunning = computed(() =>
  Object.values(variantRunning.value).some(Boolean)
)

const videoModelOptions = ref<Array<{ label: string; value: string }>>([])
const videoTemplateOptions = ref<Array<{ label: string; value: string }>>([
  { label: '通用运镜与动态优化', value: 'image2video-general-optimize' },
  { label: '电影级机位与光影时序', value: 'image2video-cinematic-optimize' },
  { label: '人物微表情与动作动态', value: 'image2video-character-motion-optimize' },
  { label: '商业产品与广告展示动态', value: 'image2video-commercial-product-optimize' },
  { label: '自然风光与大气流动动态', value: 'image2video-landscape-nature-optimize' },
])

const refreshVideoTemplates = async () => {
  if (!services.value?.templateManager) return
  try {
    const list = await services.value.templateManager.listTemplatesByType('image2videoOptimize')
    if (list && list.length > 0) {
      videoTemplateOptions.value = list.map((t: Template) => ({
        label: t.name || t.id,
        value: t.id,
      }))
    }
  } catch {}
}

const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

const triggerFirstFrameUpload = () => {
  firstFrameInputRef.value?.click()
}

const handleFirstFrameFileChange = (e: Event) => {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  const file = files[0]
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    toast.error(t('imageWorkspace.upload.fileTooLarge'))
    if (firstFrameInputRef.value) {
      firstFrameInputRef.value.value = ''
    }
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const res = reader.result as string
    session.inputImageB64 = res
    session.inputImageMime = file.type || 'image/png'
    // 上传后立即持久化，避免崩溃/意外关闭丢失首帧
    void session.saveSession()
  }
  reader.readAsDataURL(file)
}

const clearFirstFrame = () => {
  session.inputImageB64 = null
  session.inputImageMime = null
  session.inputImageId = null
  if (firstFrameInputRef.value) {
    firstFrameInputRef.value.value = ''
  }
  void session.saveSession()
}

const handleClearContent = () => {
  session.clearContent()
  currentVersions.value = []
  currentVersionId.value = ''
}

const handleOptimizePrompt = async () => {
  if (!session.originalPrompt.trim()) {
    toast.error(t('videoWorkspace.input.promptRequired'))
    return
  }
  if (!session.inputImageB64) {
    toast.error(t('videoWorkspace.input.selectFirstFrame'))
    return
  }
  if (!session.selectedTextModelKey) {
    toast.error(t('toast.error.noOptimizeModel'))
    appOpenModelManager?.('text')
    return
  }
  if (!services?.value?.promptService) {
    toast.error(t('toast.error.serviceInit'))
    return
  }

  const textConfig = await services?.value?.modelManager?.getModel(session.selectedTextModelKey)
  if (textConfig && !textConfig.enabled) {
    toast.warning(t('modelManager.modelDisabled', { name: textConfig.name || session.selectedTextModelKey }))
    appOpenModelManager?.('text')
    return
  }

  isOptimizing.value = true
  session.optimizedPrompt = ''
  session.reasoning = ''

  try {
    const rawB64 = session.inputImageB64.includes(',')
      ? session.inputImageB64.split(',')[1]
      : session.inputImageB64

    await services.value.promptService.optimizePromptStream(
      {
        optimizationMode: 'user',
        targetPrompt: session.originalPrompt,
        templateId: session.selectedTemplateId,
        modelKey: session.selectedTextModelKey,
        inputImages: [
          {
            b64: rawB64,
            mimeType: session.inputImageMime || 'image/png',
          },
        ],
      },
      {
        onToken: (token) => {
          session.optimizedPrompt += token
        },
        onReasoningToken: (token) => {
          session.reasoning += token
        },
        onComplete: () => {
          const newVer: PromptRecord = {
            id: `v_${Date.now()}`,
            originalPrompt: session.originalPrompt,
            optimizedPrompt: session.optimizedPrompt,
            type: 'image2videoOptimize',
            chainId: session.chainId || 'chain_1',
            version: currentVersions.value.length + 1,
            timestamp: Date.now(),
            modelKey: session.selectedTextModelKey,
            templateId: session.selectedTemplateId,
            metadata: {
              reasoning: session.reasoning,
            },
          }
          currentVersions.value.push(newVer)
          currentVersionId.value = newVer.id
          // 经由 store action 持久化优化结果（刷新/切模式不丢失）
          session.updateOptimizedResult({
            optimizedPrompt: session.optimizedPrompt,
            reasoning: session.reasoning,
            chainId: session.chainId || 'chain_1',
            versionId: newVer.id,
          })
          toast.success(t('toast.success.optimizeSuccess'))
        },
        onError: (err) => {
          toast.error(err.message)
        },
      }
    )
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  } finally {
    isOptimizing.value = false
  }
}

const handleIteratePrompt = async (payload: { iterateInput: string }) => {
  if (!session.optimizedPrompt || !services?.value?.promptService) return
  if (!session.selectedTextModelKey) {
    toast.error(t('toast.error.noOptimizeModel'))
    appOpenModelManager?.('text')
    return
  }

  const textConfig = await services?.value?.modelManager?.getModel(session.selectedTextModelKey)
  if (textConfig && !textConfig.enabled) {
    toast.warning(t('modelManager.modelDisabled', { name: textConfig.name || session.selectedTextModelKey }))
    appOpenModelManager?.('text')
    return
  }

  isIterating.value = true
  try {
    const result = await services.value.promptService.iteratePrompt(
      session.originalPrompt,
      session.optimizedPrompt,
      payload.iterateInput,
      session.selectedTextModelKey,
      session.selectedIterateTemplateId
    )
    session.optimizedPrompt = result
    const newVer: PromptRecord = {
      id: `v_${Date.now()}`,
      originalPrompt: session.originalPrompt,
      optimizedPrompt: result,
      type: 'videoIterate',
      chainId: session.chainId || 'chain_1',
      version: currentVersions.value.length + 1,
      timestamp: Date.now(),
      modelKey: session.selectedTextModelKey,
      templateId: session.selectedIterateTemplateId,
      iterationNote: payload.iterateInput,
    }
    currentVersions.value.push(newVer)
    currentVersionId.value = newVer.id
    session.updateOptimizedResult({
      optimizedPrompt: result,
      chainId: session.chainId || 'chain_1',
      versionId: newVer.id,
    })
    toast.success(t('toast.success.iterateSuccess'))
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  } finally {
    isIterating.value = false
  }
}

const handleSwitchVersion = (version: PromptRecord) => {
  session.optimizedPrompt = version.optimizedPrompt
  session.reasoning = version.metadata?.reasoning || ''
  currentVersionId.value = version.id
}

const handleOpenPromptPreview = () => {
  showPromptPreview.value = true
}

const extractProductionPrompt = (text: string): string => {
  if (!text) return ''
  const MARKER = /(?:【完整\s*(?:Prompt|提示词)】|完整\s*(?:Prompt|提示词)[：:]|【成品\s*(?:Prompt|提示词|生成提示词)】|成品\s*(?:Prompt|提示词|生成提示词)[：:])/i
  // 终止边界只认真正的下一板块标记（完整/成品/负面/Negative/编号大标题），
  // 避免把提示词自身以【镜头…】/普通 # 开头的行误判为板块边界而截断。
  const SECTION_BOUNDARY = /(?=(?:\n\s*【(?:完整|成品|负面|工业级|Negative)|\n\s*#{1,3}\s*(?:[一二三四五]、|Negative)|\n\s*负面提示词|\n\s*Negative\s*[：:]|\n\s*[一二三四五]、\s*(?:成品|完整|工业级)|$))/i
  const stripFence = (s: string) => s.trim().replace(/^```[a-zA-Z]*\n/, '').replace(/```[\s\n]*$/, '').trim()

  const sectionMatch = text.match(new RegExp(MARKER.source + '\\s*([\\s\\S]+?)' + SECTION_BOUNDARY.source))
  if (sectionMatch?.[1]?.trim()) {
    return stripFence(sectionMatch[1])
  }

  const endMatch = text.match(new RegExp(MARKER.source + '\\s*([\\s\\S]+)$'))
  if (endMatch?.[1]?.trim()) {
    return stripFence(endMatch[1])
  }

  // 兜底：模型未输出任何板块标记时，剔除负面提示词等元信息板块后再交付 API，
  // 防止"变脸/畸形/撕裂"等负面词以正向语义进入视频模型。
  const beforeNegative = text.split(/\n\s*(?:【?\s*(?:工业级)?负面提示词|[一二三四五]、\s*(?:工业级)?负面提示词|#{1,3}\s*[一二三四五]、\s*工业级负面|Negative\s*[：:])/i)[0]
  const fallback = (beforeNegative.trim() || text.trim())
    .replace(/^```[a-zA-Z]*\n/, '')
    .replace(/```[\s\n]*$/, '')
    .trim()
  return fallback
}

const runVariant = async (id: VideoTestVariantId) => {
  // 重入守卫：同一列运行中禁止重复启动（双击/运行中再点），避免双份计费与控制器互踩
  if (variantRunning.value[id]) return
  // 同步置位：防止 await 间隙内双击重入（TOCTOU）
  variantRunning.value[id] = true

  const variant = session.variants[id]
  const configId = variant?.modelKey
  if (!configId) {
    variantRunning.value[id] = false
    toast.error(t('video.config.selectModel'))
    return
  }

  const config = await services?.value?.videoModelManager?.getConfig(configId)
  if (config && !config.enabled) {
    variantRunning.value[id] = false
    toast.warning(t('video.config.notEnabledWarning', { name: config.name || configId }))
    appOpenModelManager?.('video')
    return
  }

  if (!session.inputImageB64) {
    variantRunning.value[id] = false
    toast.error(t('videoWorkspace.input.selectFirstFrame'))
    return
  }
  if (!services?.value?.videoService) {
    variantRunning.value[id] = false
    toast.error(t('toast.error.serviceInit'))
    return
  }

  // 变体语义落地：version=0（v0 原文）使用原始提示词，其余使用优化结果
  const promptSource = variant?.version === 0 ? session.originalPrompt : (session.optimizedPrompt || session.originalPrompt)
  if (!promptSource.trim()) {
    variantRunning.value[id] = false
    toast.error(t('videoWorkspace.input.promptRequired'))
    return
  }
  const promptText = extractProductionPrompt(promptSource)

  const controller = new AbortController()
  variantAbortControllers.set(id, controller)

  try {
    const rawB64 = session.inputImageB64.includes(',')
      ? session.inputImageB64.split(',')[1]
      : session.inputImageB64

    const result = await services.value.videoService.generateVideo(
      {
        prompt: promptText,
        configId,
        duration: variant?.duration,
        aspectRatio: variant?.aspectRatio,
        inputImage: {
          b64: rawB64,
          mimeType: session.inputImageMime || 'image/png',
        },
      },
      {
        onStatusChange: (status, progress) => {
          session.variantTasks[id] = {
            taskId: '',
            configId,
            status,
            progressPercent: progress,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        },
        onComplete: (res) => {
          session.variantResults[id] = res
          toast.success(t('video.task.succeeded'))
        },
        onError: (err) => {
          toast.error(err.message)
        },
      },
      controller.signal
    )
    session.variantResults[id] = result
  } catch (err: any) {
    if (err.name !== 'AbortError' && !String(err).includes('cancelled')) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  } finally {
    // 只有当控制器仍是当前运行的这一份时才清理状态；
    // 若已被取消并重启（新控制器接管），旧运行的 finally 不得清掉新一轮的 running 标记
    if (variantAbortControllers.get(id) === controller) {
      variantAbortControllers.delete(id)
      variantRunning.value[id] = false
    }
  }
}

const cancelVariant = (id: VideoTestVariantId) => {
  const controller = variantAbortControllers.get(id)
  if (controller) {
    controller.abort()
    // running 标记交给对应运行的 finally 复位，避免取消后立即重启时被旧 finally 误清
    variantAbortControllers.delete(id)
    variantRunning.value[id] = false
  }
}

const runAllVariants = async () => {
  const runningPromises = activeVariantIds.value.map((id) => runVariant(id))
  await Promise.allSettled(runningPromises)
}

const loadModels = async () => {
  if (!services?.value) return
  await refreshVideoTemplates()

  if (services.value.videoModelManager) {
    try {
      if (typeof services.value.videoModelManager.ensureInitialized === 'function') {
        await services.value.videoModelManager.ensureInitialized()
      }
      const videoConfigs = await services.value.videoModelManager.getAllConfigs()
      videoModelOptions.value = videoConfigs.map((c: VideoModelConfig) => ({
        label: c.enabled ? (c.name || c.id) : `${c.name || c.id} (${t('video.config.notConfiguredTag')})`,
        value: c.id,
      }))
      if (videoModelOptions.value[0]) {
        for (const id of ['a', 'b', 'c', 'd'] as VideoTestVariantId[]) {
          if (!session.variants[id].modelKey) {
            session.variants[id].modelKey = videoModelOptions.value[0].value
          }
        }
      }
    } catch {}
  }
}

watch(
  () => services?.value,
  (newServices) => {
    if (newServices) {
      void loadModels()
    }
  },
  { immediate: true }
)

const handleRestoreFavorite = (event: Event) => {
  const detail = (event as CustomEvent).detail || {}
  const content = typeof detail.content === 'string' ? detail.content : ''
  if (!content) return
  session.originalPrompt = content
  void session.saveSession()
}

onMounted(async () => {
  await loadModels()
  if (typeof window !== 'undefined') {
    window.addEventListener('video-workspace-refresh-video-models', loadModels)
    window.addEventListener('video-workspace-restore-favorite', handleRestoreFavorite)
  }
})

onUnmounted(() => {
  // 离开工作区时中止所有进行中的生成任务，停止后续轮询与状态写入
  for (const controller of variantAbortControllers.values()) {
    controller.abort()
  }
  variantAbortControllers.clear()
  if (typeof window !== 'undefined') {
    window.removeEventListener('video-workspace-refresh-video-models', loadModels)
    window.removeEventListener('video-workspace-restore-favorite', handleRestoreFavorite)
  }
})
</script>

<style scoped>
.video-image2video-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
}
.workspace-page-tools {
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 10;
}
.video-image2video-split {
  display: grid;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.split-pane {
  overflow: hidden;
  height: 100%;
}
.split-divider {
  width: 1px;
  background: var(--n-border-color);
  margin: 0 5px;
}
.thumbnail-preview {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--n-border-color);
}
.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumbnail-clear {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
}
.variant-deck {
  display: grid;
  gap: 12px;
}
.variant-cell {
  background: var(--n-card-color);
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--n-border-color);
}
.variant-results {
  display: grid;
  gap: 12px;
}
.variant-result-card {
  min-height: 240px;
}
.variant-running-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}
</style>
