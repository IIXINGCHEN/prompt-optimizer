import type {
  VideoProvider,
  VideoModel,
  Image2VideoRequest,
  VideoModelConfig,
  VideoParameterDefinition,
  VideoTask,
  VideoTaskStatus,
} from '../types'
import { AbstractVideoProviderAdapter } from './abstract-adapter'
import { VideoError } from '../errors'
import { VIDEO_ERROR_CODES } from '../../../constants/error-codes'

export class RunwayVideoAdapter extends AbstractVideoProviderAdapter {
  public getProvider(): VideoProvider {
    return {
      id: 'runway',
      name: 'Runway',
      description: 'Runway Gen-3 Alpha Hollywood-grade video generation platform',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.runwayml.com/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://dev.runwayml.com',
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string',
        },
      },
    }
  }

  public getModels(): VideoModel[] {
    return [
      {
        id: 'gen3a_turbo',
        name: 'Gen-3 Alpha Turbo',
        description: 'Runway Gen-3 Alpha Turbo high speed cinematic generation model',
        providerId: 'runway',
        capabilities: {
          image2video: true,
          text2video: false,
          endFrame: false,
          cameraControl: true,
          motionStrength: false,
          supportedDurations: [5, 10],
          supportedRatios: ['16:9', '9:16'],
          supportedResolutions: ['720p'],
        },
        parameterDefinitions: this.getParameterDefinitions('gen3a_turbo'),
        defaultParameterValues: this.getDefaultParameterValues('gen3a_turbo'),
      },
    ]
  }

  protected getParameterDefinitions(_modelId: string): readonly VideoParameterDefinition[] {
    return [
      {
        name: 'ratio',
        labelKey: 'params.ratio.label',
        descriptionKey: 'params.ratio.description',
        type: 'string',
        defaultValue: '1280:768',
        allowedValues: ['1280:768', '768:1280'],
      },
    ]
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {
      ratio: '1280:768',
    }
  }

  public async submitTask(
    request: Image2VideoRequest,
    config: VideoModelConfig,
    signal?: AbortSignal
  ): Promise<{ taskId: string }> {
    const apiKey = config.connectionConfig?.apiKey?.trim()
    if (!apiKey) {
      throw new VideoError(VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED, 'Runway API Key is required')
    }

    const endpoint = this.resolveEndpointUrl(config, '/image_to_video')
    const imgUrl = this.resolveInputImage(request.inputImage)

    let ratio = '1280:768'
    if (request.aspectRatio === '9:16') {
      ratio = '768:1280'
    }

    const payload: Record<string, any> = {
      model: config.modelId || 'gen3a_turbo',
      promptImage: imgUrl,
      promptText: request.prompt,
      duration: request.duration || 5,
      ratio,
      ...config.paramOverrides,
      ...request.paramOverrides,
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-09-13',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new VideoError(
        VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED,
        `Failed to submit Runway video task (${res.status}): ${errText}`
      )
    }

    const data = await res.json()
    const taskId = data.id || data.taskId
    if (!taskId) {
      throw new VideoError(VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED, 'Runway response missing task ID')
    }

    return { taskId }
  }

  public async queryTask(
    taskId: string,
    config: VideoModelConfig,
    signal?: AbortSignal
  ): Promise<VideoTask> {
    const apiKey = config.connectionConfig?.apiKey?.trim()
    if (!apiKey) {
      throw new VideoError(VIDEO_ERROR_CODES.TASK_POLLING_FAILED, 'Runway API Key is required')
    }

    const endpoint = this.resolveEndpointUrl(config, `/tasks/${encodeURIComponent(taskId)}`)
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-09-13',
      },
      signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      const retryable = res.status === 408 || res.status === 429 || res.status >= 500
      if (retryable) {
        throw new Error(`Runway query task transient error (${res.status}): ${errText}`)
      }
      throw new VideoError(
        VIDEO_ERROR_CODES.TASK_POLLING_FAILED,
        `Runway query task error (${res.status}): ${errText}`
      )
    }

    const data = await res.json()
    const rawStatus = String(data.status || '').toUpperCase()

    let status: VideoTaskStatus = 'processing'
    let progressPercent: number | undefined

    switch (rawStatus) {
      case 'PENDING':
        status = 'queued'
        progressPercent = 10
        break
      case 'RUNNING':
        status = 'processing'
        progressPercent = Math.min(95, Math.round((data.progressRatio || 0.5) * 100))
        break
      case 'SUCCEEDED':
        status = 'succeeded'
        progressPercent = 100
        break
      case 'FAILED':
        status = 'failed'
        break
      case 'CANCELLED':
        status = 'cancelled'
        break
      default:
        status = 'processing'
        break
    }

    const task: VideoTask = {
      taskId,
      configId: config.id,
      status,
      progressPercent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    if (status === 'succeeded') {
      const videoUrl = data.output?.[0]
      if (!videoUrl) {
        task.status = 'failed'
        task.error = {
          code: 'NO_VIDEO_URL',
          message: 'Runway task succeeded but returned no output video URL',
          raw: data,
        }
      } else {
        task.result = {
          video: {
            url: videoUrl,
            duration: 5,
            mimeType: 'video/mp4',
          },
          metadata: {
            providerId: config.providerId,
            modelId: config.modelId,
            configId: config.id,
            taskId,
          },
        }
      }
    } else if (status === 'failed') {
      task.error = {
        code: 'TASK_FAILED',
        message: data.failure || data.failureCode || 'Runway video generation failed',
        raw: data,
      }
    }

    return task
  }

  public override async cancelTask(
    taskId: string,
    config: VideoModelConfig
  ): Promise<boolean> {
    const apiKey = config.connectionConfig?.apiKey?.trim()
    if (!apiKey) return false
    try {
      const endpoint = this.resolveEndpointUrl(config, `/tasks/${encodeURIComponent(taskId)}`)
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Runway-Version': '2024-09-13',
        },
      })
      return res.ok
    } catch {
      return false
    }
  }

  private resolveInputImage(ref: { b64?: string; url?: string; mimeType?: string }): string {
    if (ref.url && ref.url.trim()) return ref.url.trim()
    if (ref.b64 && ref.b64.trim()) {
      const mime = ref.mimeType || 'image/png'
      return ref.b64.startsWith('data:') ? ref.b64 : `data:${mime};base64,${ref.b64}`
    }
    throw new VideoError(VIDEO_ERROR_CODES.INPUT_IMAGE_REQUIRED, 'Valid input image required')
  }
}
