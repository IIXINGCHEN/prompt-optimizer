import type { VideoModelConfig, IVideoAdapterRegistry } from './types'
import { getEnvVar } from '../../utils/environment'

const VIDEO_PROVIDER_ENV_KEYS = {
  dashscope: ['VITE_DASHSCOPE_API_KEY'],
  siliconflow: ['VITE_SILICONFLOW_API_KEY'],
} as const

type BuiltinVideoConfigSpec = {
  providerId: keyof typeof VIDEO_PROVIDER_ENV_KEYS
  configId: string
  modelId?: string
  displayName?: string
}

const VIDEO_BUILTIN_CONFIGS: readonly BuiltinVideoConfigSpec[] = [
  {
    providerId: 'dashscope',
    configId: 'video-dashscope-wan',
    modelId: 'wanx2.1-i2v-plus',
    displayName: 'Wan 2.1 I2V Plus (DashScope)',
  },
  {
    providerId: 'siliconflow',
    configId: 'video-siliconflow-cogvideox',
    modelId: 'THUDM/CogVideoX-5b-I2V',
    displayName: 'CogVideoX 5B I2V (SiliconFlow)',
  },
] as const

export function getBuiltinVideoConfigIds(): string[] {
  return VIDEO_BUILTIN_CONFIGS.map(s => s.configId)
}

export function getDefaultVideoModels(
  registry: IVideoAdapterRegistry
): Record<string, VideoModelConfig> {
  const configs: Record<string, VideoModelConfig> = {}

  for (const spec of VIDEO_BUILTIN_CONFIGS) {
    let adapter
    try {
      adapter = registry.getAdapter(spec.providerId)
    } catch {
      continue
    }

    const provider = adapter.getProvider()
    const staticModels = adapter.getModels()
    const model = (spec.modelId ? staticModels.find(m => m.id === spec.modelId) : null) ||
      staticModels[0] ||
      adapter.buildDefaultModel(spec.modelId || `${spec.providerId}-default`)

    const envKeys = VIDEO_PROVIDER_ENV_KEYS[spec.providerId] || []
    let apiKey = ''
    for (const key of envKeys) {
      apiKey = getEnvVar(key) || ''
      if (apiKey) break
    }

    const hasApiKey = Boolean(apiKey.trim())
    const enabled = !provider.requiresApiKey || hasApiKey

    configs[spec.configId] = {
      id: spec.configId,
      name: spec.displayName || `${provider.name} - ${model.name}`,
      providerId: spec.providerId,
      modelId: model.id,
      enabled,
      connectionConfig: {
        apiKey,
      },
      paramOverrides: { ...model.defaultParameterValues },
      provider,
      model,
    }
  }

  return configs
}
