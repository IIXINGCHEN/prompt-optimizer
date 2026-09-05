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

export class DashScopeVideoAdapter extends AbstractVideoProviderAdapter {
  public getProvider(): VideoProvider {
    return {
      id: 'dashscope',
      name: 'DashScope',
      description: 'Aliyun DashScope Wan 2.1 Image-to-Video generation platform',
      requiresApiKey: true,
      defaultBaseURL: 'https://dashscope.aliyuncs.com/api/v1',
      supportsDynamicModels: false,
      apiKeyUrl: 'https://dashscope.console.aliyun.com/apiKey',
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
        id: 'wan2.1-i2v-plus',
        name: 'Wan 2.1 I2V Plus',
        description: 'Aliyun Wan 2.1 high quality image-to-video foundation model',
        providerId: 'dashscope',
        capabilities: {
          image2video: true,
          text2video: false,
          endFrame: false,
          cameraControl: false,
          motionStrength: false,
          supportedDurations: [5],
          supportedRatios: ['16:9', '9:16', '1:1'],
          supportedResolutions: ['720p', '480p'],
        },
        parameterDefinitions: this.getParameterDefinitions('wan2.1-i2v-plus'),
        defaultParameterValues: this.getDefaultParameterValues('wan2.1-i2v-plus'),
      },
      {
        id: 'wan2.1-i2v-turbo',
        name: 'Wan 2.1 I2V Turbo',
        description: 'Aliyun Wan 2.1 fast image-to-video model',
        providerId: 'dashscope',
        capabilities: {
          image2video: true,
          text2video: false,
          endFrame: false,
          cameraControl: false,
          motionStrength: false,
          supportedDurations: [5],
          supportedRatios: ['16:9', '9:16', '1:1'],
          supportedResolutions: ['720p', '480p'],
        },
        parameterDefinitions: this.getParameterDefinitions('wan2.1-i2v-turbo'),
        defaultParameterValues: this.getDefaultParameterValues('wan2.1-i2v-turbo'),
      },
    ]
  }

  protected getParameterDefinitions(_modelId: string): readonly VideoParameterDefinition[] {
    return [
      {
        name: 'size',
        labelKey: 'params.videoSize.label',
        descriptionKey: 'params.videoSize.description',
        type: 'string',
        defaultValue: '1280*720',
        allowedValues: ['1280*720', '960*960', '720*1280'],
      },
      {
        name: 'prompt_extend',
        labelKey: 'params.promptExtend.label',
        descriptionKey: 'params.promptExtend.description',
        type: 'boolean',
        defaultValue: true,
      },
      {
        name: 'seed',
        labelKey: 'params.seed.label',
        descriptionKey: 'params.seed.description',
        type: 'integer',
        minValue: 0,
        maxValue: 4294967295,
      },
    ]
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {
      size: '1280*720',
      prompt_extend: true,
    }
  }

  public async submitTask(
    request: Image2VideoRequest,
    config: VideoModelConfig
  ): Promise<{ taskId: string }> {
    const apiKey = config.connectionConfig?.apiKey?.trim()
    if (!apiKey) {
      throw new VideoError(VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED, 'DashScope API Key is required')
    }

    const endpoint = this.resolveEndpointUrl(config, '/services/aigc/video-generation/video-synthesis')
    const imgUrl = this.resolveInputImage(request.inputImage)

    const parameters: Record<string, any> = {
      ...config.paramOverrides,
      ...request.paramOverrides,
    }

    if (!parameters.size && request.aspectRatio) {
      if (request.aspectRatio === '16:9') parameters.size = '1280*720'
      else if (request.aspectRatio === '9:16') parameters.size = '720*1280'
      else if (request.aspectRatio === '1:1') parameters.size = '960*960'
    }

    if (request.seed !== undefined) {
      parameters.seed = request.seed
    }

    const payload: Record<string, any> = {
      model: config.modelId,
      input: {
        prompt: request.prompt,
        img_url: imgUrl,
      },
      parameters,
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new VideoError(
        VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED,
        `Failed to submit DashScope video task (${res.status}): ${errText}`
      )
    }

    const data = await res.json()
    const taskId = data.output?.task_id || data.request_id
    if (!taskId) {
      throw new VideoError(
        VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED,
        'DashScope response missing task_id'
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
      throw new VideoError(VIDEO_ERROR_CODES.TASK_POLLING_FAILED, 'DashScope API Key is required')
    }

    const endpoint = this.resolveEndpointUrl(config, `/tasks/${taskId}`)
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new VideoError(
        VIDEO_ERROR_CODES.TASK_POLLING_FAILED,
        `DashScope query task error (${res.status}): ${errText}`
      )
    }

    const data = await res.json()
    const output = data.output || {}
    const rawStatus = String(output.task_status || '').toUpperCase()

    let status: VideoTaskStatus = 'processing'
    let progressPercent: number | undefined

    switch (rawStatus) {
      case 'PENDING':
        status = 'queued'
        progressPercent = 10
        break
      case 'RUNNING':
        status = 'processing'
        progressPercent = 50
        break
      case 'SUCCEEDED':
        status = 'succeeded'
        progressPercent = 100
        break
      case 'FAILED':
      case 'UNKNOWN':
        status = 'failed'
        break
      case 'CANCELED':
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
      createdAt: data.usage?.start_time ? new Date(data.usage.start_time).getTime() : Date.now(),
      updatedAt: Date.now(),
    }

    if (status === 'succeeded' && output.video_url) {
      task.result = {
        video: {
          url: output.video_url,
          mimeType: 'video/mp4',
          duration: 5,
        },
        metadata: {
          providerId: config.providerId,
          modelId: config.modelId,
          configId: config.id,
          taskId,
          usage: data.usage,
        },
      }
    } else if (status === 'failed') {
      task.error = {
        code: output.code || 'TASK_FAILED',
        message: output.message || 'DashScope video generation failed',
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
