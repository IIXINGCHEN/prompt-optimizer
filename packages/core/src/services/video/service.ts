import {
  IVideoService,
  IVideoModelManager,
  IVideoAdapterRegistry,
  Image2VideoRequest,
  VideoResult,
  VideoTask,
  VideoModelConfig,
  VideoProgressHandlers,
} from './types'
import { createVideoAdapterRegistry } from './adapters/registry'
import { VideoError } from './errors'
import { VIDEO_ERROR_CODES } from '../../constants/error-codes'
import { BaseError } from '../llm/errors'

export class VideoService implements IVideoService {
  private readonly videoModelManager: IVideoModelManager
  private readonly registry: IVideoAdapterRegistry

  constructor(
    videoModelManager: IVideoModelManager,
    registry?: IVideoAdapterRegistry
  ) {
    this.videoModelManager = videoModelManager
    this.registry = registry ?? createVideoAdapterRegistry()
  }

  async validateRequest(request: Image2VideoRequest): Promise<void> {
    if (!request?.prompt?.trim()) {
      throw new VideoError(VIDEO_ERROR_CODES.PROMPT_EMPTY, 'Video prompt cannot be empty')
    }

    if (!request?.configId?.trim()) {
      throw new VideoError(VIDEO_ERROR_CODES.CONFIG_ID_EMPTY, 'Config ID cannot be empty')
    }

    if (!request.inputImage) {
      throw new VideoError(VIDEO_ERROR_CODES.INPUT_IMAGE_REQUIRED, 'Input image is required for image-to-video')
    }

    const hasB64 = Boolean(request.inputImage.b64 && request.inputImage.b64.trim())
    const hasUrl = Boolean(request.inputImage.url && request.inputImage.url.trim())

    if (!hasB64 && !hasUrl) {
      throw new VideoError(VIDEO_ERROR_CODES.INPUT_IMAGE_B64_REQUIRED, 'Input image must have valid base64 data or url')
    }

    const config = await this.videoModelManager.getConfig(request.configId)
    if (!config) {
      throw new VideoError(VIDEO_ERROR_CODES.CONFIG_NOT_FOUND, undefined, { configId: request.configId })
    }

    if (!config.enabled) {
      throw new VideoError(VIDEO_ERROR_CODES.CONFIG_NOT_ENABLED, undefined, { configName: config.name })
    }

    try {
      this.registry.getAdapter(config.providerId)
    } catch {
      throw new VideoError(VIDEO_ERROR_CODES.PROVIDER_NOT_FOUND, undefined, { providerId: config.providerId })
    }

    const capabilities = config.model?.capabilities
    if (capabilities && !capabilities.image2video) {
      throw new VideoError(VIDEO_ERROR_CODES.MODEL_NOT_SUPPORT_IMAGE2VIDEO, undefined, {
        modelName: config.model.name || config.modelId,
      })
    }

    if (request.endImage && capabilities && !capabilities.endFrame) {
      throw new VideoError(VIDEO_ERROR_CODES.MODEL_NOT_SUPPORT_END_FRAME, undefined, {
        modelName: config.model.name || config.modelId,
      })
    }
  }

  async generateVideo(
    request: Image2VideoRequest,
    handlers?: VideoProgressHandlers,
    signal?: AbortSignal
  ): Promise<VideoResult> {
    await this.validateRequest(request)

    const config = await this.videoModelManager.getConfig(request.configId)
    if (!config) {
      throw new VideoError(VIDEO_ERROR_CODES.CONFIG_NOT_FOUND, undefined, { configId: request.configId })
    }

    const adapter = this.registry.getAdapter(config.providerId)
    const startTime = Date.now()

    try {
      const result = await adapter.generateVideo(request, config, handlers, signal)

      if (!result.metadata) {
        result.metadata = {
          providerId: config.providerId,
          modelId: config.modelId,
          configId: config.id,
          taskId: '',
          generationTimeMs: Date.now() - startTime,
        }
      } else {
        result.metadata.providerId = config.providerId
        result.metadata.modelId = config.modelId
        result.metadata.configId = config.id
        result.metadata.generationTimeMs = Date.now() - startTime
      }

      return result
    } catch (error) {
      if (error instanceof BaseError) {
        throw error
      }
      const details = error instanceof Error ? error.message : String(error)
      throw new VideoError(VIDEO_ERROR_CODES.GENERATION_FAILED, details, { details })
    }
  }

  async submitTask(request: Image2VideoRequest): Promise<{ taskId: string }> {
    await this.validateRequest(request)

    const config = await this.videoModelManager.getConfig(request.configId)
    if (!config) {
      throw new VideoError(VIDEO_ERROR_CODES.CONFIG_NOT_FOUND, undefined, { configId: request.configId })
    }

    const adapter = this.registry.getAdapter(config.providerId)
    return await adapter.submitTask(request, config)
  }

  async queryTask(configId: string, taskId: string): Promise<VideoTask> {
    const config = await this.videoModelManager.getConfig(configId)
    if (!config) {
      throw new VideoError(VIDEO_ERROR_CODES.CONFIG_NOT_FOUND, undefined, { configId })
    }

    const adapter = this.registry.getAdapter(config.providerId)
    return await adapter.queryTask(taskId, config)
  }

  async cancelTask(configId: string, taskId: string): Promise<boolean> {
    const config = await this.videoModelManager.getConfig(configId)
    if (!config) {
      return false
    }

    const adapter = this.registry.getAdapter(config.providerId)
    if (typeof adapter.cancelTask === 'function') {
      return await adapter.cancelTask(taskId, config)
    }
    return false
  }

  async testConnection(config: VideoModelConfig): Promise<boolean> {
    try {
      const adapter = this.registry.getAdapter(config.providerId)
      // 使用空或者测试图片发起一次最小任务查询或提交测试
      if (typeof adapter.getModelsAsync === 'function') {
        const models = await adapter.getModelsAsync(config.connectionConfig || {})
        if (models && models.length > 0) return true
      }
      return true
    } catch (error) {
      if (error instanceof BaseError) {
        throw error
      }
      throw new VideoError(VIDEO_ERROR_CODES.TASK_POLLING_FAILED, String(error))
    }
  }
}

export function createVideoService(
  videoModelManager: IVideoModelManager,
  registry?: IVideoAdapterRegistry
): IVideoService {
  return new VideoService(videoModelManager, registry)
}
