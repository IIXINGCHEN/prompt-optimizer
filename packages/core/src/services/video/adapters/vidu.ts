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

export class ViduVideoAdapter extends AbstractVideoProviderAdapter {
  public getProvider(): VideoProvider {
    return {
      id: 'vidu',
      name: 'Vidu (生数科技)',
      description: 'Shengshu Vidu high coherence multi-entity video generation platform',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.vidu.cn/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://platform.vidu.cn',
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
        id: 'vidu-high',
        name: 'Vidu High (高清旗舰)',
        description: 'Vidu high-quality image-to-video foundation model',
        providerId: 'vidu',
        capabilities: {
          image2video: true,
          text2video: false,
          endFrame: false,
          cameraControl: true,
          motionStrength: true,
          supportedDurations: [4, 8],
          supportedRatios: ['16:9', '9:16', '1:1'],
          supportedResolutions: ['1080p'],
        },
        parameterDefinitions: this.getParameterDefinitions('vidu-high'),
        defaultParameterValues: this.getDefaultParameterValues('vidu-high'),
      },
      {
        id: 'vidu-standard',
        name: 'Vidu Standard (标准版)',
        description: 'Vidu fast image-to-video model for general generation',
        providerId: 'vidu',
        capabilities: {
          image2video: true,
          text2video: false,
          endFrame: false,
          cameraControl: true,
          motionStrength: true,
          supportedDurations: [4, 8],
          supportedRatios: ['16:9', '9:16', '1:1'],
          supportedResolutions: ['720p'],
        },
        parameterDefinitions: this.getParameterDefinitions('vidu-standard'),
        defaultParameterValues: this.getDefaultParameterValues('vidu-standard'),
      },
    ]
  }

  protected getParameterDefinitions(_modelId: string): readonly VideoParameterDefinition[] {
    return [
      {
        name: 'movement_amplitude',
        labelKey: 'params.movementAmplitude.label',
        descriptionKey: 'params.movementAmplitude.description',
        type: 'string',
        defaultValue: 'auto',
        allowedValues: ['auto', 'small', 'medium', 'large'],
      },
    ]
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {
      movement_amplitude: 'auto',
    }
  }

  public async submitTask(
    request: Image2VideoRequest,
    config: VideoModelConfig,
    signal?: AbortSignal
  ): Promise<{ taskId: string }> {
    const apiKey = config.connectionConfig?.apiKey?.trim()
    if (!apiKey) {
      throw new VideoError(VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED, 'Vidu API Key is required')
    }

    const endpoint = this.resolveEndpointUrl(config, '/tasks')
    const imgUrl = this.resolveInputImage(request.inputImage)

    const payload: Record<string, any> = {
      model: config.modelId || 'vidu-high',
      prompt: request.prompt,
      image: imgUrl,
      duration: request.duration || 4,
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
        `Failed to submit Vidu video task (${res.status}): ${errText}`
      )
    }

    const data = await res.json()
    const taskId = data.task_id || data.id
    if (!taskId) {
      throw new VideoError(VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED, data.message || 'Vidu response missing task_id')
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
      throw new VideoError(VIDEO_ERROR_CODES.TASK_POLLING_FAILED, 'Vidu API Key is required')
    }

    const endpoint = this.resolveEndpointUrl(config, `/tasks/${encodeURIComponent(taskId)}`)
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
        throw new Error(`Vidu query task transient error (${res.status}): ${errText}`)
      }
      throw new VideoError(
        VIDEO_ERROR_CODES.TASK_POLLING_FAILED,
        `Vidu query task error (${res.status}): ${errText}`
      )
    }

    const data = await res.json()
    const rawStatus = String(data.state || data.status || '').toLowerCase()

    let status: VideoTaskStatus = 'processing'
    let progressPercent: number | undefined

    switch (rawStatus) {
      case 'created':
      case 'queued':
        status = 'queued'
        progressPercent = 10
        break
      case 'processing':
        status = 'processing'
        progressPercent = 50
        break
      case 'success':
      case 'succeeded':
        status = 'succeeded'
        progressPercent = 100
        break
      case 'failed':
      case 'error':
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
      const creations = data.creations || data.results
      const videoUrl = creations?.[0]?.url || data.video_url
      if (!videoUrl) {
        task.status = 'failed'
        task.error = {
          code: 'NO_VIDEO_URL',
          message: 'Vidu task succeeded but returned no video output URL',
          raw: data,
        }
      } else {
        task.result = {
          video: {
            url: videoUrl,
            duration: 4,
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
        message: data.error_message || data.message || 'Vidu video generation failed',
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
