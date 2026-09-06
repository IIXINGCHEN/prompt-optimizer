import type {
  IVideoProviderAdapter,
  VideoProvider,
  VideoModel,
  Image2VideoRequest,
  VideoResult,
  VideoModelConfig,
  VideoParameterDefinition,
  VideoTask,
  VideoProgressHandlers,
} from '../types'
import { VideoError } from '../errors'
import { VIDEO_ERROR_CODES } from '../../../constants/error-codes'

export abstract class AbstractVideoProviderAdapter implements IVideoProviderAdapter {
  public abstract getProvider(): VideoProvider
  public abstract getModels(): VideoModel[]

  public async getModelsAsync(_connectionConfig: Record<string, any>): Promise<VideoModel[]> {
    return this.getModels()
  }

  protected abstract getParameterDefinitions(modelId: string): readonly VideoParameterDefinition[]
  protected abstract getDefaultParameterValues(modelId: string): Record<string, unknown>

  public buildDefaultModel(modelId: string): VideoModel {
    const provider = this.getProvider()
    return {
      id: modelId,
      name: modelId,
      description: `Custom model ${modelId} for ${provider.name}`,
      providerId: provider.id,
      capabilities: {
        image2video: true,
        text2video: false,
        endFrame: false,
        cameraControl: true,
        motionStrength: true,
        supportedDurations: [5],
        supportedRatios: ['16:9', '9:16', '1:1'],
      },
      parameterDefinitions: this.getParameterDefinitions(modelId),
      defaultParameterValues: this.getDefaultParameterValues(modelId),
    }
  }

  public abstract submitTask(
    request: Image2VideoRequest,
    config: VideoModelConfig,
    signal?: AbortSignal
  ): Promise<{ taskId: string }>

  public abstract queryTask(
    taskId: string,
    config: VideoModelConfig,
    signal?: AbortSignal
  ): Promise<VideoTask>

  public async cancelTask?(
    _taskId: string,
    _config: VideoModelConfig
  ): Promise<boolean> {
    return false
  }

  /**
   * 渐进式异步任务轮询引擎
   * 默认最大轮询 10 分钟 (600,000ms)，渐进式退避 (2s -> 3s -> 5s)
   */
  public async generateVideo(
    request: Image2VideoRequest,
    config: VideoModelConfig,
    handlers?: VideoProgressHandlers,
    signal?: AbortSignal,
    options: { pollingTimeoutMs?: number } = {}
  ): Promise<VideoResult> {
    if (signal?.aborted) {
      throw new VideoError(VIDEO_ERROR_CODES.TASK_CANCELLED, 'Task cancelled before submission')
    }

    // 1. 提交异步任务
    handlers?.onStatusChange?.('pending', 0)
    const { taskId } = await this.submitTask(request, config, signal)

    handlers?.onStatusChange?.('queued', 5)

    const startTime = Date.now()
    const timeoutMs = options.pollingTimeoutMs ?? 600_000 // 10 分钟超时

    let pollIntervalMs = 2_000
    let consecutiveQueryErrors = 0

    while (true) {
      if (signal?.aborted) {
        try {
          await this.cancelTask?.(taskId, config)
        } catch (e) {
          console.warn('[VideoAdapter] Failed to notify remote cancellation:', e)
        }
        throw new VideoError(VIDEO_ERROR_CODES.TASK_CANCELLED, 'Task cancelled by user')
      }

      const elapsed = Date.now() - startTime
      if (elapsed > timeoutMs) {
        throw new VideoError(VIDEO_ERROR_CODES.TASK_TIMEOUT, `Task ${taskId} timed out after ${Math.round(elapsed / 1000)}s`)
      }

      // 等待下次轮询
      await this.sleep(pollIntervalMs, signal)

      // 2. 查询任务状态
      let task: VideoTask
      try {
        task = await this.queryTask(taskId, config, signal)
        consecutiveQueryErrors = 0
      } catch (err) {
        // 网络短暂错误时允许重试；连续多次失败或永久性错误（如鉴权失效）立即上抛，
        // 避免以固定间隔空转 10 分钟并掩盖真实根因。
        consecutiveQueryErrors++
        const isPermanent = err instanceof VideoError && err.code === VIDEO_ERROR_CODES.TASK_POLLING_FAILED
        if (isPermanent || consecutiveQueryErrors >= 5) {
          throw err
        }
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`[VideoAdapter] Task ${taskId} query error (${consecutiveQueryErrors}/5), will retry:`, message)
        pollIntervalMs = Math.min(pollIntervalMs * 2, 10_000)
        continue
      }

      handlers?.onPollingTick?.(task)
      handlers?.onStatusChange?.(task.status, task.progressPercent)

      if (task.status === 'succeeded') {
        if (!task.result) {
          throw new VideoError(VIDEO_ERROR_CODES.GENERATION_FAILED, 'Task succeeded but returned no result')
        }
        handlers?.onComplete?.(task.result)
        return task.result
      }

      if (task.status === 'failed') {
        const errorMsg = task.error?.message || 'Video generation task failed'
        const error = new VideoError(VIDEO_ERROR_CODES.TASK_FAILED, errorMsg, { taskId, details: errorMsg })
        handlers?.onError?.(error)
        throw error
      }

      if (task.status === 'cancelled') {
        throw new VideoError(VIDEO_ERROR_CODES.TASK_CANCELLED, 'Task was cancelled on provider side')
      }

      // 渐进退避策略：前 15 秒每 2 秒一次，15~60 秒每 3 秒一次，超过 60 秒每 5 秒一次
      const currentElapsed = Date.now() - startTime
      if (currentElapsed > 60_000) {
        pollIntervalMs = 5_000
      } else if (currentElapsed > 15_000) {
        pollIntervalMs = 3_000
      }
    }
  }

  protected async sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer)
        reject(new VideoError(VIDEO_ERROR_CODES.TASK_CANCELLED, 'Task cancelled by user'))
      }
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, ms)
      signal?.addEventListener('abort', onAbort)
    })
  }

  protected normalizeBaseUrl(base: string): string {
    return base.replace(/\/$/, '')
  }

  protected resolveBaseUrl(config: VideoModelConfig): string {
    const rawBase = (config.connectionConfig?.baseURL || this.getProvider().defaultBaseURL || '').trim()
    return rawBase ? this.normalizeBaseUrl(rawBase) : ''
  }

  protected resolveEndpointUrl(config: VideoModelConfig, endpoint: string): string {
    const base = this.resolveBaseUrl(config)
    const ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${base}${ep}`
  }
}
