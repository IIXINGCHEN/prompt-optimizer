import {
  IVideoModelManager,
  VideoModelConfig,
  VideoModelConfigInput,
  IVideoAdapterRegistry,
} from './types'
import { IStorageProvider } from '../storage/types'
import { StorageAdapter } from '../storage/adapter'
import { CORE_SERVICE_KEYS } from '../../constants/storage-keys'
import { ImportExportError } from '../../interfaces/import-export'
import { VIDEO_ERROR_CODES, IMPORT_EXPORT_ERROR_CODES, type ErrorParams } from '../../constants/error-codes'
import { BaseError } from '../llm/errors'
import { getDefaultVideoModels } from './defaults'

class VideoModelManagerError extends BaseError {
  constructor(code: string, message?: string, params?: ErrorParams) {
    super(code, message, params)
  }
}

export class VideoModelManager implements IVideoModelManager {
  private readonly storageKey = CORE_SERVICE_KEYS.VIDEO_MODELS
  private readonly storage: IStorageProvider
  private readonly registry: IVideoAdapterRegistry
  private initPromise: Promise<void> | null = null

  constructor(storageProvider: IStorageProvider, registry: IVideoAdapterRegistry) {
    this.storage = new StorageAdapter(storageProvider)
    this.registry = registry
  }

  public async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.init()
    }
    return this.initPromise
  }

  public async isInitialized(): Promise<boolean> {
    const raw = await this.storage.getItem(this.storageKey)
    return !!raw
  }

  private async init(): Promise<void> {
    try {
      const raw = await this.storage.getItem(this.storageKey)
      if (!raw) {
        const defaults = getDefaultVideoModels(this.registry)
        await this.storage.setItem(this.storageKey, JSON.stringify(defaults))
        return
      }

      let data: Record<string, VideoModelConfig>
      try {
        data = JSON.parse(raw) || {}
      } catch {
        data = {}
      }

      let changed = false
      for (const [key, cfg] of Object.entries(data)) {
        if (cfg && typeof cfg === 'object' && !(cfg as any).id) {
          ;(cfg as any).id = key
          changed = true
        }
      }

      const defaults = getDefaultVideoModels(this.registry)
      for (const [key, cfg] of Object.entries(defaults)) {
        if (!data[key]) {
          data[key] = cfg
          changed = true
        }
      }

      if (changed) {
        await this.storage.setItem(this.storageKey, JSON.stringify(data))
      }
    } catch {
      try {
        const defaults = getDefaultVideoModels(this.registry)
        await this.storage.setItem(this.storageKey, JSON.stringify(defaults))
      } catch {}
    }
  }

  async addConfig(config: VideoModelConfigInput): Promise<void> {
    const completeConfig = this.ensureSelfContained(config)
    this.validateConfig(completeConfig)

    await this.storage.updateData<Record<string, VideoModelConfig>>(
      this.storageKey,
      (current) => {
        const data = current || {}
        if (data[completeConfig.id]) {
          throw new VideoModelManagerError(
            VIDEO_ERROR_CODES.CONFIG_NOT_FOUND,
            `Config already exists: ${completeConfig.id}`,
            { configId: completeConfig.id }
          )
        }
        return { ...data, [completeConfig.id]: completeConfig }
      }
    )
  }

  async updateConfig(id: string, updates: Partial<VideoModelConfigInput>): Promise<void> {
    await this.storage.updateData<Record<string, VideoModelConfig>>(
      this.storageKey,
      (current) => {
        const data = current || {}
        if (!data[id]) {
          throw new VideoModelManagerError(
            VIDEO_ERROR_CODES.CONFIG_NOT_FOUND,
            `Config not found: ${id}`,
            { configId: id }
          )
        }

        const updated: VideoModelConfig = {
          ...data[id],
          ...updates,
          id: data[id].id,
        }

        const completeConfig = this.ensureSelfContained(updated)
        this.validateConfig(completeConfig)

        return { ...data, [id]: completeConfig }
      }
    )
  }

  async deleteConfig(id: string): Promise<void> {
    await this.storage.updateData<Record<string, VideoModelConfig>>(
      this.storageKey,
      (current) => {
        const data = current || {}
        if (!data[id]) {
          return data
        }
        const { [id]: removed, ...rest } = data
        return rest
      }
    )
  }

  async getConfig(id: string): Promise<VideoModelConfig | null> {
    const raw = await this.storage.getItem(this.storageKey)
    const data: Record<string, VideoModelConfig> = raw ? JSON.parse(raw) : {}
    const cfg = data[id]
    if (!cfg) return null

    if (!(cfg as any).id) {
      ;(cfg as any).id = id
    }

    try {
      return this.ensureSelfContained(cfg)
    } catch {
      return cfg
    }
  }

  async getAllConfigs(): Promise<VideoModelConfig[]> {
    const raw = await this.storage.getItem(this.storageKey)
    const data: Record<string, VideoModelConfig> = raw ? JSON.parse(raw) : {}

    return Object.entries(data).map(([key, cfg]) => {
      const withId = (cfg as any).id ? cfg : { ...cfg, id: key }
      try {
        return this.ensureSelfContained(withId)
      } catch {
        return withId
      }
    })
  }

  async getEnabledConfigs(): Promise<VideoModelConfig[]> {
    const all = await this.getAllConfigs()
    return all.filter((c) => c.enabled)
  }

  private ensureSelfContained(config: VideoModelConfigInput | VideoModelConfig): VideoModelConfig {
    let provider = config.provider
    let model = config.model

    if (!provider || !model) {
      try {
        const adapter = this.registry.getAdapter(config.providerId)
        if (!provider) {
          provider = adapter.getProvider()
        }
        if (!model) {
          const staticModels = adapter.getModels()
          model = staticModels.find((m) => m.id === config.modelId) || adapter.buildDefaultModel(config.modelId)
        }
      } catch {
        // 容错处理
        if (!provider) {
          provider = {
            id: config.providerId,
            name: config.providerId,
            description: `Unknown provider: ${config.providerId}`,
            requiresApiKey: true,
            defaultBaseURL: '',
            supportsDynamicModels: false,
          }
        }
        if (!model) {
          model = {
            id: config.modelId,
            name: config.modelId,
            providerId: config.providerId,
            capabilities: {
              image2video: true,
              supportedDurations: [5],
              supportedRatios: ['16:9', '9:16', '1:1'],
            },
            parameterDefinitions: [],
          }
        }
      }
    }

    return {
      id: config.id,
      name: config.name,
      providerId: config.providerId,
      modelId: config.modelId,
      enabled: config.enabled,
      connectionConfig: config.connectionConfig || {},
      paramOverrides: config.paramOverrides || {},
      provider: provider!,
      model: model!,
    }
  }

  private validateConfig(config: VideoModelConfig): void {
    if (!config.id?.trim()) {
      throw new VideoModelManagerError(VIDEO_ERROR_CODES.CONFIG_ID_EMPTY, 'Config ID cannot be empty')
    }
    if (!config.name?.trim()) {
      throw new VideoModelManagerError(VIDEO_ERROR_CODES.CONFIG_NOT_FOUND, 'Config name cannot be empty')
    }
    if (!config.providerId?.trim()) {
      throw new VideoModelManagerError(VIDEO_ERROR_CODES.PROVIDER_NOT_FOUND, 'Provider ID cannot be empty')
    }
    if (!config.modelId?.trim()) {
      throw new VideoModelManagerError(VIDEO_ERROR_CODES.CONFIG_NOT_FOUND, 'Model ID cannot be empty')
    }
  }

  // === IImportExportable 实现 ===
  async getDataType(): Promise<string> {
    return 'video-model-configs'
  }

  async validateData(data: any): Promise<boolean> {
    if (!Array.isArray(data)) return false
    return data.every((item) => {
      try {
        this.validateConfig(this.ensureSelfContained(item))
        return true
      } catch {
        return false
      }
    })
  }

  async exportData(): Promise<string> {
    const configs = await this.getAllConfigs()
    return JSON.stringify(configs, null, 2)
  }

  async importData(jsonData: string): Promise<void> {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonData)
    } catch {
      throw new ImportExportError(IMPORT_EXPORT_ERROR_CODES.VALIDATION_ERROR, 'Invalid JSON format')
    }

    if (!Array.isArray(parsed)) {
      throw new ImportExportError(IMPORT_EXPORT_ERROR_CODES.VALIDATION_ERROR, 'Expected an array of video configs')
    }

    for (const item of parsed) {
      if (item && typeof item === 'object' && item.id) {
        await this.addConfig(item).catch(async () => {
          await this.updateConfig(item.id, item)
        })
      }
    }
  }
}

export function createVideoModelManager(
  storageProvider: IStorageProvider,
  registry: IVideoAdapterRegistry
): IVideoModelManager {
  return new VideoModelManager(storageProvider, registry)
}
