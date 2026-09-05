<template>
  <NModal
    :show="show"
    preset="card"
    :title="isEditing ? t('video.model.editTitle') : t('video.model.addTitle')"
    style="width: 90vw; max-width: 680px;"
    @update:show="(val) => emit('update:show', val)"
  >
    <NScrollbar style="max-height: 70vh;">
      <NForm :model="formData" label-placement="top" :size="'medium'">
        <!-- 基本信息 -->
        <NFormItem :label="t('modelManager.modelName')" required>
          <NInput
            v-model:value="formData.name"
            :placeholder="t('video.model.namePlaceholder')"
          />
        </NFormItem>

        <NFormItem :label="t('modelManager.status')">
          <NCheckbox v-model:checked="formData.enabled">
            {{ t('modelManager.enabled') }}
          </NCheckbox>
        </NFormItem>

        <NDivider style="margin: 16px 0;" />
        <NH4 style="margin: 0 0 12px 0;">{{ t('video.config.providerSection') }}</NH4>

        <NFormItem :label="t('video.config.provider')" required>
          <NSelect
            v-model:value="formData.providerId"
            :options="providerOptions"
            :placeholder="t('video.config.selectProvider')"
            @update:value="handleProviderChange"
          />
        </NFormItem>

        <!-- 连接字段 -->
        <div v-if="selectedProvider">
          <NFormItem
            v-if="selectedProvider.requiresApiKey"
            :label="t('modelManager.apiKey')"
            required
          >
            <NInput
              v-model:value="formData.connectionConfig.apiKey"
              type="password"
              show-password-on="click"
              placeholder="API Key"
            />
          </NFormItem>

          <NFormItem :label="t('modelManager.baseURL')">
            <NInput
              v-model:value="formData.connectionConfig.baseURL"
              :placeholder="selectedProvider.defaultBaseURL || 'https://...'"
            />
            <template #feedback>
              <span v-if="formData.providerId === 'dashscope'" style="font-size: 12px; color: var(--text-color-3, #999);">
                {{ t('video.config.dashscopeBaseUrlHint') }}
              </span>
            </template>
          </NFormItem>

          <NSpace align="center" style="margin-bottom: 16px;">
            <NButton
              secondary
              type="info"
              size="small"
              :loading="isTesting"
              :disabled="!canTest"
              @click="handleTest"
            >
              {{ t('modelManager.testConnection') }}
            </NButton>
          </NSpace>
        </div>

        <NDivider style="margin: 16px 0;" />
        <NH4 style="margin: 0 0 12px 0;">{{ t('video.config.modelSection') }}</NH4>

        <NFormItem :label="t('video.config.model')" required>
          <NSelect
            v-model:value="formData.modelId"
            :options="modelOptions"
            :placeholder="t('video.config.selectModel')"
            filterable
            tag
          />
        </NFormItem>
      </NForm>
    </NScrollbar>

    <template #action>
      <NSpace justify="end">
        <NButton @click="close">{{ t('common.cancel') }}</NButton>
        <NButton
          type="primary"
          :loading="isSaving"
          :disabled="!canSave"
          @click="handleSave"
        >
          {{ t('common.save') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  NModal,
  NScrollbar,
  NForm,
  NFormItem,
  NInput,
  NCheckbox,
  NDivider,
  NH4,
  NSelect,
  NSpace,
  NButton,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { VideoModelConfig, VideoModelConfigInput } from '@prompt-optimizer/core'
import { useVideoModelManager } from '../composables/model/useVideoModelManager'

const props = defineProps<{
  show: boolean
  config?: VideoModelConfig | null
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'saved'): void
}>()

const { t } = useI18n()
const {
  providers,
  models,
  loadProviders,
  loadModelsForProvider,
  loadConfigs,
  saveConfig,
  testConnection,
} = useVideoModelManager()

const isSaving = ref(false)
const isTesting = ref(false)

const formData = ref<{
  id: string
  name: string
  providerId: string
  modelId: string
  enabled: boolean
  connectionConfig: {
    apiKey?: string
    baseURL?: string
  }
}>({
  id: '',
  name: '',
  providerId: '',
  modelId: '',
  enabled: true,
  connectionConfig: {
    apiKey: '',
    baseURL: '',
  },
})

const isEditing = computed(() => Boolean(props.config?.id))

const providerOptions = computed(() =>
  providers.value.map((p) => ({
    label: p.name,
    value: p.id,
  }))
)

const modelOptions = computed(() =>
  models.value.map((m) => ({
    label: m.name || m.id,
    value: m.id,
  }))
)

const selectedProvider = computed(() =>
  providers.value.find((p) => p.id === formData.value.providerId)
)

const canTest = computed(() => {
  if (!formData.value.providerId) return false
  if (selectedProvider.value?.requiresApiKey && !formData.value.connectionConfig.apiKey?.trim()) {
    return false
  }
  return true
})

const canSave = computed(() => {
  return (
    Boolean(formData.value.name.trim()) &&
    Boolean(formData.value.providerId) &&
    Boolean(formData.value.modelId)
  )
})

const handleProviderChange = (providerId: string) => {
  formData.value.providerId = providerId
  loadModelsForProvider(providerId)
  if (models.value.length > 0) {
    formData.value.modelId = models.value[0].id
  }
}

const handleTest = async () => {
  isTesting.value = true
  try {
    const testCfg: any = {
      id: formData.value.id || 'test',
      name: formData.value.name || 'Test',
      providerId: formData.value.providerId,
      modelId: formData.value.modelId || models.value[0]?.id || 'default',
      enabled: true,
      connectionConfig: { ...formData.value.connectionConfig },
    }
    await testConnection(testCfg)
  } finally {
    isTesting.value = false
  }
}

const handleSave = async () => {
  isSaving.value = true
  try {
    const payload: VideoModelConfigInput = {
      id: formData.value.id || `video-${formData.value.providerId}-${Date.now()}`,
      name: formData.value.name,
      providerId: formData.value.providerId,
      modelId: formData.value.modelId,
      enabled: formData.value.enabled,
      connectionConfig: { ...formData.value.connectionConfig },
    }
    const success = await saveConfig(payload)
    if (success) {
      emit('saved')
    }
  } finally {
    isSaving.value = false
  }
}

const close = () => {
  emit('update:show', false)
}

watch(
  () => props.show,
  (visible) => {
    if (!visible) return
    loadProviders()
    loadConfigs()

    if (props.config) {
      formData.value = {
        id: props.config.id,
        name: props.config.name,
        providerId: props.config.providerId,
        modelId: props.config.modelId,
        enabled: props.config.enabled,
        connectionConfig: {
          apiKey: props.config.connectionConfig?.apiKey || '',
          baseURL: props.config.connectionConfig?.baseURL || '',
        },
      }
      loadModelsForProvider(props.config.providerId)
    } else {
      const defaultProviderId = providers.value[0]?.id || 'dashscope'
      formData.value = {
        id: '',
        name: '',
        providerId: defaultProviderId,
        modelId: '',
        enabled: true,
        connectionConfig: { apiKey: '', baseURL: '' },
      }
      loadModelsForProvider(defaultProviderId)
      if (models.value[0]) {
        formData.value.modelId = models.value[0].id
      }
    }
  },
  { immediate: true }
)

onMounted(() => {
  loadProviders()
})
</script>
