import { AbstractVideoProviderAdapter } from './abstract-adapter'
import { VideoError } from '../errors'
import type {
  VideoProvider,
  VideoModel,
  Image2VideoRequest,
  VideoModelConfig,
  VideoParameterDefinition,
  VideoTask,
  VideoTaskStatus,
} from '../types'
import { VIDEO_ERROR_CODES } from '../../../constants/error-codes'

export class SiliconFlowVideoAdapter extends AbstractVideoProviderAdapter {
  protected normalizeBaseUrl(base: string): string {
    const trimmed = base.replace(/\/$/, '')
    return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`
  }

  public getProvider(): VideoProvider {
    return {
      id: 'siliconflow',
      name: 'SiliconFlow',
      description: 'SiliconFlow multi-model video generation platform',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.siliconflow.cn/v1',
      supportsDynamicModels: false,
      apiKeyUrl: 'https://cloud.siliconflow.cn/account/ak',
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
        id: 'THUDM/CogVideoX-5b-I2V',
        name: 'CogVideoX 5B I2V',
        description: 'Tsinghua & Zhipu CogVideoX 5B Image-to-Video generation model',
        providerId: 'siliconflow',
        capabilities: {
          image2video: true,
          text2video: false,
          endFrame: false,
          cameraControl: false,
          motionStrength: false,
          supportedDurations: [6],
          supportedRatios: ['16:9', '9:16', '1:1'],
          supportedResolutions: ['720p'],
        },
        parameterDefinitions: this.getParameterDefinitions('THUDM/CogVideoX-5b-I2V'),
        defaultParameterValues: this.getDefaultParameterValues('THUDM/CogVideoX-5b-I2V'),
      },
    ]
  }

  protected getParameterDefinitions(_modelId: string): readonly VideoParameterDefinition[] {
    return [
      {
        name: 'seed',
        labelKey: 'params.seed.label',
        descriptionKey: 'params.seed.description',
        type: 'integer',
        minValue: 0,
        maxValue: 9999999999,
      },
    ]
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {}
  }

  public async submitTask(
    request: Image2VideoRequest,
    config: VideoModelConfig
  ): Promise<{ taskId: string }> {
    const apiKey = config.connectionConfig?.apiKey?.trim()
    if (!apiKey) {
      throw new VideoError(VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED, 'SiliconFlow API Key is required')
    }

    const endpoint = this.resolveEndpointUrl(config, '/video/submit')
    const imgData = this.resolveInputImage(request.inputImage)

    const payload: Record<string, any> = {
      model: config.modelId,
      prompt: request.prompt,
      image: imgData,
      ...config.paramOverrides,
      ...request.paramOverrides,
    }

    if (request.seed !== undefined) {
      payload.seed = request.seed
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new VideoError(
        VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED,
        `Failed to submit SiliconFlow video task (${res.status}): ${errText}`
      )
    }

    const data = await res.json()
    const taskId = data.requestId
    if (!taskId) {
      throw new VideoError(
        VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED,
        'SiliconFlow response missing requestId'
      )
    }

    return { taskId }
  }

  public async queryTask(
    taskId: string,
    config: VideoModelConfig
  ): Promise<VideoTask> {
    const apiKey = config.connectionConfig?.apiKey?.trim()
    if (!apiKey) {
      throw new VideoError(VIDEO_ERROR_CODES.TASK_POLLING_FAILED, 'SiliconFlow API Key is required')
    }

    const endpoint = this.resolveEndpointUrl(config, '/video/status')
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requestId: taskId }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new VideoError(
        VIDEO_ERROR_CODES.TASK_POLLING_FAILED,
        `SiliconFlow query task error (${res.status}): ${errText}`
      )
    }

    const data = await res.json()
    const rawStatus = String(data.status || '').toLowerCase()

    let status: VideoTaskStatus = 'processing'
    let progressPercent: number | undefined

    switch (rawStatus) {
      case 'queued':
      case 'pending':
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
      const videoUrl = data.results?.videos?.[0]?.url
      if (!videoUrl) {
        task.status = 'failed'
        task.error = {
          code: 'NO_VIDEO_URL',
          message: 'SiliconFlow succeeded but no video url returned',
          raw: data,
        }
      } else {
        task.result = {
          video: {
            url: videoUrl,
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
        message: data.reason || 'SiliconFlow video generation failed',
        raw: data,
      }
    }

    return task
  }

  private resolveInputImage(ref: { b64?: string; url?: string }): string {
    if (ref.url && ref.url.trim()) return ref.url.trim()
    if (ref.b64 && ref.b64.trim()) {
      return ref.b64.startsWith('data:') ? ref.b64 : `data:image/png;base64,${ref.b64}`
    }
    throw new VideoError(VIDEO_ERROR_CODES.INPUT_IMAGE_REQUIRED, 'Valid input image required')
  }
}
