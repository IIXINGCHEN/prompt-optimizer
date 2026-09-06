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

export class MiniMaxVideoAdapter extends AbstractVideoProviderAdapter {
  public getProvider(): VideoProvider {
    return {
      id: 'minimax',
      name: 'MiniMax (海螺视频)',
      description: 'MiniMax Video-01 generation platform with high physical fidelity',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.minimax.chat/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
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
        id: 'video-01',
        name: 'MiniMax Video-01',
        description: 'MiniMax foundation video generation model with film-grade physics',
        providerId: 'minimax',
        capabilities: {
          image2video: true,
          text2video: false,
          endFrame: false,
          cameraControl: true,
          motionStrength: false,
          supportedDurations: [6],
          supportedRatios: ['16:9', '9:16', '1:1'],
          supportedResolutions: ['720p', '1080p'],
        },
        parameterDefinitions: this.getParameterDefinitions('video-01'),
        defaultParameterValues: this.getDefaultParameterValues('video-01'),
      },
      {
        id: 'video-01-live2d',
        name: 'MiniMax Video-01 Live2D',
        description: 'MiniMax anime and 2D character animation model',
        providerId: 'minimax',
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
        parameterDefinitions: this.getParameterDefinitions('video-01-live2d'),
        defaultParameterValues: this.getDefaultParameterValues('video-01-live2d'),
      },
    ]
  }

  protected getParameterDefinitions(_modelId: string): readonly VideoParameterDefinition[] {
    return []
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {}
  }

  public async submitTask(
    request: Image2VideoRequest,
    config: VideoModelConfig,
    signal?: AbortSignal
  ): Promise<{ taskId: string }> {
    const apiKey = config.connectionConfig?.apiKey?.trim()
    if (!apiKey) {
      throw new VideoError(VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED, 'MiniMax API Key is required')
    }

    const endpoint = this.resolveEndpointUrl(config, '/video_generation')
    const imgUrl = this.resolveInputImage(request.inputImage)

    const payload: Record<string, any> = {
      model: config.modelId || 'video-01',
      prompt: request.prompt,
      first_frame_image: imgUrl,
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
        `Failed to submit MiniMax video task (${res.status}): ${errText}`
      )
    }

    const data = await res.json()
    const taskId = data.task_id
    if (!taskId) {
      const errMsg = data.base_resp?.status_msg || 'MiniMax response missing task_id'
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
      throw new VideoError(VIDEO_ERROR_CODES.TASK_POLLING_FAILED, 'MiniMax API Key is required')
    }

    const endpoint = this.resolveEndpointUrl(config, `/query/video_generation?task_id=${encodeURIComponent(taskId)}`)
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
        throw new Error(`MiniMax query task transient error (${res.status}): ${errText}`)
      }
      throw new VideoError(
        VIDEO_ERROR_CODES.TASK_POLLING_FAILED,
        `MiniMax query task error (${res.status}): ${errText}`
      )
    }

    const data = await res.json()
    const rawStatus = String(data.status || '').toLowerCase()

    let status: VideoTaskStatus = 'processing'
    let progressPercent: number | undefined

    switch (rawStatus) {
      case 'preparing':
      case 'queueing':
        status = 'queued'
        progressPercent = 10
        break
      case 'processing':
        status = 'processing'
        progressPercent = 50
        break
      case 'success':
        status = 'succeeded'
        progressPercent = 100
        break
      case 'fail':
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
      let videoUrl = data.video_url || data.file_download_url
      if (!videoUrl && data.file_id) {
        try {
          const fileEndpoint = this.resolveEndpointUrl(config, `/files/retrieve?file_id=${encodeURIComponent(data.file_id)}`)
          const fileRes = await fetch(fileEndpoint, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            signal,
          })
          if (fileRes.ok) {
            const fileData = await fileRes.json()
            videoUrl = fileData.file?.download_url || fileData.download_url
          }
        } catch (e) {
          console.warn('[MiniMax] Failed to retrieve file url from file_id:', e)
        }
      }

      if (!videoUrl) {
        task.status = 'failed'
        task.error = {
          code: 'NO_VIDEO_URL',
          message: 'MiniMax succeeded but returned no video download url',
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
        message: data.base_resp?.status_msg || 'MiniMax video generation failed',
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
