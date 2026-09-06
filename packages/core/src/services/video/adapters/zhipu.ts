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

export class ZhipuVideoAdapter extends AbstractVideoProviderAdapter {
  public getProvider(): VideoProvider {
    return {
      id: 'zhipu',
      name: 'Zhipu AI (智谱清言)',
      description: 'Zhipu BigModel CogVideoX native video generation platform',
      requiresApiKey: true,
      defaultBaseURL: 'https://open.bigmodel.cn/api/paas/v4',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
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
        id: 'cogvideox',
        name: 'CogVideoX (标准高质量)',
        description: 'Zhipu AI high-quality CogVideoX generation foundation model',
        providerId: 'zhipu',
        capabilities: {
          image2video: true,
          text2video: false,
          endFrame: false,
          cameraControl: true,
          motionStrength: false,
          supportedDurations: [6],
          supportedRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
          supportedResolutions: ['720p', '1080p'],
        },
        parameterDefinitions: this.getParameterDefinitions('cogvideox'),
        defaultParameterValues: this.getDefaultParameterValues('cogvideox'),
      },
      {
        id: 'cogvideox-flash',
        name: 'CogVideoX-Flash (极速免流版)',
        description: 'Zhipu AI fast free-tier CogVideoX model',
        providerId: 'zhipu',
        capabilities: {
          image2video: true,
          text2video: false,
          endFrame: false,
          cameraControl: true,
          motionStrength: false,
          supportedDurations: [6],
          supportedRatios: ['16:9', '9:16', '1:1'],
          supportedResolutions: ['720p'],
        },
        parameterDefinitions: this.getParameterDefinitions('cogvideox-flash'),
        defaultParameterValues: this.getDefaultParameterValues('cogvideox-flash'),
      },
    ]
  }

  protected getParameterDefinitions(_modelId: string): readonly VideoParameterDefinition[] {
    return [
      {
        name: 'quality',
        labelKey: 'params.quality.label',
        descriptionKey: 'params.quality.description',
        type: 'string',
        defaultValue: 'quality',
        allowedValues: ['quality', 'speed'],
      },
      {
        name: 'with_audio',
        labelKey: 'params.withAudio.label',
        descriptionKey: 'params.withAudio.description',
        type: 'boolean',
        defaultValue: false,
      },
      {
        name: 'size',
        labelKey: 'params.size.label',
        descriptionKey: 'params.size.description',
        type: 'string',
        defaultValue: '1280x720',
        allowedValues: ['1280x720', '720x1280', '1024x1024', '1920x1080'],
      },
    ]
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {
      quality: 'quality',
      with_audio: false,
      size: '1280x720',
    }
  }

  public async submitTask(
    request: Image2VideoRequest,
    config: VideoModelConfig,
    signal?: AbortSignal
  ): Promise<{ taskId: string }> {
    const apiKey = config.connectionConfig?.apiKey?.trim()
    if (!apiKey) {
      throw new VideoError(VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED, 'Zhipu API Key is required')
    }

    const endpoint = this.resolveEndpointUrl(config, '/videos/generations')
    const imgUrl = this.resolveInputImage(request.inputImage)

    const parameters: Record<string, any> = {
      ...config.paramOverrides,
      ...request.paramOverrides,
    }

    if (!parameters.size && request.aspectRatio) {
      if (request.aspectRatio === '16:9') parameters.size = '1280x720'
      else if (request.aspectRatio === '9:16') parameters.size = '720x1280'
      else if (request.aspectRatio === '1:1') parameters.size = '1024x1024'
    }

    const payload: Record<string, any> = {
      model: config.modelId || 'cogvideox',
      prompt: request.prompt,
      image_url: imgUrl,
      ...parameters,
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
        `Failed to submit Zhipu video task (${res.status}): ${errText}`
      )
    }

    const data = await res.json()
    const taskId = data.id || data.request_id
    if (!taskId) {
      throw new VideoError(
        VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED,
        'Zhipu response missing task ID'
      )
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
      throw new VideoError(VIDEO_ERROR_CODES.TASK_POLLING_FAILED, 'Zhipu API Key is required')
    }

    const endpoint = this.resolveEndpointUrl(config, `/async-result/${taskId}`)
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
        throw new Error(`Zhipu query task transient error (${res.status}): ${errText}`)
      }
      throw new VideoError(
        VIDEO_ERROR_CODES.TASK_POLLING_FAILED,
        `Zhipu query task error (${res.status}): ${errText}`
      )
    }

    const data = await res.json()
    const rawStatus = String(data.task_status || '').toUpperCase()

    let status: VideoTaskStatus = 'processing'
    let progressPercent: number | undefined

    switch (rawStatus) {
      case 'PROCESSING':
        status = 'processing'
        progressPercent = 50
        break
      case 'SUCCESS':
        status = 'succeeded'
        progressPercent = 100
        break
      case 'FAIL':
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
      const videoItem = data.video_result?.[0]
      const videoUrl = videoItem?.url
      if (!videoUrl) {
        task.status = 'failed'
        task.error = {
          code: 'NO_VIDEO_URL',
          message: 'Zhipu generation succeeded but no video url returned',
          raw: data,
        }
      } else {
        task.result = {
          video: {
            url: videoUrl,
            coverImageUrl: videoItem?.cover_image_url,
            mimeType: 'video/mp4',
            duration: 6,
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
        message: data.msg || 'Zhipu video generation failed',
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
