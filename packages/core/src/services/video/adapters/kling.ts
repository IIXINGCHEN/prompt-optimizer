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

export class KlingVideoAdapter extends AbstractVideoProviderAdapter {
  public getProvider(): VideoProvider {
    return {
      id: 'kling',
      name: 'Kling AI (快手可灵)',
      description: 'Kling AI high-precision portrait & motion video generation platform',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.klingai.com/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://klingai.com',
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
        id: 'kling-v1',
        name: 'Kling V1.0',
        description: 'Kling foundation image-to-video model with natural human motion',
        providerId: 'kling',
        capabilities: {
          image2video: true,
          text2video: false,
          endFrame: false,
          cameraControl: true,
          motionStrength: true,
          supportedDurations: [5, 10],
          supportedRatios: ['16:9', '9:16', '1:1'],
          supportedResolutions: ['720p', '1080p'],
        },
        parameterDefinitions: this.getParameterDefinitions('kling-v1'),
        defaultParameterValues: this.getDefaultParameterValues('kling-v1'),
      },
      {
        id: 'kling-v1-5',
        name: 'Kling V1.5 Pro',
        description: 'Kling enhanced cinematic model with ultra-high facial fidelity',
        providerId: 'kling',
        capabilities: {
          image2video: true,
          text2video: false,
          endFrame: false,
          cameraControl: true,
          motionStrength: true,
          supportedDurations: [5, 10],
          supportedRatios: ['16:9', '9:16', '1:1'],
          supportedResolutions: ['1080p'],
        },
        parameterDefinitions: this.getParameterDefinitions('kling-v1-5'),
        defaultParameterValues: this.getDefaultParameterValues('kling-v1-5'),
      },
    ]
  }

  protected getParameterDefinitions(_modelId: string): readonly VideoParameterDefinition[] {
    return [
      {
        name: 'mode',
        labelKey: 'params.mode.label',
        descriptionKey: 'params.mode.description',
        type: 'string',
        defaultValue: 'std',
        allowedValues: ['std', 'pro'],
      },
      {
        name: 'cfg_scale',
        labelKey: 'params.cfgScale.label',
        descriptionKey: 'params.cfgScale.description',
        type: 'number',
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1,
      },
    ]
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {
      mode: 'std',
      cfg_scale: 0.5,
    }
  }

  public async submitTask(
    request: Image2VideoRequest,
    config: VideoModelConfig,
    signal?: AbortSignal
  ): Promise<{ taskId: string }> {
    const apiKey = config.connectionConfig?.apiKey?.trim()
    if (!apiKey) {
      throw new VideoError(VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED, 'Kling API Key is required')
    }

    const endpoint = this.resolveEndpointUrl(config, '/videos/image2video')
    const imgUrl = this.resolveInputImage(request.inputImage)

    const payload: Record<string, any> = {
      model_name: config.modelId || 'kling-v1',
      prompt: request.prompt,
      image: imgUrl,
      duration: String(request.duration || 5),
      mode: 'std',
      ...config.paramOverrides,
      ...request.paramOverrides,
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new VideoError(
        VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED,
        `Failed to submit Kling video task (${res.status}): ${errText}`
      )
    }

    const data = await res.json()
    const taskId = data.data?.task_id || data.task_id
    if (!taskId) {
      const errMsg = data.message || data.error?.message || 'Kling response missing task_id'
      throw new VideoError(VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED, errMsg)
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
      throw new VideoError(VIDEO_ERROR_CODES.TASK_POLLING_FAILED, 'Kling API Key is required')
    }

    const endpoint = this.resolveEndpointUrl(config, `/videos/image2video/${encodeURIComponent(taskId)}`)
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      const retryable = res.status === 408 || res.status === 429 || res.status >= 500
      if (retryable) {
        throw new Error(`Kling query task transient error (${res.status}): ${errText}`)
      }
      throw new VideoError(
        VIDEO_ERROR_CODES.TASK_POLLING_FAILED,
        `Kling query task error (${res.status}): ${errText}`
      )
    }

    const data = await res.json()
    const taskData = data.data || data
    const rawStatus = String(taskData.task_status || '').toLowerCase()

    let status: VideoTaskStatus = 'processing'
    let progressPercent: number | undefined

    switch (rawStatus) {
      case 'submitted':
      case 'queued':
        status = 'queued'
        progressPercent = 10
        break
      case 'processing':
        status = 'processing'
        progressPercent = 50
        break
      case 'succeed':
      case 'success':
        status = 'succeeded'
        progressPercent = 100
        break
      case 'failed':
        status = 'failed'
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
      const videoItem = taskData.task_result?.videos?.[0]
      const videoUrl = videoItem?.url
      if (!videoUrl) {
        task.status = 'failed'
        task.error = {
          code: 'NO_VIDEO_URL',
          message: 'Kling succeeded but returned no video url',
          raw: data,
        }
      } else {
        task.result = {
          video: {
            url: videoUrl,
            duration: Number(videoItem.duration) || 5,
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
        message: taskData.task_status_msg || 'Kling video generation failed',
        raw: data,
      }
    }

    return task
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
