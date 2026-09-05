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
  protected static readonly TEST_IMAGE_BASE64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAABGVJREFUeJztm01oXFUUx3/vzZtJMmnapPWjraZN/SCNrS200KKgIGhBXYhQcOHChYJbwY3gQnDhwoWgi4ILQRFciCCCC1sQwYKLii1YC1ppbWsb29Sm+Zg0mWTevHfvcefOm8nMm5lk3ryZvPwgvHvfO+fcO//cc8+79wZCQkJCQkJCQrZJAC5wC3gd+B54HfgCuO7ad4C/KsuLtR3E6gFvAH1AAiwDPwBLwBzwmXveaH4H8ASwF7yfawNYBL4Cfq7VPrMF3AVcB/qATdJ6x8CXwNEa+x6qY8BDwG/AADAKzAJZYMLN7zMfnCYA4G3gJDAJzAO9wPfAEPCKG7vE6sYAfAK8BOwDFoC7gVHgWWARsL0VX6wGYANYBnYCu4BjQMIVKyfdcxH4FrgJfOiOHnAM+BWwgZNAGhjw4rZZM4BF4BzwJ3DCjUWkqaXABeAi8CKQAl4DFoATwB1uxd8wCxQZ0XPBYuAJoO3DfOOZjhvAOeB5V6SdABYZWKkNwAbwDLAKnDZP7Qa+Av4Gzo/xH7IbuOJe+yTwByvBr+3VwxrrQKvkL+Bf4LE2VsU8cBGYIIKfuxRFJiYJAL9nE8zf/M2zW/Ll7zqgBBxoY1XMAmNE8HOXothNJiYJAL9hE9wdGF4IcVlmNPqfk4QsXFkCQu3fBrAjQNVsChFJ6CeS4CaZJqAnQNVsChFZeECCm0y9N0AAGElwk1lTSewNUDWbQkQS3GQaeIsAngBUsyn0E0lwk1lN6NeB3jZWxZOElIQHUC8J/UQS3GRqQh8E2hnfVBL7Atb9phGRhAckuMnUhD4A/N3GqlCShJ5NMMGJJLjJ1AT3AXOEVJS7Qcrb2zhGJMFNpiZ0P/APcG+AqtkUIpLgJlMT2gfs3SaP5N8EEnwP8Kf7gGFgO8x0xyUhK+Dre4K6o82g0o4h2zDTbVpHyMrLanxT9AV9a9VpQWgJV1HKBq4CqeKG6KbL9bbN3OVqw7q1W8gMlLOHh40TzE0hKwqjbO6qFJO5sn+OE9u0JnQGJiXJ1mKdR/gSF5Z9E0ywFaHbXGDEg4j8WjSC7hJyIcmP0SjMCWElwW0MEUH0s4k4zWuIyGKFmGDl5aBGdI/9/8mABDeZmtB7gV4iekKT2BNwD7DfYx4+W5JZd1fI0xDKq+qJakTi0xRzMKTGsR7eI+J9gptMTWg/+Ku6tSXhEt7hCTfgJXjX6wa8hBfwxVPgaLW8hNeUbDK7hVxuLcLVF0zSh3R+Q/hsKIr2+zZLT8jnJOQ7wn5H2O8I+x1hvyPsd4T9jrDfEfY7wn5H2O8I+x1hvyPsd4T9jrDfEfY7wn5H2O8I+x1hfZKwvyVd10ukBOvMNeAj4B9gAnh3+wfbEy9TZx+c7R+Ay3Q2v1ek3gJOufblO7/YnphrCfn8Yr0F7HOfgG35j5tOpK4+GWfA6y4y5ePa8t0v4wyY8pq/Am9tQ10hISEhISEhIaFo/gOE5C7Cek1g0wAAAABJRU5ErkJggg=='

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
    config: VideoModelConfig
  ): Promise<{ taskId: string }>

  public abstract queryTask(
    taskId: string,
    config: VideoModelConfig
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
    const { taskId } = await this.submitTask(request, config)

    handlers?.onStatusChange?.('queued', 5)

    const startTime = Date.now()
    const timeoutMs = options.pollingTimeoutMs ?? 600_000 // 10 分钟超时

    let pollIntervalMs = 2_000

    while (true) {
      if (signal?.aborted) {
        if (typeof this.cancelTask === 'function') {
          try {
            await this.cancelTask(taskId, config)
          } catch (e) {
            console.warn('[VideoAdapter] Failed to notify remote cancellation:', e)
          }
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
        task = await this.queryTask(taskId, config)
      } catch (err) {
        // 网络短暂错误时允许重试，不立即崩溃
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`[VideoAdapter] Task ${taskId} query error, will retry:`, message)
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
      const timer = setTimeout(resolve, ms)
      if (signal) {
        const onAbort = () => {
          clearTimeout(timer)
          signal.removeEventListener('abort', onAbort)
          reject(new VideoError(VIDEO_ERROR_CODES.TASK_CANCELLED, 'Task cancelled by user'))
        }
        signal.addEventListener('abort', onAbort)
      }
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
