import { ref, computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '../ui/useToast'
import { getI18nErrorMessage } from '../../utils/error'
import type {
  VideoProvider,
  VideoModel,
  VideoModelConfig,
  VideoModelConfigInput,
  IVideoAdapterRegistry,
  IVideoModelManager,
  IVideoService,
} from '@prompt-optimizer/core'

type EditableVideoModelConfig = Omit<VideoModelConfig, 'provider' | 'model'> & {
  provider?: VideoProvider
  model?: VideoModel
}

export function useVideoModelManager() {
  const { t } = useI18n()
  const toast = useToast()

  const registry = inject<IVideoAdapterRegistry>('videoRegistry')!
  const videoModelManager = inject<IVideoModelManager>('videoModelManager')!
  const videoService = inject<IVideoService>('videoService')!

  const providers = ref<VideoProvider[]>([])
  const models = ref<VideoModel[]>([])
  const configs = ref<VideoModelConfig[]>([])

  const isLoadingProviders = ref(false)
  const isTestingConnection = ref(false)
  const isSaving = ref(false)
  const selectedProviderId = ref('')
  const selectedModelId = ref('')

  const configForm = ref<EditableVideoModelConfig>({
    id: '',
    name: '',
    providerId: '',
    modelId: '',
    enabled: true,
    connectionConfig: {},
    paramOverrides: {},
  })

  const connectionStatus = ref<{
    type: 'success' | 'error' | 'warning' | 'info'
    messageKey: string
    detail?: string
  } | null>(null)

  const selectedProvider = computed(() =>
    providers.value.find((p) => p.id === selectedProviderId.value)
  )

  const selectedModel = computed(() =>
    models.value.find((m) => m.id === selectedModelId.value)
  )

  const loadProviders = () => {
    if (!registry) return
    providers.value = registry.getAllProviders()
  }

  const loadModelsForProvider = (providerId: string) => {
    if (!registry || !providerId) {
      models.value = []
      return
    }
    try {
      models.value = registry.getStaticModels(providerId)
    } catch {
      models.value = []
    }
  }

  const loadConfigs = async () => {
    if (!videoModelManager) return
    try {
      if (typeof videoModelManager.ensureInitialized === 'function') {
        await videoModelManager.ensureInitialized()
      }
      configs.value = await videoModelManager.getAllConfigs()
    } catch (e) {
      console.error('[useVideoModelManager] Failed to load video configs:', e)
    }
  }

  const testConnection = async (config: VideoModelConfig): Promise<boolean> => {
    if (!videoService) return false
    isTestingConnection.value = true
    connectionStatus.value = {
      type: 'info',
      messageKey: 'video.connection.testing',
    }

    try {
      const ok = await videoService.testConnection(config)
      if (ok) {
        connectionStatus.value = {
          type: 'success',
          messageKey: 'video.connection.testSuccess',
        }
        toast.success(t('video.connection.testSuccess'))
        return true
      }
      connectionStatus.value = {
        type: 'error',
        messageKey: 'video.connection.testFailed',
      }
      return false
    } catch (error) {
      const msg = getI18nErrorMessage(error, 'Connection test failed')
      connectionStatus.value = {
        type: 'error',
        messageKey: 'video.connection.testFailed',
        detail: msg,
      }
      toast.error(msg)
      return false
    } finally {
      isTestingConnection.value = false
    }
  }

  const saveConfig = async (config: VideoModelConfigInput): Promise<boolean> => {
    if (!videoModelManager) return false
    isSaving.value = true
    try {
      const existing = configs.value.find((c) => c.id === config.id)
      if (existing) {
        await videoModelManager.updateConfig(config.id, config)
        toast.success(t('video.config.updateSuccess'))
      } else {
        await videoModelManager.addConfig(config)
        toast.success(t('video.config.addSuccess'))
      }
      await loadConfigs()
      return true
    } catch (error) {
      toast.error(getI18nErrorMessage(error, 'Failed to save video model configuration'))
      return false
    } finally {
      isSaving.value = false
    }
  }

  const deleteConfig = async (id: string): Promise<boolean> => {
    if (!videoModelManager) return false
    try {
      await videoModelManager.deleteConfig(id)
      toast.success(t('video.config.deleteSuccess'))
      await loadConfigs()
      return true
    } catch (error) {
      toast.error(getI18nErrorMessage(error, 'Failed to delete video config'))
      return false
    }
  }

  const toggleConfigEnabled = async (id: string, enabled: boolean): Promise<void> => {
    if (!videoModelManager) return
    try {
      await videoModelManager.updateConfig(id, { enabled })
      await loadConfigs()
    } catch (error) {
      toast.error(getI18nErrorMessage(error, 'Failed to update config state'))
    }
  }

  return {
    registry,
    videoModelManager,
    videoService,
    providers,
    models,
    configs,
    isLoadingProviders,
    isTestingConnection,
    isSaving,
    selectedProviderId,
    selectedModelId,
    configForm,
    connectionStatus,
    selectedProvider,
    selectedModel,
    loadProviders,
    loadModelsForProvider,
    loadConfigs,
    testConnection,
    saveConfig,
    deleteConfig,
    toggleConfigEnabled,
  }
}
